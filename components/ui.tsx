import type { ReactNode } from "react";
export function AppShell({
  children
}: {
  children: ReactNode;
}) {
  return <main className="grain px-4 py-6 sm:px-6 lg:px-8">{children}</main>;
}

export function PageWrap({
  children,
  maxWidth = "max-w-7xl"
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return <div className={`mx-auto flex ${maxWidth} flex-col gap-6`}>{children}</div>;
}

export function SectionTitle({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="eyebrow text-xs text-stone-500">{eyebrow}</p>
      <h2 className="editorial mt-3 text-2xl font-semibold text-stone-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-stone-700">{description}</p>
    </div>
  );
}

export function Input({
  name,
  label,
  type = "number",
  defaultValue,
  placeholder,
  step,
  required,
  min,
  maxLength
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number;
  placeholder?: string;
  step?: number;
  required?: boolean;
  min?: number;
  maxLength?: number;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-stone-700">
        {label}
        {required ? <span className="ml-1 text-rose-700">*</span> : null}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        step={step}
        required={required}
        min={min}
        maxLength={maxLength}
        className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
      />
    </label>
  );
}

export function Select({
  name,
  label,
  defaultValue,
  options,
  required
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: Array<[string, string]>;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-stone-700">
        {label}
        {required ? <span className="ml-1 text-rose-700">*</span> : null}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none"
      >
        {options.map(([value, labelValue]) => (
          <option key={value} value={value}>
            {labelValue}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-stone-900">{value}</p>
    </div>
  );
}
