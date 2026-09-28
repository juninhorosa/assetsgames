import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Eraser, Pipette, Pencil, Redo2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

type Tool = "pencil" | "eraser" | "picker";

interface PixelFrameEditorProps {
  open: boolean;
  frame: string;
  index: number;
  onOpenChange: (open: boolean) => void;
  onSave: (dataUrl: string) => void;
}

export function PixelFrameEditor({ open, frame, index, onOpenChange, onSave }: PixelFrameEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#5de0d0");
  const [brush, setBrush] = useState(1);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [future, setFuture] = useState<ImageData[]>([]);
  const drawing = useRef(false);

  useEffect(() => {
    if (!open) return;
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
      setFuture([]);
    };
    image.src = frame;
  }, [frame, open]);

  function context() {
    return canvasRef.current?.getContext("2d", { willReadFrequently: true }) ?? null;
  }

  function point(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvas.width - 1, Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width))),
      y: Math.max(0, Math.min(canvas.height - 1, Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height))),
    };
  }

  function paint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const ctx = context();
    const p = point(event);
    if (!ctx || !p) return;
    if (tool === "picker") {
      const rgba = ctx.getImageData(p.x, p.y, 1, 1).data;
      setColor(`#${[rgba[0], rgba[1], rgba[2]].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`);
      setTool("pencil");
      return;
    }
    const offset = Math.floor(brush / 2);
    if (tool === "eraser") ctx.clearRect(p.x - offset, p.y - offset, brush, brush);
    else {
      ctx.fillStyle = color;
      ctx.fillRect(p.x - offset, p.y - offset, brush, brush);
    }
  }

  function commit() {
    const ctx = context();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    setHistory((items) => [...items.slice(-29), ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    setFuture([]);
  }

  function restore(data: ImageData) {
    context()?.putImageData(data, 0, 0);
  }

  function undo() {
    if (history.length < 2) return;
    const current = history[history.length - 1];
    const previous = history[history.length - 2];
    if (!current || !previous) return;
    setHistory((items) => items.slice(0, -1));
    setFuture((items) => [current, ...items]);
    restore(previous);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setHistory((items) => [...items, next]);
    restore(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Editar quadro {index + 1}</DialogTitle></DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="icon" variant={tool === "pencil" ? "default" : "outline"} onClick={() => setTool("pencil")} aria-label="Lápis"><Pencil className="size-4" /></Button>
          <Button size="icon" variant={tool === "eraser" ? "default" : "outline"} onClick={() => setTool("eraser")} aria-label="Borracha"><Eraser className="size-4" /></Button>
          <Button size="icon" variant={tool === "picker" ? "default" : "outline"} onClick={() => setTool("picker")} aria-label="Conta-gotas"><Pipette className="size-4" /></Button>
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="size-9 cursor-pointer rounded border border-border bg-card" aria-label="Cor do lápis" />
          <div className="flex min-w-40 flex-1 items-center gap-3"><Label className="whitespace-nowrap">Pincel {brush}px</Label><Slider min={1} max={8} step={1} value={[brush]} onValueChange={([value]) => setBrush(value ?? brush)} /></div>
          <Button size="icon" variant="ghost" onClick={undo} disabled={history.length < 2} aria-label="Desfazer"><RotateCcw className="size-4" /></Button>
          <Button size="icon" variant="ghost" onClick={redo} disabled={!future.length} aria-label="Refazer"><Redo2 className="size-4" /></Button>
        </div>
        <div className="bg-checker flex max-h-[60vh] min-h-72 items-center justify-center overflow-auto rounded-md border border-border p-3">
          <canvas
            ref={canvasRef}
            className="aspect-square w-full max-w-xl cursor-crosshair border border-primary/30 [image-rendering:pixelated]"
            onPointerDown={(event) => { drawing.current = true; event.currentTarget.setPointerCapture(event.pointerId); paint(event); }}
            onPointerMove={(event) => { if (drawing.current && tool !== "picker") paint(event); }}
            onPointerUp={() => { if (drawing.current) commit(); drawing.current = false; }}
            onPointerCancel={() => { drawing.current = false; }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => { const canvas = canvasRef.current; if (canvas) onSave(canvas.toDataURL("image/png")); onOpenChange(false); }}>Aplicar ao quadro</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}