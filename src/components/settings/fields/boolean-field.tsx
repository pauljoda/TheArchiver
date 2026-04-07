import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface BooleanFieldProps {
  settingKey: string;
  label: string;
  description?: string;
  value: string | number | boolean | null;
  onChange: (key: string, value: string | number | boolean) => void;
}

export function BooleanField({
  settingKey,
  label,
  description,
  value,
  onChange,
}: BooleanFieldProps) {
  const id = `setting-${settingKey}`;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 p-4 transition-colors hover:bg-muted/30">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </Label>
        {description && (
          <p className="text-[11px] text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch
        id={id}
        checked={value === true || value === "true"}
        onCheckedChange={(checked) => onChange(settingKey, checked)}
      />
    </div>
  );
}
