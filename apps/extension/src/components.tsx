import React from "react";
import { Icon, type IconName } from "./Icon";
export function Button({
  icon,
  primary = false,
  quiet = false,
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: IconName;
  primary?: boolean;
  quiet?: boolean;
}) {
  return (
    <button
      className={`btn ${primary ? "btn-primary" : ""} ${quiet ? "btn-quiet" : ""} ${className}`}
      {...props}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}
export function IconButton({
  name,
  label,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "name"> & {
  name: IconName;
  label: string;
}) {
  return (
    <button
      className="icon-btn"
      aria-label={label}
      title={label}
      data-tip={label}
      {...props}
    >
      <Icon name={name} />
    </button>
  );
}
export function Brand({ onClick }: { onClick: () => void }) {
  return (
    <button className="brand" onClick={onClick} aria-label="RabbitHole home">
      <span className="mark">
        <Icon name="logo" size={26} />
      </span>
      <span className="word">RabbitHole</span>
    </button>
  );
}
export function LiveStatus({ active = false }: { active?: boolean }) {
  return (
    <span className={`carrot ${active ? "" : "off"}`} aria-hidden="true" />
  );
}
export function Chip({
  children,
  kind = "",
}: {
  children: React.ReactNode;
  kind?: "new" | "done" | "primary" | "error" | "";
}) {
  return (
    <span className={`chip ${kind ? `chip-${kind}` : ""}`}>{children}</span>
  );
}
export function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: {
    value: string;
    label: string;
    icon?: IconName;
    count?: number;
    disabled?: boolean;
    attention?: boolean;
  }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o, i) => (
        <button
          key={o.value}
          role="tab"
          disabled={o.disabled}
          aria-description={o.attention ? "Map updated" : undefined}
          aria-selected={value === o.value}
          tabIndex={value === o.value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              const enabled = options
                .map((o, index) => ({ ...o, index }))
                .filter((o) => !o.disabled);
              const position = enabled.findIndex((o) => o.index === i);
              const target =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? enabled.length - 1
                    : (position +
                        (e.key === "ArrowRight" ? 1 : enabled.length - 1)) %
                      enabled.length;
              const next = enabled[target]?.index;
              if (next === undefined) return;
              onChange(options[next].value);
              (
                e.currentTarget.parentElement?.children[next] as HTMLElement
              )?.focus();
            }
          }}
        >
          {o.icon && <Icon name={o.icon} size={16} />}
          <span>{o.label}</span>
          {o.attention && (
            <i
              className="new-find-dot"
              aria-hidden="true"
              title="Map updated"
            />
          )}
          {o.count !== undefined && <span className="count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Textarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`field ${className}`} {...props} />;
}
export function Toast({ message }: { message: string }) {
  return (
    <div
      className={`toast ${message ? "show" : ""}`}
      role="status"
      aria-live="polite"
    >
      {message && (
        <>
          <Icon name="check" size={16} />
          {message}
        </>
      )}
    </div>
  );
}
