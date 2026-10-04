import { useState } from "react";

export function Fact({
  label,
  value,
  edit,
  onSave,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  edit?: string;
  onSave(raw: string): void;
  type?: "text" | "date" | "url";
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const start = () => {
    setDraft(edit ?? value);
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    if (draft !== (edit ?? value)) onSave(draft.trim());
  };
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {editing ? (
          <input
            className="fact-input"
            type={type}
            autoFocus
            value={draft}
            placeholder={placeholder}
            aria-label={label}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <button className={`fact-value${value ? "" : " is-empty"}`} onClick={start} aria-label={value ? `${label}: ${value}. Edit` : `Add ${label.toLowerCase()}`}>
            {value || "+ add"}
          </button>
        )}
      </dd>
    </div>
  );
}
