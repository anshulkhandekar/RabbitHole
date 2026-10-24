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
        <img src="rabbithole-mark.svg" width={26} height={26} alt="" />
      </span>
      <span className="word">RabbitHole</span>
    </button>
  );
}
export function LiveStatus({ active = false }: { active?: boolean }) {
  return (
    <span className={`lantern ${active ? "" : "off"}`} aria-hidden="true" />
  );
}
export function Chip({
  children,
  kind = "",
}: {
  children: React.ReactNode;
  kind?: "new" | "done" | "violet" | "error" | "";
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
  options: { value: string; label: string; icon?: IconName; count?: number }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o, i) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          tabIndex={value === o.value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              const next =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? options.length - 1
                    : (i + (e.key === "ArrowRight" ? 1 : options.length - 1)) %
                      options.length;
              onChange(options[next].value);
              (
                e.currentTarget.parentElement?.children[next] as HTMLElement
              )?.focus();
            }
          }}
        >
          {o.icon && <Icon name={o.icon} size={16} />}
          <span>{o.label}</span>
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
