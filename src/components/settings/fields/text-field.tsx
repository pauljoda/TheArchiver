import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TextFieldProps {
  settingKey: string;
  type: "string" | "number";
  label: string;
  description?: string;
  value: string | number | boolean | null;
  validation?: {
    min?: number;
    max?: number;
  };
  onChange: (key: string, value: string | number | boolean) => void;
}

export function TextField({
  settingKey,
  type,
  label,
  description,
  value,
  validation,
  onChange,
}: TextFieldProps) {
  const id = `setting-${settingKey}`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Input
        id={id}
        type={type === "number" ? "number" : "text"}
        value={String(value ?? "")}
        onChange={(e) =>
          onChange(
            settingKey,
            type === "number" ? Number(e.target.value) : e.target.value
          )
        }
        min={validation?.min}
        max={validation?.max}
        className="font-mono text-sm"
      />
      {description && (
        <p className="text-[11px] text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
