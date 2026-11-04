import { useEffect, useRef, useState } from "react";

/** Textarea that saves on blur (no write per keystroke). */
export function NotesField({ value, placeholder, label, onSave, rows }: { value: string; placeholder?: string; label: string; onSave: (v: string) => void; rows?: number }) {
  const [text, setText] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);
  return (
    <textarea
      className="inp"
      rows={rows}
      value={text}
      placeholder={placeholder}
      aria-label={label}
      onFocus={() => (focused.current = true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        focused.current = false;
        if (text !== value) onSave(text);
      }}
    />
  );
}
