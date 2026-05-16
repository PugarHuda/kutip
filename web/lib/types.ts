export interface Citation {
  paperId: string;
  authorWallets: string[];
  weightBps: number;
}

/** Publication-year window for paper discovery. Either bound is
 *  optional — `{from: 2020}` means 2020-onward, `{to: 2015}` means
 *  up to 2015, `{from, to}` a closed range, `undefined` all years. */
export interface YearRange {
  from?: number;
  to?: number;
}

export interface ResearchResult {
  queryId: string;
  query: string;
  summary: string;
  citations: Citation[];
  totalPaidUSDC: number;
  attestationTx?: string;
  attestationMode?: "aa" | "eoa";
  attestationPayer?: string;
  subAgentAddress?: string;
  subAgentFeeUSDC?: string;
  sessionId?: string;
  sessionDelegator?: string;
  sessionNewSpentToday?: string;
  mirrorTx?: string;
  mirrorChain?: number;
  mirrorExplorer?: string;
  paperDetails: {
    id: string;
    title: string;
    link: string;
    authors: { name: string; wallet: string; share: number }[];
    journalYear: string;
  }[];
}

export interface AgentStep {
  step: number;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
}

export type AgentEvent =
  | { type: "step"; step: AgentStep }
  | { type: "result"; result: ResearchResult }
  | { type: "error"; message: string };
