import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Apple touch icon — iOS rejects SVG, so we render the K mark to a PNG
 * at build time via @vercel/og. Mirrors web/components/icons.tsx BrandMark
 * but enlarged for the 180×180 home-screen tile.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #5566ff 0%, #3a44cc 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 120,
          fontWeight: 700,
          letterSpacing: "-0.05em"
        }}
      >
        K
      </div>
    ),
    size
  );
}
