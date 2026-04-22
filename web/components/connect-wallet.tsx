"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { kiteTestnet } from "@/lib/kite";
import { CheckIcon, CopyIcon } from "./icons";

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectWallet() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [open, setOpen] = useState(false);

  if (!mounted) {
    return <div className="addr inline-flex opacity-0" aria-hidden />;
  }

  if (!isConnected || !address) {
    const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
    return (
      <button
        type="button"
        className="addr inline-flex"
        disabled={isPending || !injected}
        onClick={() => injected && connect({ connector: injected })}
      >
        <span className="hidden sm:inline">
          {isPending ? "Connecting…" : "Connect wallet"}
        </span>
        <span className="sm:hidden">
          {isPending ? "…" : "Connect"}
        </span>
      </button>
    );
  }

  const wrongChain = chainId !== kiteTestnet.id;

  if (wrongChain) {
    return (
      <button
        type="button"
        className="addr inline-flex"
        style={{ background: "color-mix(in srgb, var(--kite-500) 10%, transparent)" }}
        onClick={() => switchChain({ chainId: kiteTestnet.id })}
      >
        <span className="hidden sm:inline">Switch to Kite testnet</span>
        <span className="sm:hidden">Switch</span>
      </button>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="addr"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="status-dot status-dot--done" style={{ width: 6, height: 6 }} />
        {short(address)}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 card p-2 min-w-[220px] max-w-[calc(100vw-24px)] shadow-lg z-50"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="px-2.5 py-2 border-b border-token">
            <div className="t-caption">Connected</div>
            <div className="t-mono-sm ink-2 break-all mt-0.5">{address}</div>
          </div>
          <button
            type="button"
            className="w-full text-left px-2.5 py-2 text-sm hover:surface-raised rounded flex items-center gap-2"
            onClick={() => {
              navigator.clipboard?.writeText(address);
              setOpen(false);
            }}
          >
            <CopyIcon /> Copy address
          </button>
          <a
            href={`https://testnet.kitescan.ai/address/${address}`}
            target="_blank"
            rel="noreferrer"
            className="block px-2.5 py-2 text-sm hover:surface-raised rounded flex items-center gap-2"
            onClick={() => setOpen(false)}
          >
            <CheckIcon size={12} /> View on KiteScan
          </a>
          <button
            type="button"
            className="w-full text-left px-2.5 py-2 text-sm hover:surface-raised rounded text-rose-600"
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
