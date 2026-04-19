import { NextRequest, NextResponse } from "next/server";
import { lookupOrcid } from "@/lib/orcid";
import { listAuthors } from "@/lib/papers";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const orcid = req.nextUrl.searchParams.get("orcid")?.trim();
  if (!orcid) {
    return NextResponse.json({ error: "orcid query param required" }, { status: 400 });
  }

  const api = await lookupOrcid(orcid);
  const catalog = listAuthors().find((a) => a.orcid === orcid);

  if (api.real) {
    return NextResponse.json({
      orcid,
      status: "real",
      name: api.name,
      biography: api.biography,
      worksCount: api.worksCount,
      matchesCatalog: Boolean(catalog && catalog.orcid === orcid),
      catalog: catalog ? { name: catalog.name, affiliation: catalog.affiliation } : null
    });
  }

  if (catalog) {
    return NextResponse.json({
      orcid,
      status: "catalog",
      name: catalog.name,
      affiliation: catalog.affiliation,
      note: "Mock catalog ORCID — real validation would require a registered researcher."
    });
  }

  return NextResponse.json({
    orcid,
    status: "unknown",
    error: api.error ?? "ORCID not found on orcid.org and not in local catalog"
  }, { status: 404 });
}
