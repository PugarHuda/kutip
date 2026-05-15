"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * GitBook-flavoured markdown renderer for the in-app /docs route.
 *
 * Client component because react-markdown ships as a client lib. The
 * raw markdown string is read server-side (filesystem) and handed in
 * as a prop — keeps the docs filesystem access on the server, the
 * rendering on the client.
 *
 * Styling is inline component overrides rather than a global stylesheet
 * so the docs typography stays isolated from the app's t-* utility
 * classes.
 */
export function DocsMarkdown({ content }: { content: string }) {
  return (
    <div className="docs-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => (
            <h1
              className="font-display"
              style={{
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                margin: "0 0 16px"
              }}
              {...p}
            />
          ),
          h2: (p) => (
            <h2
              className="font-display"
              style={{
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                margin: "32px 0 12px",
                paddingBottom: 6,
                borderBottom: "1px solid var(--border)"
              }}
              {...p}
            />
          ),
          h3: (p) => (
            <h3
              style={{ fontSize: 17, fontWeight: 600, margin: "24px 0 8px" }}
              {...p}
            />
          ),
          p: (p) => (
            <p
              style={{
                fontSize: 15,
                lineHeight: "26px",
                margin: "0 0 14px",
                color: "var(--ink-2)"
              }}
              {...p}
            />
          ),
          a: (p) => (
            <a
              style={{ color: "var(--kite-700)", textDecoration: "underline" }}
              target={p.href?.startsWith("http") ? "_blank" : undefined}
              rel={p.href?.startsWith("http") ? "noreferrer" : undefined}
              {...p}
            />
          ),
          ul: (p) => (
            <ul
              style={{ margin: "0 0 14px", paddingLeft: 22, fontSize: 15 }}
              {...p}
            />
          ),
          ol: (p) => (
            <ol
              style={{ margin: "0 0 14px", paddingLeft: 22, fontSize: 15 }}
              {...p}
            />
          ),
          li: (p) => (
            <li
              style={{ margin: "4px 0", lineHeight: "24px", color: "var(--ink-2)" }}
              {...p}
            />
          ),
          code: (p) => {
            const isBlock = String(p.children ?? "").includes("\n");
            if (isBlock) return <code {...p} />;
            return (
              <code
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 13,
                  background: "color-mix(in srgb, var(--kite-500) 10%, transparent)",
                  color: "var(--kite-900)",
                  padding: "1.5px 5px",
                  borderRadius: 4
                }}
                {...p}
              />
            );
          },
          pre: (p) => (
            <pre
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 14,
                overflowX: "auto",
                fontSize: 12.5,
                lineHeight: "20px",
                margin: "0 0 16px",
                fontFamily: "var(--font-jetbrains), monospace"
              }}
              {...p}
            />
          ),
          table: (p) => (
            <div style={{ overflowX: "auto", margin: "0 0 16px" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  fontSize: 13.5,
                  width: "100%"
                }}
                {...p}
              />
            </div>
          ),
          th: (p) => (
            <th
              style={{
                textAlign: "left",
                padding: "7px 12px",
                borderBottom: "2px solid var(--border)",
                fontWeight: 600
              }}
              {...p}
            />
          ),
          td: (p) => (
            <td
              style={{
                padding: "7px 12px",
                borderBottom: "1px solid var(--border)",
                color: "var(--ink-2)"
              }}
              {...p}
            />
          ),
          blockquote: (p) => (
            <blockquote
              style={{
                borderLeft: "3px solid var(--kite-500)",
                paddingLeft: 14,
                margin: "0 0 14px",
                color: "var(--ink-3)",
                fontStyle: "italic"
              }}
              {...p}
            />
          ),
          hr: () => (
            <hr
              style={{
                border: "none",
                borderTop: "1px solid var(--border)",
                margin: "24px 0"
              }}
            />
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
