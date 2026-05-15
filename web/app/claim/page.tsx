"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAccount, useConnect, useSignMessage } from "wagmi";
import { Addr, Breadcrumb } from "@/components/ui";
import { useToast } from "@/components/toast";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";

interface OauthStatus {
  enabled: boolean;
  demoVerifyAvailable?: boolean;
  verifiedOrcid?: string | null;
  verifiedViaDemo?: boolean;
  exp?: number | null;
}

const EXAMPLE_ORCID = "0000-0002-1825-0097"; // Josiah Carberry — real public test ORCID

// Sub-states beyond what wagmi already tracks for connection. Wagmi
// owns `idle | connecting | connected` via useAccount + useConnect;
// these are the post-connect claim-specific phases.
type SubStatus =
  | { kind: "ready" }
  | { kind: "signing" }
  | { kind: "submitting" }
  | { kind: "bound"; name: string }
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
  const [substatus, setSubstatus] = useState<SubStatus>({ kind: "ready" });
  const [preview, setPreview] = useState<Preview>({ state: "hidden" });
  const [oauth, setOauth] = useState<OauthStatus | null>(null);
  const toast = useToast();

  // Wagmi is the source of truth for wallet connection state. The
  // topbar's ConnectWallet, this page's connect button, and the
  // MyEarningsCard widget all read the same useAccount() — connecting
  // anywhere stays connected everywhere on the next route.
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending: connectPending } = useConnect();
  const { signMessageAsync } = useSignMessage();

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

  async function connectWallet() {
    // Use the first available wagmi connector (typically injected
    // MetaMask). Picks up whatever the topbar offers — same providers,
    // same state, no separate stack.
    const connector = connectors[0];
    if (!connector) {
      setSubstatus({
        kind: "error",
        message: "No wallet connectors configured. Check NEXT_PUBLIC_WAGMI_* env."
      });
      return;
    }
    try {
      await connect({ connector });
    } catch (err) {
      setSubstatus({
        kind: "error",
        message: err instanceof Error ? err.message : "wallet connect rejected"
      });
    }
  }

  async function signAndSubmit() {
    if (!isConnected || !address) return;
    const wallet = address;
    // 10-minute signing window — long enough for slow networks and
    // wallet confirmation, short enough that a leaked signature can't
    // be replayed by an attacker hours later.
    const validUntil = Math.floor(Date.now() / 1000) + 600;
    const message = buildMessage(orcid, wallet, validUntil);

    setSubstatus({ kind: "signing" });
    try {
      const signature = await signMessageAsync({ message });

      setSubstatus({ kind: "submitting" });
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orcid, wallet, signature, validUntil })
      });
      const data = (await res.json()) as {
        ok?: boolean;
        bound?: { name: string };
        error?: string;
        hint?: string;
      };

      if (!res.ok || !data.ok) {
        setSubstatus({
          kind: "error",
          message: data.hint ?? data.error ?? "claim rejected by server"
        });
        return;
      }

      setSubstatus({ kind: "bound", name: data.bound!.name });
      const bindTx = (data.bound as { bindTx?: string } | undefined)?.bindTx;
      toast.push({
        kind: "success",
        message: `Bound ORCID → ${data.bound!.name}`,
        detail: `Wallet ${wallet.slice(0, 6)}…${wallet.slice(-4)} · future citations will pay here.`,
        href: bindTx ? `https://testnet.kitescan.ai/tx/${bindTx}` : undefined,
        hrefLabel: bindTx ? "View binding tx" : undefined
      });
    } catch (err) {
      setSubstatus({
        kind: "error",
        message: err instanceof Error ? err.message : "signing failed"
      });
    }
  }

  // Derived flags so the JSX stays declarative.
  const connected = isConnected && !!address;
  const connecting = connectPending;

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
            onClick={connectWallet}
            disabled={connected || connecting}
            className="btn btn--primary mt-2.5"
          >
            {connected && address ? (
              <>
                <CheckIcon size={14} /> Connected · {address.slice(0, 6)}…
                {address.slice(-4)}
              </>
            ) : connecting ? (
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
            onChange={(e) => {
              setOrcid(e.target.value);
              // Editing the ORCID after a bind/error leaves the button
              // stuck on the old outcome — reset to ready so a second
              // claim can start without a page reload.
              if (substatus.kind === "bound" || substatus.kind === "error") {
                setSubstatus({ kind: "ready" });
              }
            }}
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
                  <CheckIcon size={14} />
                  <span>
                    {oauth?.verifiedViaDemo ? "Demo-verified as " : "Signed in as "}
                    <strong>{oauth?.verifiedOrcid}</strong>
                  </span>
                </div>
              ) : (
                <>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <a
                      href={`/api/auth/orcid/authorize?orcid=${encodeURIComponent(
                        normalizedOrcid
                      )}&returnTo=/claim`}
                      className="btn btn--primary inline-flex"
                    >
                      Verify via ORCID <ArrowRightIcon />
                    </a>
                    {oauth?.demoVerifyAvailable && (
                      <a
                        href={`/api/auth/orcid/demo-verify?orcid=${encodeURIComponent(
                          normalizedOrcid
                        )}&returnTo=/claim`}
                        className="btn btn--ghost inline-flex"
                        title="Skip ORCID OAuth — for hackathon judges who don't have an ORCID account"
                      >
                        Skip OAuth (demo) <ArrowRightIcon />
                      </a>
                    )}
                  </div>
                  <div className="t-small ink-3 mt-2">
                    {oauth?.demoVerifyAvailable ? (
                      <>
                        Real path redirects to orcid.org to prove you own{" "}
                        <span className="t-mono-sm">{normalizedOrcid}</span>.
                        Demo path skips OAuth — wallet binding is still real
                        on-chain.
                      </>
                    ) : (
                      <>
                        Redirects to orcid.org to prove you own{" "}
                        <span className="t-mono-sm">{normalizedOrcid}</span>.
                      </>
                    )}
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
              {orcidVerified && oauth?.verifiedViaDemo && (
                <div className="mt-3 p-3 rounded-lg border border-dashed border-amber-400 bg-amber-50 text-[color:var(--amber-700,#92400e)] text-xs">
                  <strong>Demo mode:</strong> identity is mocked (skipped real
                  ORCID OAuth), but the wallet binding below still writes to the
                  real on-chain registry — anyone can verify it.
                </div>
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
              substatus.kind === "signing" ||
              substatus.kind === "submitting" ||
              substatus.kind === "bound"
            }
            className="btn btn--primary btn--lg w-full justify-center mt-2.5"
          >
            {substatus.kind === "signing" && "Sign in your wallet…"}
            {substatus.kind === "submitting" && "Verifying…"}
            {substatus.kind === "bound" && (
              <>
                <CheckIcon size={14} /> Bound to {substatus.name}
              </>
            )}
            {substatus.kind !== "signing" &&
              substatus.kind !== "submitting" &&
              substatus.kind !== "bound" && (
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

          {substatus.kind === "bound" && address && (
            <div className="mt-5 p-4 rounded-lg bg-emerald-50 text-[color:var(--emerald-700)] text-sm">
              <strong>{substatus.name}</strong> is now bound to{" "}
              <Addr>{`${address.slice(0, 6)}…${address.slice(-4)}`}</Addr>
              . From the next query onwards, citations to their papers pay your wallet.
            </div>
          )}

          {substatus.kind === "error" && (
            <div className="mt-5 p-4 rounded-lg bg-rose-50 text-[color:var(--rose-700)] text-sm">
              {substatus.message}
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

// Mirror of server-side buildClaimMessage in lib/claim-registry.ts.
// Kept inline to avoid pulling node-only deps (ethers, RPC client) into
// the client bundle. Format MUST stay byte-identical to the server's
// reconstruction — any divergence will produce signature-mismatch 401s.
function buildMessage(orcid: string, wallet: string, validUntil: number) {
  const norm = orcid.replace(/\s+/g, "").toUpperCase();
  return [
    "Kutip claim",
    "v1",
    "",
    `I verify that I, ORCID ${norm}, own wallet ${wallet.toLowerCase()}.`,
    "",
    `chainId: 2368`,
    `validUntil: ${validUntil}`,
    "",
    "This binding controls future USDC payouts from the Kutip attribution ledger."
  ].join("\n");
}
