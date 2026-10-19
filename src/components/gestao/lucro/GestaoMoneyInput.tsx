import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatGestaoMoneyInputPreview,
  parseGestaoMoneyBr,
} from "@/lib/gestao-money.ts";

type Props = {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  id?: string;
};

export function GestaoMoneyInput({
  label,
  value,
  onChange,
  onKeyDown,
  onBlur,
  placeholder,
  className,
  id,
}: Props) {
  const preview = formatGestaoMoneyInputPreview(parseGestaoMoneyBr(value));

  return (
    <div className="grid gap-0.5">
      {label ? <Label className="text-xs" htmlFor={id}>{label}</Label> : null}
      <Input
        id={id}
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onBlur?.()}
        onKeyDown={onKeyDown}
      />
      {preview ? (
        <p className="text-[11px] text-muted-foreground" aria-live="polite">
          {preview}
        </p>
      ) : null}
    </div>
  );
}
