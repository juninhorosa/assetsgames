import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { PbrOptions } from "@/lib/image-pipeline";

const ROWS: {
  key: keyof Omit<PbrOptions, "invertHeight">;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "normalStrength", label: "Força do Normal", min: 0.2, max: 6, step: 0.1 },
  { key: "roughnessBase", label: "Roughness base", min: 0, max: 1, step: 0.01 },
  { key: "roughnessContrast", label: "Contraste do Roughness", min: 0, max: 2, step: 0.05 },
  { key: "metallicBase", label: "Metallic base", min: 0, max: 1, step: 0.01 },
  { key: "aoStrength", label: "Força do AO", min: 0, max: 2, step: 0.05 },
];

export function PbrControls({
  options,
  onChange,
}: {
  options: PbrOptions;
  onChange: (next: PbrOptions) => void;
}) {
  return (
    <div className="space-y-4">
      {ROWS.map((row) => (
        <div key={row.key} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {row.label}
            </Label>
            <span className="font-mono text-[11px] text-primary">
              {options[row.key].toFixed(2)}
            </span>
          </div>
          <Slider
            min={row.min}
            max={row.max}
            step={row.step}
            value={[options[row.key]]}
            onValueChange={([v]) => onChange({ ...options, [row.key]: v })}
          />
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          Inverter Height
        </Label>
        <Switch
          checked={options.invertHeight}
          onCheckedChange={(v) => onChange({ ...options, invertHeight: v })}
        />
      </div>
    </div>
  );
}
