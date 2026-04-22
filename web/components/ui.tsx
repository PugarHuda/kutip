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

export function Skeleton({
  className = "",
  style
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`block rounded-[6px] animate-skeleton-shimmer ${className}`}
      style={{
        background:
          "linear-gradient(90deg, color-mix(in srgb, var(--ink) 5%, transparent), color-mix(in srgb, var(--ink) 12%, transparent), color-mix(in srgb, var(--ink) 5%, transparent))",
        backgroundSize: "200% 100%",
        ...style
      }}
    />
  );
}

export function Breadcrumb({
  items
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav
      aria-label="breadcrumb"
      className="t-small ink-3 flex items-center gap-1.5 flex-wrap"
    >
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {item.href && !last ? (
              <a
                href={item.href}
                className="hover:text-kite-500 transition-colors"
              >
                {item.label}
              </a>
            ) : (
              <span
                className={last ? "text-[color:var(--ink)] font-medium" : ""}
              >
                {item.label}
              </span>
            )}
            {!last && <span className="ink-4">›</span>}
          </span>
        );
      })}
    </nav>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  cta
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="card p-10 flex flex-col items-center text-center animate-fade-up">
      {icon && (
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{
            background: "color-mix(in srgb, var(--kite-500) 10%, transparent)",
            color: "var(--kite-500)"
          }}
        >
          {icon}
        </div>
      )}
      <h3 className="t-h2 m-0">{title}</h3>
      <p className="t-body ink-2 max-w-[480px] mt-2 mb-0">{body}</p>
      {cta && (
        <a href={cta.href} className="btn btn--primary mt-5">
          {cta.label}
        </a>
      )}
    </div>
  );
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
