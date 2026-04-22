"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Addr, Breadcrumb } from "@/components/ui";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";

interface OauthStatus {
  enabled: boolean;
  verifiedOrcid?: string | null;
  exp?: number | null;
}

const EXAMPLE_ORCID = "0000-0002-1825-0097"; // Josiah Carberry — real public test ORCID

type Status =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "connected"; address: string }
  | { kind: "signing"; address: string }
  | { kind: "submitting"; address: string }
  | { kind: "bound"; address: string; name: string }
  | { kind: "error"; message: string };

type Preview =
  | { state: "hidden" }
  | { state: "loading" }
  | {
      state: "real";
      name: string;
      biography?: string;
      worksCount?: number;
      matchesCatalog: boolean;
    }
  | { state: "catalog"; name: string; affiliation: string }
  | { state: "invalid"; message: string }
  | { state: "unknown"; message: string };

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

function eth(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { ethereum?: EthereumProvider };
  return w.ethereum ?? null;
}

const ORCID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

export default function ClaimPageWrapper() {
  return (
    <Suspense fallback={<div className="px-6 py-14 text-center">Loading…</div>}>
      <ClaimPage />
    </Suspense>
  );
}

function ClaimPage() {
  const searchParams = useSearchParams();
  const prefill = searchParams.get("orcid") ?? searchParams.get("verified");
  const [orcid, setOrcid] = useState(prefill ?? EXAMPLE_ORCID);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [preview, setPreview] = useState<Preview>({ state: "hidden" });
  const [oauth, setOauth] = useState<OauthStatus | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/auth/orcid/status", { cache: "no-store" });
        if (!res.ok) return;
        setOauth(await res.json());
      } catch {
        /* ignore */
      }
    }
    load();
  }, []);

  useEffect(() => {
    const normalized = orcid.replace(/\s+/g, "").toUpperCase();
    if (!normalized) {
      setPreview({ state: "hidden" });
      return;
    }
    if (!ORCID_PATTERN.test(normalized)) {
      setPreview({ state: "invalid", message: "Expected 0000-0000-0000-0000 format" });
      return;
    }

    let cancelled = false;
    setPreview({ state: "loading" });
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/orcid-check?orcid=${encodeURIComponent(normalized)}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "real") {
          setPreview({
            state: "real",
            name: data.name ?? "Unnamed researcher",
            biography: data.biography,
            worksCount: data.worksCount,
            matchesCatalog: Boolean(data.matchesCatalog)
          });
        } else if (data.status === "catalog") {
          setPreview({
            state: "catalog",
            name: data.name,
            affiliation: data.affiliation ?? ""
          });
        } else {
          setPreview({
            state: "unknown",
            message: data.error ?? "ORCID not verifiable"
          });
        }
      } catch {
        if (!cancelled) {
          setPreview({ state: "unknown", message: "lookup failed — network?" });
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [orcid]);

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

  const normalizedOrcid = orcid.replace(/\s+/g, "").toUpperCase();
  const oauthRequired = oauth?.enabled === true;
  const orcidVerified =
    !oauthRequired ||
    (oauth?.verifiedOrcid?.toUpperCase() === normalizedOrcid);
  const canSign =
    connected &&
    (preview.state === "real" || preview.state === "catalog") &&
    orcidVerified;

  return (
    <main className="min-h-[calc(100vh-60px)] px-6 py-12 lg:py-14">
      <div className="max-w-[640px] mx-auto">
        <div className="mb-6">
          <Breadcrumb
            items={[
              { label: "Registry", href: "/registry" },
              { label: "Claim earnings" }
            ]}
          />
        </div>

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
          <OrcidPreview preview={preview} />

          {oauthRequired && (
            <>
              <label className="t-caption mt-7 block">
                Step 3 — Prove ownership via ORCID
              </label>
              {orcidVerified ? (
                <div className="mt-2.5 p-3 rounded-lg border border-[color:var(--emerald-500)] bg-[color:var(--emerald-50)] text-[color:var(--emerald-700)] text-sm flex items-center gap-2">
                  <CheckIcon size={14} /> Signed in as{" "}
                  <strong>{oauth?.verifiedOrcid}</strong>
                </div>
              ) : (
                <>
                  <a
                    href={`/api/auth/orcid/authorize?orcid=${encodeURIComponent(
                      normalizedOrcid
                    )}&returnTo=/claim`}
                    className="btn btn--primary mt-2.5 inline-flex"
                  >
                    Verify via ORCID <ArrowRightIcon />
                  </a>
                  <div className="t-small ink-3 mt-2">
                    Redirects to orcid.org to prove you own{" "}
                    <span className="t-mono-sm">{normalizedOrcid}</span>.
                  </div>
                  {oauth?.verifiedOrcid &&
                    oauth.verifiedOrcid.toUpperCase() !== normalizedOrcid && (
                      <div className="t-small mt-2 text-rose-600">
                        You signed in as {oauth.verifiedOrcid} — switch the
                        field above to that ORCID, or sign in again.
                      </div>
                    )}
                </>
              )}
            </>
          )}

          {!oauthRequired && (
            <div className="mt-7 p-3 rounded-lg border border-dashed border-amber-400 bg-amber-50 text-[color:var(--amber-700,#92400e)] text-sm">
              <strong>Demo mode:</strong> ORCID OAuth is not configured. This
              flow proves wallet ownership via ECDSA but does not yet prove
              ORCID ownership. Set <span className="t-mono-sm">ORCID_CLIENT_ID</span>{" "}
              and <span className="t-mono-sm">ORCID_CLIENT_SECRET</span> to
              enable full verification.
            </div>
          )}

          <label className="t-caption mt-7 block">
            Step {oauthRequired ? "4" : "3"} — Sign the binding
          </label>
          <button
            type="button"
            onClick={signAndSubmit}
            disabled={
              !canSign ||
              status.kind === "signing" ||
              status.kind === "submitting" ||
              status.kind === "bound"
            }
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

          {!canSign && connected && preview.state !== "loading" && (
            <div className="t-small ink-3 mt-2.5">
              Verify your ORCID above first — the button lights up when it resolves.
            </div>
          )}

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
          Try <code className="t-mono-sm">0000-0002-1825-0097</code> (Josiah Carberry —
          public ORCID test record) or a catalog ID like{" "}
          <code className="t-mono-sm">0000-0001-1234-0001</code> (demo-only).
          Production would store claims in an on-chain NameRegistry (ERC-8004 compatible)
          instead of the per-process map we use here.
        </div>
      </div>
    </main>
  );
}

function OrcidPreview({ preview }: { preview: Preview }) {
  if (preview.state === "hidden") return null;
  if (preview.state === "loading") {
    return (
      <div className="mt-2 t-small ink-3 animate-breathe">Looking up on orcid.org…</div>
    );
  }
  if (preview.state === "invalid") {
    return <div className="mt-2 t-small ink-3">{preview.message}</div>;
  }
  if (preview.state === "unknown") {
    return (
      <div className="mt-2 p-3 rounded-md border border-amber-500/30 bg-amber-50 text-[color:var(--amber-700)] text-sm">
        {preview.message}
      </div>
    );
  }
  if (preview.state === "real") {
    return (
      <div className="mt-2 p-3 rounded-md border border-emerald-500/30 bg-emerald-50 text-[color:var(--emerald-700)] text-sm">
        <div className="flex items-center justify-between">
          <strong>{preview.name}</strong>
          <span
            className="chip chip--success"
            style={{ padding: "1px 8px", fontSize: 10 }}
          >
            Verified · orcid.org
          </span>
        </div>
        <div className="t-small mt-1 text-[color:var(--ink-2)]">
          {typeof preview.worksCount === "number" && (
            <>
              {preview.worksCount} works published ·{" "}
            </>
          )}
          {preview.matchesCatalog
            ? "matches a paper in the Kutip catalog"
            : "new to the Kutip catalog — you can still claim"}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-2 p-3 rounded-md border border-kite-500/30 bg-kite-500/5 text-sm">
      <div className="flex items-center justify-between">
        <strong>{preview.name}</strong>
        <span className="chip" style={{ padding: "1px 8px", fontSize: 10 }}>
          Demo catalog
        </span>
      </div>
      {preview.affiliation && (
        <div className="t-small ink-2 mt-1">{preview.affiliation}</div>
      )}
    </div>
  );
}

function buildMessage(orcid: string, wallet: string) {
  const norm = orcid.replace(/\s+/g, "").toUpperCase();
  return `Kutip claim\n\nI verify that I, ORCID ${norm}, own wallet ${wallet.toLowerCase()}.\n\nThis binding controls future USDC payouts from the Kutip attribution ledger.`;
}
