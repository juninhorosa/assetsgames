import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { MapType } from "@/lib/image-pipeline";

type Shape = "sphere" | "cube" | "plane";

const SHAPE_LABELS: Record<Shape, string> = {
  sphere: "Esfera",
  cube: "Cubo",
  plane: "Plano",
};

/**
 * Applies the derived PBR maps to a mesh so the material can be validated
 * before export. Three.js is imported dynamically (browser-only).
 */
export function MaterialPreview3D({ maps }: { maps: Partial<Record<MapType, string>> }) {
  const mount = useRef<HTMLDivElement>(null);
  const [shape, setShape] = useState<Shape>("sphere");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      try {
        const THREE = await import("three");
        if (disposed || !mount.current) return;
        const el = mount.current;
        const width = el.clientWidth;
        const height = el.clientHeight || 320;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height);
        el.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.set(0, 0, 3.2);

        scene.add(new THREE.AmbientLight(0xffffff, 0.35));
        const key = new THREE.DirectionalLight(0xffffff, 2.2);
        key.position.set(2.5, 2, 3);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xffb457, 0.7);
        fill.position.set(-3, -1, 1);
        scene.add(fill);

        const loader = new THREE.TextureLoader();
        const load = (src?: string) => {
          if (!src) return undefined;
          const tex = loader.load(src);
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.colorSpace = THREE.SRGBColorSpace;
          return tex;
        };
        const linear = (src?: string) => {
          const tex = load(src);
          if (tex) tex.colorSpace = THREE.NoColorSpace;
          return tex;
        };

        const material = new THREE.MeshStandardMaterial({
          map: load(maps.albedo),
          normalMap: linear(maps.normal),
          roughnessMap: linear(maps.roughness),
          metalnessMap: linear(maps.metallic),
          aoMap: linear(maps.ao),
          metalness: maps.metallic ? 1 : 0.05,
          roughness: 1,
        });

        const geometry =
          shape === "sphere"
            ? new THREE.SphereGeometry(1, 64, 48)
            : shape === "cube"
              ? new THREE.BoxGeometry(1.5, 1.5, 1.5)
              : new THREE.PlaneGeometry(2, 2, 1, 1);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.geometry.setAttribute("uv1", mesh.geometry.getAttribute("uv"));
        scene.add(mesh);

        let frame = 0;
        const animate = () => {
          frame = requestAnimationFrame(animate);
          if (shape !== "plane") mesh.rotation.y += 0.006;
          renderer.render(scene, camera);
        };
        animate();

        const onResize = () => {
          const w = el.clientWidth;
          camera.aspect = w / height;
          camera.updateProjectionMatrix();
          renderer.setSize(w, height);
        };
        window.addEventListener("resize", onResize);

        cleanup = () => {
          cancelAnimationFrame(frame);
          window.removeEventListener("resize", onResize);
          geometry.dispose();
          material.dispose();
          renderer.dispose();
          el.removeChild(renderer.domElement);
        };
      } catch {
        setError("Pré-visualização 3D indisponível neste navegador.");
      }
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [shape, maps]);

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {(Object.keys(SHAPE_LABELS) as Shape[]).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={shape === s ? "default" : "secondary"}
            onClick={() => setShape(s)}
          >
            {SHAPE_LABELS[s]}
          </Button>
        ))}
      </div>
      <div
        ref={mount}
        className="h-[320px] w-full overflow-hidden rounded-md border border-border bg-background"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
