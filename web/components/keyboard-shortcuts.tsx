"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SHORTCUTS: { keys: string; href: string; label: string }[] = [
  { keys: "g r", href: "/dashboard", label: "Research" },
  { keys: "g o", href: "/dashboard/overview", label: "Overview" },
  { keys: "g a", href: "/dashboard/activity", label: "Activity" },
  { keys: "g e", href: "/dashboard/earnings", label: "Earnings" },
  { keys: "g v", href: "/dashboard/verify", label: "Verify" },
  { keys: "g c", href: "/dashboard/claim", label: "Claim" },
  { keys: "g l", href: "/dashboard/leaderboard", label: "Leaderboard" },
  { keys: "g i", href: "/dashboard/gasless", label: "Gasless (infra)" },
  { keys: "g h", href: "/", label: "Home" },
  { keys: "?", href: "", label: "Show this help" }
];

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    (el as HTMLElement).isContentEditable
  );
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const [help, setHelp] = useState(false);
  const [pendingG, setPendingG] = useState(false);

  useEffect(() => {
    let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

    function handler(e: KeyboardEvent) {
      if (isInputFocused() && e.key !== "Escape") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        setHelp(false);
        setPendingG(false);
        if (pendingTimeout) clearTimeout(pendingTimeout);
        (document.activeElement as HTMLElement)?.blur?.();
        return;
      }

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setHelp((v) => !v);
        return;
      }

      if (e.key === "/" && !pendingG) {
        e.preventDefault();
        const ta = document.querySelector(
          "textarea[placeholder*='question'], input[placeholder]"
        ) as HTMLElement | null;
        ta?.focus();
        return;
      }

      if (pendingG) {
        if (pendingTimeout) clearTimeout(pendingTimeout);
        const target = SHORTCUTS.find((s) => {
          const parts = s.keys.split(" ");
          return parts[0] === "g" && parts[1] === e.key.toLowerCase();
        });
        setPendingG(false);
        if (target?.href) {
          e.preventDefault();
          router.push(target.href);
        }
        return;
      }

      if (e.key.toLowerCase() === "g") {
        setPendingG(true);
        pendingTimeout = setTimeout(() => setPendingG(false), 1200);
      }
    }

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (pendingTimeout) clearTimeout(pendingTimeout);
    };
  }, [router, pendingG]);

  return (
    <>
      {pendingG && (
        <div className="fixed bottom-6 right-6 z-50 px-3 py-2 rounded-lg surface card t-mono-sm font-semibold animate-fade-up">
          g _
        </div>
      )}
      {help && (
        <div
          className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center p-4"
          onClick={() => setHelp(false)}
        >
          <div
            className="card p-6 max-w-[460px] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="t-h3">Keyboard shortcuts</div>
              <button
                type="button"
                onClick={() => setHelp(false)}
                className="t-mono-sm ink-3 hover:text-kite-500"
              >
                Esc
              </button>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {SHORTCUTS.map((s) => (
                <div
                  key={s.keys}
                  className="flex items-center justify-between px-2 py-1.5 rounded hover:surface-raised"
                >
                  <span className="t-small">{s.label}</span>
                  <Kbd>{s.keys}</Kbd>
                </div>
              ))}
              <div className="flex items-center justify-between px-2 py-1.5 rounded hover:surface-raised">
                <span className="t-small">Focus query input</span>
                <Kbd>/</Kbd>
              </div>
              <div className="flex items-center justify-between px-2 py-1.5 rounded hover:surface-raised">
                <span className="t-small">Close / blur</span>
                <Kbd>Esc</Kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <span className="flex gap-1">
      {children.split(" ").map((k, i) => (
        <kbd
          key={i}
          className="px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold border surface-raised"
          style={{
            borderColor: "var(--border-strong)",
            color: "var(--ink-2)"
          }}
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}
