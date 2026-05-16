"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface TickerItem {
  id: string;
  totalPaid: string;
  citationCount: number;
  timestamp: string;
}

function formatUSDC(raw: string): string {
  const v = BigInt(raw);
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, 2);
  return `${whole}.${frac}`;
}

function timeAgo(tsSec: string | number): string {
  const t = typeof tsSec === "string" ? Number(tsSec) : tsSec;
  const s = Math.floor(Date.now() / 1000) - t;
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function ActivityTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    const subgraph = process.env.NEXT_PUBLIC_SUBGRAPH_URL;
    if (!subgraph) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(subgraph!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            query: `{
              attestations(first: 3, orderBy: timestamp, orderDirection: desc) {
                id totalPaid citationCount timestamp
              }
            }`
          })
        });
        if (!res.ok) return;
        const j = (await res.json()) as {
          data?: { attestations?: TickerItem[] };
        };
        if (!cancelled) setItems(j.data?.attestations ?? []);
      } catch {
        /* ignore */
      }
    }

    load();
    const t = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (items.length === 0) return null;

  const last = items[0];
  const total = items.reduce(
    (acc, it) => acc + BigInt(it.totalPaid),
    0n
  );
  const tooltip = items
    .map(
      (it) =>
        `${timeAgo(it.timestamp)} ago · ${it.citationCount} cites · +${formatUSDC(it.totalPaid)} USDT`
    )
    .join("\n");

  return (
    <Link
      href="/dashboard/activity"
      title={tooltip}
      className="block px-4 py-3 border-t border-token no-underline text-inherit hover:surface-raised transition-colors"
    >
      <div className="flex items-center justify-between gap-2 t-mono-sm">
        <span className="flex items-center gap-1.5 ink-3 truncate">
          <span
            className="status-dot status-dot--done animate-pulse-dot"
            style={{ width: 5, height: 5 }}
          />
          Last attestation · {timeAgo(last.timestamp)} ago
        </span>
        <span className="text-emerald-700 font-semibold">
          +{formatUSDC(total.toString())}
        </span>
      </div>
    </Link>
  );
}
