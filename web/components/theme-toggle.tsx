"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = (localStorage.getItem("kutip-theme") as Theme | null) ?? "light";
    setTheme(stored);
    document.documentElement.setAttribute("data-theme", stored);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("kutip-theme", next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn--ghost btn--sm"
      style={{ padding: "0 10px", height: 32, gap: 6 }}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <SunIcon />
      ) : theme === "light" ? (
        <MoonIcon />
      ) : (
        <MoonIcon />
      )}
      <span className="t-small" style={{ fontSize: 12 }}>
        {theme === "dark" ? "Light" : "Dark"}
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M13 3l-1 1M4 12l-1 1M13 13l-1-1M4 4 3 3" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 10.5A5.5 5.5 0 1 1 5.5 3c.3 0 .6 0 .8.1A4 4 0 0 0 13 10.5Z" />
    </svg>
  );
}
