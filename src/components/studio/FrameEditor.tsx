import { useState } from "react";
import { ArrowLeft, ArrowRight, Copy, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PixelFrameEditor } from "./PixelFrameEditor";

interface FrameEditorProps {
  frames: string[];
  pixelated?: boolean;
  onChange: (frames: string[]) => void;
}

/**
 * Edição da sequência antes de salvar: reordenar, duplicar e remover quadros.
 * Trabalha apenas sobre a lista de data URLs — a sheet é recomposta depois.
 */
export function FrameEditor({ frames, pixelated, onChange }: FrameEditorProps) {
  const [editing, setEditing] = useState<number | null>(null);
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= frames.length) return;
    const next = [...frames];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onChange(next);
  }

  function duplicate(index: number) {
    const next = [...frames];
    next.splice(index + 1, 0, frames[index]!);
    onChange(next);
  }

  function remove(index: number) {
    if (frames.length <= 1) return;
    onChange(frames.filter((_, i) => i !== index));
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {frames.map((frame, index) => (
        <figure key={`${index}-${frame.slice(-24)}`} className="space-y-1">
          <div className="bg-checker relative flex aspect-square items-center justify-center overflow-hidden rounded border border-border">
            <img
              src={frame}
              alt={`Quadro ${index + 1}`}
              className="max-h-full max-w-full object-contain"
              style={pixelated ? { imageRendering: "pixelated" } : undefined}
            />
            <span className="absolute left-1 top-1 rounded bg-background/80 px-1 font-mono text-[10px] text-muted-foreground">
              {index + 1}
            </span>
          </div>
          <div className="flex items-center justify-between gap-0.5">
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              aria-label={`Editar pixels do quadro ${index + 1}`}
              onClick={() => setEditing(index)}
            >
              <Pencil className="size-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              aria-label={`Mover quadro ${index + 1} para trás`}
              onClick={() => move(index, -1)}
              disabled={index === 0}
            >
              <ArrowLeft className="size-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              aria-label={`Duplicar quadro ${index + 1}`}
              onClick={() => duplicate(index)}
            >
              <Copy className="size-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              aria-label={`Remover quadro ${index + 1}`}
              onClick={() => remove(index)}
              disabled={frames.length <= 1}
            >
              <Trash2 className="size-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              aria-label={`Mover quadro ${index + 1} para frente`}
              onClick={() => move(index, 1)}
              disabled={index === frames.length - 1}
            >
              <ArrowRight className="size-3" />
            </Button>
          </div>
        </figure>
      ))}
      {editing !== null && frames[editing] && (
        <PixelFrameEditor
          open
          frame={frames[editing]}
          index={editing}
          onOpenChange={(open) => { if (!open) setEditing(null); }}
          onSave={(nextFrame) => {
            const next = [...frames];
            next[editing] = nextFrame;
            onChange(next);
          }}
        />
      )}
    </div>
  );
}
