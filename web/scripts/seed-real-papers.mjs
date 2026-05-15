#!/usr/bin/env node
/**
 * Seed papers.json + authors.json from the OpenAlex Works API.
 *
 * Generates REAL wallet addresses per author via ethers.Wallet.createRandom():
 *   - Real ECDSA keypairs (we know the private keys)
 *   - All addresses are unique (cryptographic randomness)
 *   - Stored in data/authors.json (public) + data/authors-keys.json
 *     (private — gitignored, never committed)
 *
 * To make these addresses "on-chain visible" after seeding, run
 *   scripts/seed-on-chain-authors.mjs
 * which calls AttributionLedger.attestAndSplit with real USDC, populating
 * CitationPaid events that link these authors to queries on Kite testnet.
 *
 * Usage (from web/):
 *   node scripts/seed-real-papers.mjs
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Wallet } from "ethers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");
const KEYS_FILE = resolve(DATA_DIR, "authors-keys.json");

/**
 * Stable wallet generation: re-runs preserve existing (address, key)
 * pairs by name. Only NEW author names get fresh wallets. This keeps
 * the diff minimal across seed runs and lets on-chain attestations stay
 * valid (you don't want to invalidate every prior CitationPaid event by
 * regenerating addresses).
 */
function loadExistingKeys() {
  if (!existsSync(KEYS_FILE)) return new Map();
  try {
    const raw = JSON.parse(readFileSync(KEYS_FILE, "utf-8"));
    return new Map(Object.entries(raw));
  } catch {
    return new Map();
  }
}

function realWalletFor(name, existing) {
  const hit = existing.get(name);
  if (hit) return { address: hit.address, privateKey: hit.privateKey };
  const w = Wallet.createRandom();
  const rec = { address: w.address, privateKey: w.privateKey };
  // Mutate the map so subsequent realWalletFor(name) calls within the
  // same script run return the SAME wallet — otherwise authors.json
  // and authors-keys.json would diverge.
  existing.set(name, rec);
  return rec;
}

const QUERIES = [
  "direct air capture",
  "carbon mineralization basalt",
  "biochar negative emissions",
  "tandem perovskite silicon solar cells",
  "ocean alkalinity enhancement",
  "afforestation carbon yield",
  "carbonic anhydrase enzyme capture",
  "geological carbon storage"
];
const PAPERS_PER_QUERY = 4;
// OpenAlex has permissive rate limits (~10 req/s polite) and ships ORCIDs
// directly in the response. Semantic Scholar required a key for any real
// throughput.
const OA_BASE = "https://api.openalex.org/works";
const OA_SELECT =
  "id,doi,title,publication_year,authorships,abstract_inverted_index,primary_location";

function abstractFromInverted(inverted) {
  if (!inverted) return null;
  const positions = [];
  for (const [word, posList] of Object.entries(inverted)) {
    for (const pos of posList) positions.push([pos, word]);
  }
  positions.sort((a, b) => a[0] - b[0]);
  const text = positions.map(([, w]) => w).join(" ");
  return text.length > 480 ? text.slice(0, 477) + "…" : text;
}

async function searchOpenAlex(query) {
  const url =
    `${OA_BASE}?search=${encodeURIComponent(query)}` +
    `&per-page=${PAPERS_PER_QUERY}` +
    `&filter=type:article,has_abstract:true` +
    `&select=${OA_SELECT}` +
    `&mailto=hackathon@kutip.app`; // polite-pool identifier
  const res = await fetch(url, {
    headers: { "User-Agent": "kutip-seed-script/0.1 (hackathon@kutip.app)" }
  });
  if (!res.ok) {
    throw new Error(`OA ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  // Normalise to a SS-shaped record so the rest of the script stays the same.
  return (data.results ?? []).map((w) => ({
    paperId: w.id?.replace("https://openalex.org/", ""),
    title: w.title,
    abstract: abstractFromInverted(w.abstract_inverted_index),
    year: w.publication_year,
    venue: w.primary_location?.source?.display_name,
    authors: (w.authorships ?? []).map((a) => ({
      name: a.author?.display_name,
      orcid: a.author?.orcid?.replace("https://orcid.org/", "") ?? null,
      affiliation: a.institutions?.[0]?.display_name ?? null
    })),
    externalIds: { DOI: w.doi?.replace("https://doi.org/", "") ?? null }
  }));
}

function syntheticOrcid(idx) {
  const padded = String(idx).padStart(7, "0");
  const a = padded.slice(0, 4);
  const b = padded.slice(4, 7);
  return `0000-0001-${a.slice(0, 4)}-${b}1`.replace(
    /^0000-0001-(\d{4})-(\d{4})$/,
    "0000-0001-$1-$2"
  );
}

async function main() {
  console.log("Searching OpenAlex across", QUERIES.length, "queries…");
  const existingKeys = loadExistingKeys();
  console.log(`  → ${existingKeys.size} existing author keys loaded (stable re-run)`);
  const papers = [];
  const authors = new Map(); // name → record

  for (const q of QUERIES) {
    process.stdout.write(`  ${q.padEnd(40)}`);
    try {
      const results = await searchOpenAlex(q);
      let kept = 0;
      for (const p of results) {
        if (!p.title || !p.authors?.length || !p.abstract) continue;
        const doi = p.externalIds?.DOI;
        if (papers.find((x) => x.doi === (doi ?? `oaid:${p.paperId}`))) {
          continue;
        }

        const authorIds = [];
        for (const a of p.authors.slice(0, 4)) {
          if (!a.name) continue;
          const key = a.name.trim();
          let rec = authors.get(key);
          if (!rec) {
            const aid = `a${String(authors.size + 1).padStart(3, "0")}`;
            rec = {
              id: aid,
              name: key,
              affiliation: a.affiliation ?? "Independent researcher",
              wallet: realWalletFor(key, existingKeys).address,
              orcid: a.orcid ?? syntheticOrcid(authors.size + 1)
            };
            authors.set(key, rec);
          } else {
            // Upgrade a previously-synthetic ORCID if a later paper exposes the real one.
            if (!rec.orcid?.startsWith("0000-0001-") && rec.orcid && a.orcid) {
              // already real
            } else if (a.orcid) {
              rec.orcid = a.orcid;
            }
            if (a.affiliation && rec.affiliation === "Independent researcher") {
              rec.affiliation = a.affiliation;
            }
          }
          authorIds.push(rec.id);
        }
        if (!authorIds.length) continue;

        const id = `p${String(papers.length + 1).padStart(3, "0")}`;
        papers.push({
          id,
          doi: doi ?? `oaid:${p.paperId}`,
          title: p.title.trim(),
          authors: authorIds,
          year: p.year ?? new Date().getFullYear(),
          journal: (p.venue || "Preprint").trim(),
          abstract: p.abstract.trim().slice(0, 480),
          keywords: q.split(" ").slice(0, 3),
          // Range matches existing catalog: 30000-50000 (~$0.03-$0.05).
          priceUSDC: 30000 + ((papers.length * 977) % 20001)
        });
        kept++;
      }
      console.log(`→ ${kept} kept`);
    } catch (err) {
      console.log(`→ FAIL (${err.message})`);
    }
    // OpenAlex polite-pool: ~10 req/s shared. 1s spacing is safe.
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Pin a real-ORCID author so the /claim ORCID-OAuth demo can actually
  // bind. 0000-0002-1825-0097 is Josiah Carberry — ORCID's public test
  // record, safe to OAuth-link for hackathon demos.
  if (!authors.has("Josiah Carberry")) {
    const aid = `a${String(authors.size + 1).padStart(3, "0")}`;
    const carberry = {
      id: aid,
      name: "Josiah Carberry",
      affiliation: "Brown University (test record)",
      wallet: realWalletFor("Josiah Carberry", existingKeys).address,
      orcid: "0000-0002-1825-0097"
    };
    authors.set("Josiah Carberry", carberry);
    // Add him to the first 2 papers so the leaderboard has him with cites.
    for (const p of papers.slice(0, 2)) {
      if (!p.authors.includes(aid)) p.authors.push(aid);
    }
  } else {
    // Real author already named Josiah Carberry — promote to real ORCID.
    authors.get("Josiah Carberry").orcid = "0000-0002-1825-0097";
  }

  if (papers.length < 5) {
    console.error(
      `\n✗ Only ${papers.length} papers fetched — refusing to overwrite ` +
        `existing data. Investigate API failures above and re-run.`
    );
    process.exit(1);
  }
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(
    resolve(DATA_DIR, "papers.json"),
    JSON.stringify(papers, null, 2) + "\n",
    "utf-8"
  );
  writeFileSync(
    resolve(DATA_DIR, "authors.json"),
    JSON.stringify([...authors.values()], null, 2) + "\n",
    "utf-8"
  );

  // existingKeys is the source of truth — realWalletFor() mutates it
  // for every new author it encounters during the run, so the map now
  // covers all 109+ authors. Persist it as the key file.
  const keysOut = Object.fromEntries(existingKeys.entries());
  writeFileSync(KEYS_FILE, JSON.stringify(keysOut, null, 2) + "\n", "utf-8");

  console.log(
    `\n✓ Seeded ${papers.length} papers · ${authors.size} authors → ${DATA_DIR}`
  );
  console.log(`  → private keys saved to ${KEYS_FILE} (GITIGNORED)`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
