"use client";

import { useState } from "react";

export function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);

  async function connect() {
    if (typeof window === "undefined") return;
    const eth = (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<string[]> } }).ethereum;
    if (!eth) {
      alert("Install MetaMask to connect");
      return;
    }
    const accounts = await eth.request({ method: "eth_requestAccounts" });
    setAddress(accounts[0]);
  }

  if (address) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-kite-500/10 text-kite-700 text-sm font-mono">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        {address.slice(0, 6)}...{address.slice(-4)}
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      className="px-4 py-1.5 rounded-lg bg-kite-500 text-white text-sm font-semibold hover:bg-kite-700"
    >
      Connect wallet
    </button>
  );
}
