import { CopyIcon, ExternalLinkIcon } from "./icons";

export function Addr({
  children,
  full,
  href
}: {
  children: React.ReactNode;
  full?: string;
  href?: string;
}) {
  const content = (
    <>
      {children}
      <CopyIcon />
    </>
  );
  if (href) {
    return (
      <a className="addr" href={href} target="_blank" rel="noreferrer" title={full}>
        {content}
      </a>
    );
  }
  return (
    <span className="addr" title={full}>
      {content}
    </span>
  );
}

export function Tx({ hash, href }: { hash: string; href?: string }) {
  return (
    <a className="tx" href={href ?? "#"} target="_blank" rel="noreferrer">
      <span>{hash}</span>
      <ExternalLinkIcon size={11} />
    </a>
  );
}

export function StatTile({
  label,
  value,
  delta,
  mono = true,
  big = false,
  accent = "kite"
}: {
  label: string;
  value: React.ReactNode;
  delta?: React.ReactNode;
  mono?: boolean;
  big?: boolean;
  accent?: "kite" | "emerald";
}) {
  const color = accent === "emerald" ? "text-emerald-700" : "text-kite-700";
  return (
    <div className="card p-5">
      <div className="t-caption">{label}</div>
      <div
        className={`${mono ? "t-mono" : ""} ${color} mt-1 font-semibold`}
        style={{
          fontSize: big ? 36 : 30,
          lineHeight: big ? "42px" : "36px",
          letterSpacing: "-0.015em"
        }}
      >
        {value}
      </div>
      {delta && <div className="t-small ink-3 mt-1">{delta}</div>}
    </div>
  );
}

export function StatusDot({
  status,
  pulse = false
}: {
  status: "pending" | "running" | "done" | "error";
  pulse?: boolean;
}) {
  return (
    <span
      className={`status-dot status-dot--${status} ${pulse ? "animate-pulse-dot" : ""}`}
      aria-hidden="true"
    />
  );
}

export function Cite({ n }: { n: number }) {
  return <span className="cite">{n}</span>;
}

export interface PayoutRowProps {
  name: string;
  affiliation: string;
  wallet: string;
  walletFull?: string;
  walletHref?: string;
  amount: string;
  tx: string;
  txHref?: string;
  top?: boolean;
  index?: number;
}

export function PayoutRow({
  name,
  affiliation,
  wallet,
  walletFull,
  walletHref,
  amount,
  tx,
  txHref,
  top,
  index = 0
}: PayoutRowProps) {
  const style = { animationDelay: `${index * 40}ms` };
  const amountColor = top ? "text-emerald-700" : "text-[var(--ink)]";
  return (
    <div
      className={`payout ${top ? "payout--top" : ""} animate-fade-up`}
      style={style}
    >
      <div>
        <div className="t-serif text-[17px]">{name}</div>
        <div className="text-[12px] mt-0.5 ink-3 font-normal normal-case tracking-normal">
          {affiliation}
        </div>
      </div>
      <div>
        <Addr full={walletFull} href={walletHref}>
          {wallet}
        </Addr>
      </div>
      <div
        className={`t-mono text-[15px] font-semibold text-right ${amountColor}`}
      >
        + {amount}
      </div>
      <div className="text-right">
        <Tx hash={tx} href={txHref} />
      </div>
    </div>
  );
}
