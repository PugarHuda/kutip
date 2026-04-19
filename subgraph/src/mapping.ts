import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  QueryAttested,
  CitationPaid
} from "../generated/AttributionLedger/AttributionLedger";
import {
  Attestation,
  Citation,
  Author,
  DayStat,
  AuthorDayStat
} from "../generated/schema";

const SECONDS_PER_DAY: i32 = 86400;

// AssemblyScript-safe date helpers. Avoid `new Date()` which has limited
// stdlib support in the graph-ts runtime; pure integer math is robust.
function pad2(n: i32): string {
  if (n < 10) return "0" + n.toString();
  return n.toString();
}

function dayIdFromTimestamp(ts: BigInt): string {
  const secs = ts.toI64();
  const daysSinceEpoch = secs / SECONDS_PER_DAY;

  // Civil-from-days algorithm (Howard Hinnant, public domain).
  let z: i64 = daysSinceEpoch + 719468;
  const era: i64 = (z >= 0 ? z : z - 146096) / 146097;
  const doe: i64 = z - era * 146097;
  const yoe: i64 = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
  const y: i64 = yoe + era * 400;
  const doy: i64 = doe - (365 * yoe + yoe / 4 - yoe / 100);
  const mp: i64 = (5 * doy + 2) / 153;
  const d: i64 = doy - (153 * mp + 2) / 5 + 1;
  const m: i64 = mp < 10 ? mp + 3 : mp - 9;
  const year: i64 = m <= 2 ? y + 1 : y;

  return year.toString() + "-" + pad2(m as i32) + "-" + pad2(d as i32);
}

function dayTimestamp(ts: BigInt): BigInt {
  const secs = ts.toI64();
  const dayStart = (secs / SECONDS_PER_DAY) * SECONDS_PER_DAY;
  return BigInt.fromI64(dayStart);
}

export function handleQueryAttested(event: QueryAttested): void {
  const a = new Attestation(event.params.queryId);
  a.payer = event.params.payer;
  a.totalPaid = event.params.totalPaid;
  a.authorsShare = BigInt.zero();
  a.citationCount = event.params.citationCount;
  a.block = event.block.number;
  a.timestamp = event.block.timestamp;
  a.tx = event.transaction.hash;
  a.save();

  const dayId = dayIdFromTimestamp(event.block.timestamp);
  let stat = DayStat.load(dayId);
  if (stat == null) {
    stat = new DayStat(dayId);
    stat.date = dayTimestamp(event.block.timestamp);
    stat.queriesAttested = 0;
    stat.citationsPaid = 0;
    stat.totalPaid = BigInt.zero();
  }
  stat.queriesAttested = stat.queriesAttested + 1;
  stat.totalPaid = stat.totalPaid.plus(event.params.totalPaid);
  stat.save();
}

export function handleCitationPaid(event: CitationPaid): void {
  // event.params.author is Address, which already extends Bytes — no conversion needed.
  const authorId = event.params.author as Bytes;

  let author = Author.load(authorId);
  if (author == null) {
    author = new Author(authorId);
    author.totalEarnings = BigInt.zero();
    author.citationCount = 0;
    author.firstSeenAt = event.block.timestamp;
  }
  author.totalEarnings = author.totalEarnings.plus(event.params.amount);
  author.citationCount = author.citationCount + 1;
  author.lastSeenAt = event.block.timestamp;
  author.save();

  const citationId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const cite = new Citation(citationId);
  cite.attestation = event.params.queryId;
  cite.author = authorId;
  cite.weightBps = event.params.weightBps;
  cite.amount = event.params.amount;
  cite.block = event.block.number;
  cite.timestamp = event.block.timestamp;
  cite.tx = event.transaction.hash;
  cite.save();

  const a = Attestation.load(event.params.queryId);
  if (a != null) {
    a.authorsShare = a.authorsShare.plus(event.params.amount);
    a.save();
  }

  const dayId = dayIdFromTimestamp(event.block.timestamp);
  let stat = DayStat.load(dayId);
  if (stat == null) {
    stat = new DayStat(dayId);
    stat.date = dayTimestamp(event.block.timestamp);
    stat.queriesAttested = 0;
    stat.citationsPaid = 0;
    stat.totalPaid = BigInt.zero();
  }
  stat.citationsPaid = stat.citationsPaid + 1;
  stat.save();

  const adKey = authorId.toHexString() + "-" + dayId;
  let ads = AuthorDayStat.load(adKey);
  if (ads == null) {
    ads = new AuthorDayStat(adKey);
    ads.author = authorId;
    ads.date = dayTimestamp(event.block.timestamp);
    ads.citations = 0;
    ads.earnings = BigInt.zero();
  }
  ads.citations = ads.citations + 1;
  ads.earnings = ads.earnings.plus(event.params.amount);
  ads.save();
}
