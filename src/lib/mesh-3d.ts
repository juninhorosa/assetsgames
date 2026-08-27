/**
 * Browser-side 2.5D reliefization: turns a generated sprite/texture into a real
 * triangle mesh (front relief displaced by luminance, flat back, stitched sides)
 * that can be previewed in Three.js and exported as .glb for Unity/Unreal/Godot.
 *
 * True image-to-mesh (photogrammetry / diffusion 3D) needs GPU infrastructure;
 * this pipeline is deterministic, runs offline in the browser and produces
 * game-ready props, ícones 3D, tiles e relevos.
 */

export interface ReliefOptions {
  /** grid subdivisions per axis (quads = segments²) */
  segments: number;
  /** total thickness in world units (mesh is normalized to ~2 units wide) */
  depth: number;
  /** alpha below this value is treated as empty (cut away) */
  alphaThreshold: number;
  /** 0..1 blur applied to the height field before displacement */
  smooth: number;
}

export const DEFAULT_RELIEF_OPTIONS: ReliefOptions = {
  segments: 128,
  depth: 0.35,
  alphaThreshold: 16,
  smooth: 0.4,
};

export interface MeshData {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  triangles: number;
  vertices: number;
}

interface Sampled {
  height: Float32Array;
  mask: Uint8Array;
  size: number;
}

function sample(img: HTMLImageElement, segments: number, opts: ReliefOptions): Sampled {
  const size = segments + 1;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D indisponível neste navegador.");
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const height = new Float32Array(size * size);
  const mask = new Uint8Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const r = data[i * 4]! / 255;
    const g = data[i * 4 + 1]! / 255;
    const b = data[i * 4 + 2]! / 255;
    const a = data[i * 4 + 3]!;
    mask[i] = a >= opts.alphaThreshold ? 1 : 0;
    height[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // Separable box blur, iterations scaled by the smooth setting.
  const passes = Math.round(opts.smooth * 4);
  for (let p = 0; p < passes; p++) {
    const src = height.slice();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
            sum += src[ny * size + nx]!;
            n++;
          }
        }
        height[y * size + x] = sum / n;
      }
    }
  }

  return { height, mask, size };
}

/** Builds a closed 2.5D relief mesh from an image (alpha = silhouette, luma = height). */
export function buildRelief(img: HTMLImageElement, options: ReliefOptions): MeshData {
  const opts = { ...DEFAULT_RELIEF_OPTIONS, ...options };
  const segments = Math.max(8, Math.min(256, Math.round(opts.segments)));
  const { height, mask, size } = sample(img, segments, opts);

  const half = opts.depth / 2;
  void half;
  const positions: number[] = [];
  const uvs: number[] = [];

  // Front (index i) and back (index i + count) vertex rings share UVs.
  const count = size * size;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / segments;
        const v = y / segments;
        const h = height[y * size + x]!;
        // Relevo simétrico: frente e costas são espelhadas, então de perfil o
        // asset tem volume (lente) em vez de virar uma lâmina plana.
        const bulge = (opts.depth / 2) * (0.35 + 0.65 * h);
        const z = pass === 0 ? bulge : -bulge;
        positions.push(u * 2 - 1, 1 - v * 2, z);
        uvs.push(u, 1 - v);
      }
    }
  }

  const at = (x: number, y: number) => y * size + x;
  const solid = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < segments &&
    y < segments &&
    mask[at(x, y)] === 1 &&
    mask[at(x + 1, y)] === 1 &&
    mask[at(x, y + 1)] === 1 &&
    mask[at(x + 1, y + 1)] === 1;

  const indices: number[] = [];
  for (let y = 0; y < segments; y++) {
    for (let x = 0; x < segments; x++) {
      if (!solid(x, y)) continue;
      const a = at(x, y);
      const b = at(x + 1, y);
      const c = at(x, y + 1);
      const d = at(x + 1, y + 1);

      // front (+z)
      indices.push(a, c, d, a, d, b);
      // back (-z), reversed winding
      indices.push(a + count, d + count, c + count, a + count, b + count, d + count);

      // side skirts on silhouette borders
      if (!solid(x, y - 1)) indices.push(a, b, b + count, a, b + count, a + count);
      if (!solid(x, y + 1)) indices.push(c + count, d + count, d, c + count, d, c);
      if (!solid(x - 1, y)) indices.push(a + count, c + count, c, a + count, c, a);
      if (!solid(x + 1, y)) indices.push(b, d, d + count, b, d + count, b + count);
    }
  }

  if (!indices.length) {
    throw new Error(
      "Nenhuma silhueta encontrada. Remova o fundo (alpha) antes de gerar a malha.",
    );
  }

  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
    triangles: indices.length / 3,
    vertices: positions.length / 3,
  };
}

/** Builds a textured Three.js mesh from relief data. Three is imported lazily. */
export async function createReliefMesh(mesh: MeshData, albedo: string) {
  const THREE = await import("three");
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(mesh.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const texture = await new THREE.TextureLoader().loadAsync(albedo);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.65,
    metalness: 0.05,
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });

  return { THREE, geometry, material, mesh: new THREE.Mesh(geometry, material) };
}

/** Exports the relief as a binary glTF (.glb) usable in every major engine. */
export async function exportGlb(mesh: MeshData, albedo: string, name: string): Promise<Blob> {
  const { THREE, mesh: object } = await createReliefMesh(mesh, albedo);
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  object.name = name;
  const scene = new THREE.Scene();
  scene.name = name;
  scene.add(object);

  const exporter = new GLTFExporter();
  const glb = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(result);
        else reject(new Error("Exportador retornou glTF em JSON, esperado binário."));
      },
      (error) => reject(error instanceof Error ? error : new Error("Falha ao exportar GLB")),
      { binary: true },
    );
  });

  return new Blob([glb], { type: "model/gltf-binary" });
}

export interface MotionFrame {
  mesh: MeshData;
  albedo: string;
}

async function parseGlb(scene: unknown, animations: unknown[] = []): Promise<ArrayBuffer> {
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  const exporter = new GLTFExporter();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      scene as never,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(result);
        else reject(new Error("Exportador retornou glTF em JSON, esperado binário."));
      },
      (error) => reject(error instanceof Error ? error : new Error("Falha ao exportar GLB")),
      { binary: true, animations: animations as never },
    );
  });
}

/**
 * Exports a stop-motion 3D animation: one relief mesh per animation frame,
 * with a single glTF clip that toggles visibility (scale 0/1, discrete
 * interpolation) — importable in Unity, Unreal and Godot as one animated model.
 */
export async function exportAnimatedGlb(
  frames: MotionFrame[],
  name: string,
  fps: number,
): Promise<Blob> {
  if (!frames.length) throw new Error("Nenhum quadro 3D para exportar.");
  const THREE = await import("three");
  const scene = new THREE.Scene();
  scene.name = name;

  const times = frames.map((_, i) => i / fps);
  const tracks: unknown[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    const { mesh: object } = await createReliefMesh(frame.mesh, frame.albedo);
    object.name = `${name}_${String(i).padStart(2, "0")}`;
    object.scale.setScalar(i === 0 ? 1 : 0);
    scene.add(object);

    const values: number[] = [];
    for (let j = 0; j < frames.length; j++) {
      const on = j === i ? 1 : 0;
      values.push(on, on, on);
    }
    const track = new THREE.VectorKeyframeTrack(
      `${object.name}.scale`,
      times,
      values,
      THREE.InterpolateDiscrete,
    );
    tracks.push(track);
  }

  const clip = new THREE.AnimationClip(name, frames.length / fps, tracks as never);
  const glb = await parseGlb(scene, [clip]);
  return new Blob([glb], { type: "model/gltf-binary" });
}

/** Raw GLB bytes for a single relief (used when packing an export ZIP). */
export async function glbBytes(mesh: MeshData, albedo: string, name: string): Promise<Uint8Array> {
  const blob = await exportGlb(mesh, albedo, name);
  return new Uint8Array(await blob.arrayBuffer());
}

export async function animatedGlbBytes(
  frames: MotionFrame[],
  name: string,
  fps: number,
): Promise<Uint8Array> {
  const blob = await exportAnimatedGlb(frames, name, fps);
  return new Uint8Array(await blob.arrayBuffer());
}
