import React, { useEffect, useRef, useState } from "react";
import { Button, IconButton } from "./components";
import { Icon } from "./Icon";
import { savedReceipt } from "./handoff-model";
import type { Handoff } from "./handoff";
export function ReadyNote({
  handoff,
  onOpen,
  onDismiss,
}: {
  handoff: Handoff;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const [hover, setHover] = useState(false),
    [focus, setFocus] = useState(false),
    [fading, setFading] = useState(false),
    remaining = useRef(12000),
    dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    if (hover || focus) return;
    const start = Date.now(),
      timer = setTimeout(() => dismiss.current(), remaining.current),
      fade = setTimeout(
        () => setFading(true),
        Math.max(0, remaining.current - 260),
      );
    return () => {
      remaining.current = Math.max(0, remaining.current - (Date.now() - start));
      clearTimeout(timer);
      clearTimeout(fade);
    };
  }, [hover, focus]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss.current();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <aside
      className={`ready-note ${fading ? "fading" : ""}`}
      style={{ animationPlayState: hover || focus ? "paused" : "running" }}
      role="status"
      aria-live="polite"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocus(false);
      }}
    >
      <Icon name="check" />
      <div>
        <strong>Your map is ready</strong>
        <p>
          Go added {handoff.ideas ?? 0}{" "}
          {(handoff.ideas ?? 0) === 1 ? "idea" : "ideas"} and{" "}
          {handoff.questions ?? 0}{" "}
          {(handoff.questions ?? 0) === 1 ? "question" : "questions"} from{" "}
          {Math.max(
            0,
            (handoff.finds ?? handoff.captureIds.length) -
              (handoff.pendingFinds ?? 0),
          )}{" "}
          new{" "}
          {(handoff.finds ?? handoff.captureIds.length) -
            (handoff.pendingFinds ?? 0) ===
          1
            ? "find"
            : "finds"}
          .
        </p>
        <p>{savedReceipt(handoff)}</p>
        <Button primary onClick={onOpen}>
          Open map
        </Button>
        <Button quiet onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
      <IconButton name="x" label="Dismiss map ready note" onClick={onDismiss} />
    </aside>
  );
}
