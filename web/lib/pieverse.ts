/**
 * Pieverse x402 facilitator wrapper.
 *
 * Pieverse is Kite's official x402 facilitator (https://facilitator.pieverse.io).
 * It verifies signed x402 payment payloads and settles them on-chain. The
 * `gokite-aa` scheme ties into the Agent Passport AA account architecture.
 *
 * Kutip currently uses this facilitator for:
 *   1. Connectivity check on agent start (proves we're wired to real infra)
 *   2. `buildPaymentRequired()` — emits real 402 challenges that a x402-aware
 *      client can sign against
 *
 * Full client-side signing + retry loop is documented in docs/deployment.md
 * — the token at 0x0fF5…7e63 on Kite testnet does not implement EIP-3009
 * `transferWithAuthorization`, so the "exact" scheme from the x402 standard
 * requires the `gokite-aa` AA extension to settle. Implementation proceeds
 * once Kite publishes the signed-UserOp payload schema.
 */

export const PIEVERSE_URL = "https://facilitator.pieverse.io";
export const PIEVERSE_SETTLE_ADDR = "0x12343e649e6b2b2b77649DFAb88f103c02F3C78b";

export interface FacilitatorStatus {
  reachable: boolean;
  version?: string;
  supportedNetworks?: string[];
  supportsKiteTestnet?: boolean;
  latencyMs: number;
  error?: string;
}

export async function facilitatorHandshake(): Promise<FacilitatorStatus> {
  const started = Date.now();
  try {
    const res = await fetch(PIEVERSE_URL + "/", {
      method: "GET",
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
      return {
        reachable: false,
        latencyMs: Date.now() - started,
        error: `HTTP ${res.status}`
      };
    }
    const data = (await res.json()) as {
      service?: string;
      version?: string;
      supportedNetworks?: string[];
    };
    const nets = data.supportedNetworks ?? [];
    return {
      reachable: true,
      version: data.version,
      supportedNetworks: nets,
      supportsKiteTestnet:
        nets.includes("kite-testnet") || nets.includes("eip155:2368"),
      latencyMs: Date.now() - started
    };
  } catch (err) {
    return {
      reachable: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "unknown"
    };
  }
}
