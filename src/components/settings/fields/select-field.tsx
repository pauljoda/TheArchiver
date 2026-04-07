import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SelectFieldProps {
  settingKey: string;
  label: string;
  description?: string;
  value: string | number | boolean | null;
  options: Array<{ label: string; value: string }>;
  onChange: (key: string, value: string | number | boolean) => void;
}

export function SelectField({
  settingKey,
  label,
  description,
  value,
  options,
  onChange,
}: SelectFieldProps) {
  const id = `setting-${settingKey}`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Select
        value={String(value ?? "")}
        onValueChange={(v) => onChange(settingKey, v)}
      >
        <SelectTrigger id={id} className="font-mono text-sm">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && (
        <p className="text-[11px] text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
