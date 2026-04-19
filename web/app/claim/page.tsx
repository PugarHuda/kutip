"use client";

import { useState } from "react";
import Link from "next/link";
import { Addr } from "@/components/ui";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";

const EXAMPLE_ORCID = "0000-0001-1234-0001";

type Status =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "connected"; address: string }
  | { kind: "signing"; address: string }
  | { kind: "submitting"; address: string }
  | { kind: "bound"; address: string; name: string }
  | { kind: "error"; message: string };

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

function eth(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { ethereum?: EthereumProvider };
  return w.ethereum ?? null;
}

export default function ClaimPage() {
  const [orcid, setOrcid] = useState(EXAMPLE_ORCID);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function connect() {
    const provider = eth();
    if (!provider) {
      setStatus({ kind: "error", message: "MetaMask (or compatible wallet) not detected." });
      return;
    }
    setStatus({ kind: "connecting" });
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts?.[0]) throw new Error("no account returned");
      setStatus({ kind: "connected", address: accounts[0] });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "wallet connect rejected"
      });
    }
  }

  async function signAndSubmit() {
    const provider = eth();
    if (!provider || status.kind !== "connected") return;
    const wallet = status.address;
    const message = buildMessage(orcid, wallet);

    setStatus({ kind: "signing", address: wallet });
    try {
      const signature = (await provider.request({
        method: "personal_sign",
        params: [message, wallet]
      })) as string;

      setStatus({ kind: "submitting", address: wallet });
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orcid, wallet, signature })
      });
      const data = (await res.json()) as {
        ok?: boolean;
        bound?: { name: string };
        error?: string;
        hint?: string;
      };

      if (!res.ok || !data.ok) {
        setStatus({
          kind: "error",
          message: data.hint ?? data.error ?? "claim rejected by server"
        });
        return;
      }

      setStatus({ kind: "bound", address: wallet, name: data.bound!.name });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "signing failed"
      });
    }
  }

  const connected =
    status.kind === "connected" ||
    status.kind === "signing" ||
    status.kind === "submitting" ||
    status.kind === "bound";

  return (
    <main className="min-h-[calc(100vh-60px)] px-6 py-12 lg:py-14">
      <div className="max-w-[640px] mx-auto">
        <Link
          href="/leaderboard"
          className="t-small ink-3 hover:ink-2 mb-6 inline-block"
        >
          ← All authors
        </Link>

        <div className="t-caption">Claim your earnings</div>
        <h1 className="t-display-xl mt-1.5 mb-2">Bind your ORCID.</h1>
        <p className="t-body ink-2 max-w-[560px]">
          Every paper Kutip cites routes a share of USDC to the author&apos;s wallet.
          If that&apos;s you, bind your wallet to your ORCID below — from the next
          query onwards, your cut lands in <em>your</em> wallet, not the unclaimed
          placeholder.
        </p>

        <div className="card p-7 mt-8">
          <label className="t-caption block">Step 1 — Connect your wallet</label>
          <button
            type="button"
            onClick={connect}
            disabled={connected || status.kind === "connecting"}
            className="btn btn--primary mt-2.5"
          >
            {connected && "address" in status ? (
              <>
                <CheckIcon size={14} /> Connected · {status.address.slice(0, 6)}…
                {status.address.slice(-4)}
              </>
            ) : status.kind === "connecting" ? (
              "Connecting…"
            ) : (
              <>
                Connect wallet <ArrowRightIcon />
              </>
            )}
          </button>

          <label className="t-caption mt-7 block">Step 2 — Your ORCID</label>
          <input
            type="text"
            value={orcid}
            onChange={(e) => setOrcid(e.target.value)}
            placeholder="0000-0000-0000-0000"
            className="card mt-2 p-3 w-full font-mono text-sm bg-transparent focus:outline-none focus:border-kite-500"
          />
          <div className="t-small ink-3 mt-2">
            For the demo, this has to match an ORCID already in the mock catalog.
            Try <code className="t-mono-sm">0000-0001-1234-0001</code> (Dr. Sarah Chen).
          </div>

          <label className="t-caption mt-7 block">Step 3 — Sign the binding</label>
          <button
            type="button"
            onClick={signAndSubmit}
            disabled={!connected || status.kind === "signing" || status.kind === "submitting" || status.kind === "bound"}
            className="btn btn--primary btn--lg w-full justify-center mt-2.5"
          >
            {status.kind === "signing" && "Sign in your wallet…"}
            {status.kind === "submitting" && "Verifying…"}
            {status.kind === "bound" && (
              <>
                <CheckIcon size={14} /> Bound to {status.name}
              </>
            )}
            {status.kind !== "signing" &&
              status.kind !== "submitting" &&
              status.kind !== "bound" && (
                <>
                  Sign &amp; bind ORCID <ArrowRightIcon />
                </>
              )}
          </button>

          {status.kind === "bound" && (
            <div className="mt-5 p-4 rounded-lg bg-emerald-50 text-[color:var(--emerald-700)] text-sm">
              <strong>{status.name}</strong> is now bound to{" "}
              <Addr>{`${status.address.slice(0, 6)}…${status.address.slice(-4)}`}</Addr>
              . From the next query onwards, citations to their papers pay your wallet.
            </div>
          )}

          {status.kind === "error" && (
            <div className="mt-5 p-4 rounded-lg bg-rose-50 text-[color:var(--rose-700)] text-sm">
              {status.message}
            </div>
          )}
        </div>

        <div className="t-small ink-3 mt-6">
          Demo note · claims live in a per-process map and reset on Vercel cold
          starts. Production would store them in an on-chain NameRegistry contract
          with ORCID DID resolution (ERC-8004 compatible).
        </div>
      </div>
    </main>
  );
}

function buildMessage(orcid: string, wallet: string) {
  const norm = orcid.replace(/\s+/g, "").toUpperCase();
  return `Kutip claim\n\nI verify that I, ORCID ${norm}, own wallet ${wallet.toLowerCase()}.\n\nThis binding controls future USDC payouts from the Kutip attribution ledger.`;
}
