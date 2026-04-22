"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { CheckIcon } from "./icons";

type ToastKind = "success" | "info" | "error";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  detail?: string;
  href?: string;
  hrefLabel?: string;
}

interface ToastCtx {
  push: (t: Omit<Toast, "id">) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { ...t, id }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, 4500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
        style={{ maxWidth: "calc(100vw - 32px)", width: 360 }}
      >
        {items.map((t) => (
          <ToastCard key={t.id} t={t} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx;
}

function ToastCard({ t }: { t: Toast }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setLeaving(true), 4000);
    return () => clearTimeout(id);
  }, []);

  const accent =
    t.kind === "success"
      ? {
          border: "#10b981",
          dot: "#10b981",
          tint: "color-mix(in srgb, #10b981 14%, var(--surface))"
        }
      : t.kind === "error"
      ? {
          border: "#e11d48",
          dot: "#e11d48",
          tint: "color-mix(in srgb, #e11d48 14%, var(--surface))"
        }
      : {
          border: "var(--kite-500)",
          dot: "var(--kite-500)",
          tint: "color-mix(in srgb, var(--kite-500) 14%, var(--surface))"
        };

  return (
    <div
      className="pointer-events-auto rounded-lg border shadow-lg overflow-hidden animate-fade-up"
      style={{
        borderColor: `color-mix(in srgb, ${accent.border} 40%, var(--border))`,
        background: "var(--surface)",
        opacity: leaving ? 0 : 1,
        transform: leaving ? "translateY(-8px)" : "translateY(0)",
        transition: "opacity 350ms, transform 350ms"
      }}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center flex-none mt-0.5"
          style={{ background: accent.tint, color: accent.dot }}
        >
          {t.kind === "success" ? <CheckIcon size={12} /> : <span className="t-mono-sm font-bold">!</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="t-small font-semibold">{t.message}</div>
          {t.detail && (
            <div className="t-small ink-3 mt-0.5 break-all">{t.detail}</div>
          )}
          {t.href && (
            <a
              href={t.href}
              target="_blank"
              rel="noreferrer"
              className="t-mono-sm text-kite-700 hover:text-kite-500 mt-1 inline-block"
            >
              {t.hrefLabel ?? t.href} ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
