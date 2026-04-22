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

  return (
    <div className="px-4 py-3 border-t border-token">
      <div className="t-caption flex items-center justify-between mb-1.5">
        <span>Live activity</span>
        <Link
          href="/dashboard/activity"
          className="t-mono-sm ink-3 hover:text-kite-500"
        >
          all →
        </Link>
      </div>
      <div className="space-y-1.5">
        {items.map((it) => (
          <Link
            key={it.id}
            href={`/dashboard/verify/${it.id}`}
            className="flex items-center justify-between gap-2 t-mono-sm no-underline ink-2 hover:text-kite-700 transition-colors"
          >
            <span className="flex items-center gap-1.5 truncate">
              <span
                className="status-dot status-dot--done"
                style={{ width: 5, height: 5 }}
              />
              <span className="ink-3">{timeAgo(it.timestamp)}</span>
            </span>
            <span className="text-emerald-700 font-semibold">
              +{formatUSDC(it.totalPaid)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
