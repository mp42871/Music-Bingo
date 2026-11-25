import { useEffect, useState } from 'react';

/** Number box that lets the user clear and retype; commits only valid numbers. */
export function NumberInput({ value, onChange, min, max, step = 1, className = 'w-20', ...rest }: {
  value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; className?: string; 'aria-label'?: string; id?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => { if (Number(text) !== value) setText(String(value)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input {...rest} type="number" inputMode="decimal" min={min} max={max} step={step} value={text} className={className}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== '' && !Number.isNaN(n)) onChange(n);
      }}
      onBlur={() => {
        let n = Number(text);
        if (text.trim() === '' || Number.isNaN(n)) n = value;
        if (min !== undefined) n = Math.max(min, n);
        if (max !== undefined) n = Math.min(max, n);
        setText(String(n));
        if (n !== value) onChange(n);
      }} />
  );
}
