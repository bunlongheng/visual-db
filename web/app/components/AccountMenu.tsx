"use client";

import { useEffect, useRef, useState } from "react";

// Any of these counts as "still here" and restarts the idle countdown.
const ACTIVITY = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
const WARN_AT = 60; // seconds left before we start showing the countdown
const PING_EVERY = 120_000; // how often activity may roll the server-side session

export default function AccountMenu({
  label,
  idleMinutes,
  rolling,
  logout,
}: {
  label: string;
  idleMinutes: number;
  rolling: boolean; // Google session: refresh the JWT so the cookie tracks real activity
  logout: (formData: FormData) => Promise<void>;
}) {
  const form = useRef<HTMLFormElement>(null);
  const reason = useRef<HTMLInputElement>(null);
  const [left, setLeft] = useState(idleMinutes * 60);

  useEffect(() => {
    const total = idleMinutes * 60 * 1000;
    let last = Date.now();
    let pinged = 0;

    const bump = () => {
      if (document.visibilityState === "hidden") return;
      last = Date.now();
      if (rolling && Date.now() - pinged > PING_EVERY) {
        pinged = Date.now();
        // re-signs the JWT with a fresh expiry, so the window slides with real use
        fetch("/api/auth/session", { cache: "no-store" }).catch(() => {});
      }
    };

    for (const e of ACTIVITY) window.addEventListener(e, bump, { passive: true });
    document.addEventListener("visibilitychange", bump);

    const id = setInterval(() => {
      const secs = Math.ceil((total - (Date.now() - last)) / 1000);
      setLeft(secs);
      if (secs <= 0) {
        clearInterval(id);
        if (reason.current) reason.current.value = "idle";
        form.current?.requestSubmit();
      }
    }, 1000);

    return () => {
      clearInterval(id);
      for (const e of ACTIVITY) window.removeEventListener(e, bump);
      document.removeEventListener("visibilitychange", bump);
    };
  }, [idleMinutes, rolling]);

  return (
    <div className="account">
      <div className="acct-who">
        <span className="acct-dot" aria-hidden="true">
          {label.charAt(0).toUpperCase()}
        </span>
        <span className="acct-label" title={label}>
          {label}
        </span>
      </div>
      {left <= WARN_AT && (
        <p className="acct-warn" role="status">
          Signing out in {Math.max(0, left)}s
        </p>
      )}
      <form ref={form} action={logout}>
        <input type="hidden" name="reason" ref={reason} defaultValue="manual" />
        <button type="submit" className="acct-out">
          Sign out
        </button>
      </form>
    </div>
  );
}
