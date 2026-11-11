import { CATEGORY_COLORS, OTHER_COLOR } from "../lib/categoryColor";

const SWATCHES = [
  ...CATEGORY_COLORS,
  { value: OTHER_COLOR, label: "Xám" },
] as const;

/** Category color picker: 9 suggested colors plus a custom color input. */
export function ColorPicker({
  value,
  onChange,
  label = "Màu",
}: {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}) {
  const custom = !SWATCHES.some((s) => s.value === value.toLowerCase());
  return (
    <div role="group" aria-label={label}>
      <div className="flex flex-wrap items-center gap-1.5">
        {SWATCHES.map((s) => {
          const selected = s.value === value.toLowerCase();
          return (
            <button
              key={s.value}
              type="button"
              aria-label={`Màu ${s.label}`}
              aria-pressed={selected}
              title={s.label}
              onClick={() => onChange(s.value)}
              className={`size-6 rounded-full ring-offset-2 transition ${selected ? "ring-2 ring-navy" : "hover:scale-110"}`}
              style={{ backgroundColor: s.value }}
            />
          );
        })}
        <label
          title="Màu khác"
          className={`relative grid size-6 cursor-pointer place-items-center overflow-hidden rounded-full text-xs font-bold text-white ring-offset-2 ${custom ? "ring-2 ring-navy" : ""}`}
          style={{
            background: custom
              ? value
              : "conic-gradient(#e34948, #eda100, #1baf7a, #2a78d6, #6250d6, #e87ba4, #e34948)",
          }}
        >
          <span aria-hidden>+</span>
          <input
            type="color"
            aria-label="Màu khác"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}
