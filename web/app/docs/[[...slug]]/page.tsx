import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandMark } from "@/components/icons";
import { DocsMarkdown } from "@/components/docs-markdown";

export const dynamic = "force-static";

// Docs folder lives at the repo root, one level above web/.
const DOCS_DIR = resolve(process.cwd(), "../docs");

/**
 * Sidebar chapter tree. Mirrors docs/SUMMARY.md but curated to the
 * product-facing pages (submission artefacts like demo-script live in
 * the repo but aren't useful in an in-app docs reader).
 *
 * `file` is the markdown filename in docs/; `slug` is the URL segment
 * ("" = the /docs index, which renders README.md).
 */
const NAV: { section: string; items: { slug: string; file: string; label: string }[] }[] = [
  {
    section: "Start here",
    items: [
      { slug: "", file: "README.md", label: "Introduction" },
      { slug: "architecture", file: "architecture.md", label: "Architecture" }
    ]
  },
  {
    section: "Using Kutip",
    items: [
      { slug: "usage", file: "usage.md", label: "Usage guide" },
      { slug: "integrate", file: "integrate.md", label: "Integrate / API" }
    ]
  },
  {
    section: "How it works",
    items: [
      { slug: "agent-passport", file: "agent-passport.md", label: "Agent Passport" },
      { slug: "gasless-alignment", file: "gasless-alignment.md", label: "Gasless flow" }
    ]
  },
  {
    section: "Trust & ops",
    items: [
      { slug: "security", file: "security.md", label: "Security model" },
      { slug: "testing", file: "testing.md", label: "Testing" },
      { slug: "deployment", file: "deployment.md", label: "Deployment" }
    ]
  }
];

const ALL_ITEMS = NAV.flatMap((s) => s.items);

export function generateStaticParams() {
  return ALL_ITEMS.map((i) => ({ slug: i.slug ? [i.slug] : [] }));
}

/**
 * Rewrites markdown links so they resolve inside the /docs route:
 *   architecture.md         → /docs/architecture
 *   ./security.md           → /docs/security
 *   ../README.md            → /  (repo root readme = landing)
 *   ../mcp/README.md        → GitHub (lives outside docs/)
 * External http links are left untouched.
 */
function rewriteLinks(md: string): string {
  return md.replace(/\]\((?!https?:\/\/)([^)]+)\)/g, (_m, href: string) => {
    const clean = href.replace(/^\.\//, "");
    if (clean === "../README.md") return "](/)";
    if (clean.startsWith("../mcp/")) {
      return "](https://github.com/PugarHuda/kutip/tree/main/mcp)";
    }
    if (clean.startsWith("../")) {
      return `](https://github.com/PugarHuda/kutip/tree/main/${clean.slice(3)})`;
    }
    const base = clean.replace(/\.md(#.*)?$/, "$1");
    if (base === "README" || base === "README.md") return "](/docs)";
    // Anchor-only links (#section) stay as-is.
    if (base.startsWith("#")) return `](${base})`;
    return `](/docs/${base})`;
  });
}

export default function DocsPage({
  params
}: {
  params: { slug?: string[] };
}) {
  // Reject multi-segment URLs (/docs/security/extra) — they'd otherwise
  // render the security page at a non-canonical path (duplicate content,
  // wrong nav-active state).
  if ((params.slug?.length ?? 0) > 1) notFound();
  const slug = params.slug?.[0] ?? "";
  const entry = ALL_ITEMS.find((i) => i.slug === slug);
  if (!entry) notFound();

  const filePath = resolve(DOCS_DIR, entry.file);
  if (!existsSync(filePath)) notFound();
  const raw = readFileSync(filePath, "utf-8");
  const content = rewriteLinks(raw);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — GitBook-style chapter tree. */}
      <aside
        className="hidden lg:flex flex-col flex-none w-[260px] border-r border-token surface sticky top-0 h-screen overflow-y-auto"
      >
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-4 border-b border-token no-underline text-inherit"
        >
          <BrandMark size={20} />
          <span className="font-display text-[16px] font-bold">Kutip</span>
          <span className="t-caption ml-auto">docs</span>
        </Link>
        <nav className="px-3 py-4 flex-1">
          {NAV.map((sec) => (
            <div key={sec.section} className="mb-4">
              <div className="t-caption px-3 pb-1.5">{sec.section}</div>
              {sec.items.map((it) => {
                const active = it.slug === slug;
                return (
                  <Link
                    key={it.slug || "index"}
                    href={it.slug ? `/docs/${it.slug}` : "/docs"}
                    aria-current={active ? "page" : undefined}
                    className="block px-3 py-1.5 rounded-md text-[13.5px] no-underline transition-colors"
                    style={
                      active
                        ? {
                            background:
                              "color-mix(in srgb, var(--kite-500) 12%, transparent)",
                            color: "var(--kite-700)",
                            fontWeight: 600
                          }
                        : { color: "var(--ink-2)" }
                    }
                  >
                    {it.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="px-5 py-3 border-t border-token flex items-center justify-between">
          <Link href="/" className="t-small ink-3 hover:text-kite-500">
            ← Home
          </Link>
          <a
            href="https://github.com/PugarHuda/kutip/tree/main/docs"
            target="_blank"
            rel="noreferrer"
            className="t-mono-sm ink-3 hover:text-kite-500"
          >
            GitHub ↗
          </a>
        </div>
      </aside>

      {/* Content. */}
      <main className="flex-1 min-w-0">
        {/* Mobile chapter strip — sidebar is lg-only. */}
        <div className="lg:hidden flex gap-1.5 overflow-x-auto px-5 py-3 border-b border-token surface">
          {ALL_ITEMS.map((it) => (
            <Link
              key={it.slug || "index"}
              href={it.slug ? `/docs/${it.slug}` : "/docs"}
              className="chip flex-none no-underline"
              style={
                it.slug === slug
                  ? { background: "var(--kite-100)", color: "var(--kite-700)" }
                  : undefined
              }
            >
              {it.label}
            </Link>
          ))}
        </div>

        <article className="max-w-[760px] mx-auto px-6 lg:px-10 py-10">
          <DocsMarkdown content={content} />

          <DocsPager slug={slug} />
        </article>
      </main>
    </div>
  );
}

/** Prev / next chapter footer — standard GitBook affordance. */
function DocsPager({ slug }: { slug: string }) {
  const idx = ALL_ITEMS.findIndex((i) => i.slug === slug);
  const prev = idx > 0 ? ALL_ITEMS[idx - 1] : null;
  const next = idx < ALL_ITEMS.length - 1 ? ALL_ITEMS[idx + 1] : null;
  if (!prev && !next) return null;
  return (
    <div className="flex justify-between gap-4 mt-12 pt-6 border-t border-token">
      {prev ? (
        <Link
          href={prev.slug ? `/docs/${prev.slug}` : "/docs"}
          className="card px-4 py-3 no-underline text-inherit hover:surface-raised flex-1"
        >
          <div className="t-caption">← Previous</div>
          <div className="t-small font-semibold mt-0.5">{prev.label}</div>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
      {next ? (
        <Link
          href={next.slug ? `/docs/${next.slug}` : "/docs"}
          className="card px-4 py-3 no-underline text-inherit hover:surface-raised flex-1 text-right"
        >
          <div className="t-caption">Next →</div>
          <div className="t-small font-semibold mt-0.5">{next.label}</div>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
    </div>
  );
}
