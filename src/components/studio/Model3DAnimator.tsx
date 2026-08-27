import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { createReliefMesh, type MotionFrame } from "@/lib/mesh-3d";

/**
 * Stop-motion 3D viewport: one relief mesh per animation frame, cycled at the
 * chosen FPS. Drag to orbit, scroll to zoom.
 */
export function Model3DAnimator({
  frames,
  initialFps,
}: {
  frames: MotionFrame[];
  initialFps: number;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const fpsRef = useRef(initialFps);
  const playingRef = useRef(true);
  const [fps, setFps] = useState(initialFps);
  const [playing, setPlaying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fpsRef.current = fps;
  }, [fps]);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      try {
        const THREE = await import("three");
        const built: Awaited<ReturnType<typeof createReliefMesh>>[] = [];
        for (let i = 0; i < frames.length; i++) {
          const frame = frames[i]!;
          built.push(await createReliefMesh(frame.mesh, frame.albedo));
        }
        if (disposed || !mount.current) {
          built.forEach((b) => {
            b.geometry.dispose();
            b.material.dispose();
          });
          return;
        }

        const el = mount.current;
        const height = el.clientHeight || 360;
        const width = el.clientWidth;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height);
        el.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
        scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        const key = new THREE.DirectionalLight(0xffffff, 2.4);
        key.position.set(2, 2.5, 3);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xffb457, 0.9);
        rim.position.set(-3, -1, -2);
        scene.add(rim);

        built.forEach((b, i) => {
          b.mesh.visible = i === 0;
          scene.add(b.mesh);
        });

        let distance = 4;
        let yaw = 0.4;
        let pitch = 0.2;
        let dragging = false;
        let lastX = 0;
        let lastY = 0;

        const onDown = (e: PointerEvent) => {
          dragging = true;
          lastX = e.clientX;
          lastY = e.clientY;
          renderer.domElement.setPointerCapture(e.pointerId);
        };
        const onMove = (e: PointerEvent) => {
          if (!dragging) return;
          yaw -= (e.clientX - lastX) * 0.008;
          pitch = Math.max(-1.3, Math.min(1.3, pitch + (e.clientY - lastY) * 0.008));
          lastX = e.clientX;
          lastY = e.clientY;
        };
        const onUp = () => {
          dragging = false;
        };
        const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          distance = Math.max(1.6, Math.min(9, distance + e.deltaY * 0.003));
        };
        renderer.domElement.addEventListener("pointerdown", onDown);
        renderer.domElement.addEventListener("pointermove", onMove);
        renderer.domElement.addEventListener("pointerup", onUp);
        renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

        let raf = 0;
        let index = 0;
        let last = performance.now();
        const animate = () => {
          raf = requestAnimationFrame(animate);
          const now = performance.now();
          if (playingRef.current && now - last >= 1000 / Math.max(1, fpsRef.current)) {
            last = now;
            built[index]!.mesh.visible = false;
            index = (index + 1) % built.length;
            built[index]!.mesh.visible = true;
          }
          camera.position.set(
            distance * Math.cos(pitch) * Math.sin(yaw),
            distance * Math.sin(pitch),
            distance * Math.cos(pitch) * Math.cos(yaw),
          );
          camera.lookAt(0, 0, 0);
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
          cancelAnimationFrame(raf);
          window.removeEventListener("resize", onResize);
          renderer.domElement.removeEventListener("pointerdown", onDown);
          renderer.domElement.removeEventListener("pointermove", onMove);
          renderer.domElement.removeEventListener("pointerup", onUp);
          renderer.domElement.removeEventListener("wheel", onWheel);
          built.forEach((b) => {
            b.geometry.dispose();
            b.material.dispose();
          });
          renderer.dispose();
          if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
        };
      } catch (e) {
        setError((e as Error).message || "Viewport 3D indisponível neste navegador.");
      }
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [frames]);

  return (
    <div className="space-y-2">
      <div
        ref={mount}
        className="h-[360px] w-full cursor-grab touch-none overflow-hidden rounded-md border border-border bg-card active:cursor-grabbing"
      />
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => setPlaying((p) => !p)}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {playing ? "Pausar" : "Tocar"}
        </Button>
        <Label className="font-mono text-[10px] text-muted-foreground">{fps} FPS</Label>
        <Slider
          className="flex-1"
          min={1}
          max={30}
          step={1}
          value={[fps]}
          onValueChange={([v]) => setFps(v ?? fps)}
        />
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">
        {frames.length} quadros 3D · arraste para orbitar · scroll para zoom
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
