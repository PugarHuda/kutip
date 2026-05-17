"use client";

import { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt
} from "wagmi";
import { parseUnits } from "viem";
import { kiteTestnet, KITE_TESTNET_USDC } from "@/lib/kite";

/**
 * Fund the agent from the user's own wallet.
 *
 * The funding-model rewire: instead of the operator pre-funding the
 * Researcher AA, the user tops it up directly from their connected
 * wallet. The agent then runs research on the user's money, bounded by
 * the spending session they signed. Operator pre-funding still works as
 * a fallback, so the demo never depends on this.
 */

const RESEARCHER_AA = "0x4da7f4cFd443084027a39cc0f7c41466d9511776" as const;

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" }
    ],
    outputs: [{ type: "bool" }]
  }
] as const;

const PRESETS = [1, 2, 5] as const;

export function FundAgent() {
  const { isConnected } = useAccount();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("2");

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash
  });

  function fund() {
    const n = parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0 || n > 1000) return;
    writeContract({
      chainId: kiteTestnet.id,
      address: KITE_TESTNET_USDC,
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [RESEARCHER_AA, parseUnits(n.toFixed(6), 18)]
    });
  }

  if (!isConnected) {
    return (
      <div className="mt-2.5 pt-2.5 border-t border-token">
        <div className="t-small ink-3">
          Connect a wallet to fund the agent from your own balance.
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="mt-2.5 pt-2.5 border-t border-token">
        <div className="t-small text-emerald-700 font-medium">
          ✓ Agent funded from your wallet
        </div>
        <div className="t-mono-sm ink-3 mt-0.5">
          Balance refreshes within ~30s.{" "}
          <button
            type="button"
            className="text-kite-700 hover:text-kite-500"
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            Fund again
          </button>
        </div>
      </div>
    );
  }

  const busy = isPending || confirming;

  return (
    <div className="mt-2.5 pt-2.5 border-t border-token">
      {!open ? (
        <button
          type="button"
          className="btn btn--ghost btn--sm w-full justify-center"
          onClick={() => setOpen(true)}
        >
          Fund agent from your wallet
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="t-small ink-2">
            Send USDC to the agent&apos;s smart account — it researches on
            your funds, within your session caps.
          </div>
          <div className="flex gap-1.5">
            {PRESETS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(String(v))}
                className="flex-1 h-8 rounded-md t-mono-sm font-semibold transition-colors"
                style={
                  amount === String(v)
                    ? { background: "var(--kite-500)", color: "#fff" }
                    : {
                        border: "1px solid var(--border)",
                        background: "var(--surface)"
                      }
                }
              >
                {v}
              </button>
            ))}
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 8))
              }
              aria-label="USDC amount to fund"
              className="card flex-1 h-8 px-2 font-mono text-[12px] bg-transparent focus:outline-none focus:border-kite-500"
            />
          </div>
          <button
            type="button"
            className="btn btn--primary btn--sm w-full justify-center"
            disabled={busy}
            onClick={fund}
          >
            {isPending
              ? "Confirm in wallet…"
              : confirming
              ? "Settling on Kite…"
              : `Send ${amount} USDC to agent`}
          </button>
        </div>
      )}
    </div>
  );
}
