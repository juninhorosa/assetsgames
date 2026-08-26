import { useEffect, useRef, useState } from "react";
import type { MeshData } from "@/lib/mesh-3d";
import { createReliefMesh } from "@/lib/mesh-3d";

/**
 * Interactive viewport for the generated 2.5D relief mesh.
 * Drag to orbit, scroll to zoom. Three.js is loaded lazily (browser only).
 */
export function Model3DPreview({ mesh, albedo }: { mesh: MeshData; albedo: string }) {
  const mount = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      try {
        const { THREE, geometry, material, mesh: object } = await createReliefMesh(mesh, albedo);
        if (disposed || !mount.current) return;
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

        const pivot = new THREE.Group();
        pivot.add(object);
        scene.add(pivot);

        let distance = 4;
        let yaw = 0.5;
        let pitch = 0.25;
        let autoRotate = true;

        const place = () => {
          camera.position.set(
            distance * Math.cos(pitch) * Math.sin(yaw),
            distance * Math.sin(pitch),
            distance * Math.cos(pitch) * Math.cos(yaw),
          );
          camera.lookAt(0, 0, 0);
        };

        let dragging = false;
        let lastX = 0;
        let lastY = 0;
        const onDown = (e: PointerEvent) => {
          dragging = true;
          autoRotate = false;
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

        let frame = 0;
        const animate = () => {
          frame = requestAnimationFrame(animate);
          if (autoRotate) yaw += 0.004;
          place();
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
          renderer.domElement.removeEventListener("pointerdown", onDown);
          renderer.domElement.removeEventListener("pointermove", onMove);
          renderer.domElement.removeEventListener("pointerup", onUp);
          renderer.domElement.removeEventListener("wheel", onWheel);
          geometry.dispose();
          material.dispose();
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
  }, [mesh, albedo]);

  return (
    <div className="space-y-2">
      <div
        ref={mount}
        className="h-[360px] w-full cursor-grab touch-none overflow-hidden rounded-md border border-border bg-card active:cursor-grabbing"
      />
      <p className="font-mono text-[10px] text-muted-foreground">
        arraste para orbitar · scroll para zoom · {mesh.triangles.toLocaleString("pt-BR")} triângulos
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
