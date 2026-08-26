import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export function SpritePlayer({
  frames,
  initialFps = 12,
  pixelated,
}: {
  frames: string[];
  initialFps?: number;
  pixelated?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(initialFps);
  const raf = useRef<number | null>(null);
  const last = useRef(0);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const step = (t: number) => {
      if (t - last.current >= 1000 / fps) {
        last.current = t;
        setIndex((i) => (i + 1) % frames.length);
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing, fps, frames.length]);

  if (!frames.length) return null;

  return (
    <div className="space-y-3">
      <div className="bg-checker flex aspect-square items-center justify-center overflow-hidden rounded-md border border-border">
        <img
          src={frames[index]}
          alt={`Quadro ${index + 1} da animação`}
          className="max-h-full max-w-full"
          style={pixelated ? { imageRendering: "pixelated" } : undefined}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button size="icon" variant="secondary" onClick={() => setPlaying((p) => !p)}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <div className="flex-1">
          <Slider
            min={1}
            max={30}
            step={1}
            value={[fps]}
            onValueChange={([v]) => setFps(v ?? fps)}
            aria-label="Quadros por segundo"
          />
        </div>
        <span className="w-24 font-mono text-xs text-muted-foreground">
          {fps} fps · {index + 1}/{frames.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {frames.map((frame, i) => (
          <button
            key={i}
            onClick={() => {
              setPlaying(false);
              setIndex(i);
            }}
            className={`bg-checker size-12 overflow-hidden rounded border ${
              i === index ? "border-primary" : "border-border"
            }`}
            aria-label={`Ir para o quadro ${i + 1}`}
          >
            <img src={frame} alt="" className="size-full object-contain" />
          </button>
        ))}
      </div>
    </div>
  );
}
