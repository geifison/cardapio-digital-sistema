export type MultiSelectOption = {
  id: number;
  label?: string; // novo nome padronizado
  name?: string;  // retrocompatibilidade
  description?: string | null;
};

export type MultiSelectProps = {
  title: string;
  options: MultiSelectOption[];
  value: number[];
  onChange: (value: number[]) => void;
  disabled?: boolean;
  columns?: number;
};

export function MultiSelect({ title, options, value, onChange, disabled, columns = 2 }: MultiSelectProps) {
  const gridColsClass = columns === 1
    ? "sm:grid-cols-1"
    : columns === 2
    ? "sm:grid-cols-2"
    : columns === 3
    ? "sm:grid-cols-3"
    : "sm:grid-cols-4";

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
      </div>
      <div className={`grid gap-2 grid-cols-1 ${gridColsClass}`}>
        {options.map((opt) => {
          const checked = value.includes(opt.id);
          const label = opt.label ?? opt.name ?? String(opt.id);
          return (
            <label key={opt.id} className={`flex items-start gap-3 rounded border p-3 ${checked ? "border-primary bg-primary/5" : "border-border"}`}>
              <input
                type="checkbox"
                className="mt-1"
                checked={checked}
                disabled={disabled}
                onChange={(e) => {
                  if (e.target.checked) onChange([...value, opt.id]);
                  else onChange(value.filter((v) => v !== opt.id));
                }}
              />
              <div className="flex-1">
                <div className="text-sm font-medium leading-none">{label}</div>
                {opt.description ? (
                  <div className="text-xs text-muted-foreground mt-1">{opt.description}</div>
                ) : null}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default MultiSelect;