import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  QueryAttested,
  CitationPaid
} from "../generated/AttributionLedger/AttributionLedger";
import {
  Query,
  Citation,
  Author,
  DayStat,
  AuthorDayStat
} from "../generated/schema";

const SECONDS_PER_DAY: i32 = 86400;

function dayIdFromTimestamp(ts: BigInt): string {
  // Unix ts → midnight UTC → "YYYY-MM-DD"
  const secs = ts.toI64();
  const dayStart = (secs / SECONDS_PER_DAY) * SECONDS_PER_DAY;
  const d = new Date(dayStart * 1000);
  const yyyy = d.getUTCFullYear().toString();
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  return yyyy + "-" + mm + "-" + dd;
}

function dayTimestamp(ts: BigInt): BigInt {
  const secs = ts.toI64();
  const dayStart = (secs / SECONDS_PER_DAY) * SECONDS_PER_DAY;
  return BigInt.fromI64(dayStart);
}

export function handleQueryAttested(event: QueryAttested): void {
  const q = new Query(event.params.queryId);
  q.payer = event.params.payer;
  q.totalPaid = event.params.totalPaid;
  q.authorsShare = BigInt.zero(); // filled when first citation arrives
  q.citationCount = event.params.citationCount;
  q.block = event.block.number;
  q.timestamp = event.block.timestamp;
  q.tx = event.transaction.hash;
  q.save();

  // daily aggregate
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
  const authorAddr = event.params.author;
  const authorId = Bytes.fromHexString(
    authorAddr.toHexString().toLowerCase()
  ) as Bytes;

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

  // Citation — deterministic id from tx + log index
  const citationId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const cite = new Citation(citationId);
  cite.query = event.params.queryId;
  cite.author = authorId;
  cite.weightBps = event.params.weightBps;
  cite.amount = event.params.amount;
  cite.block = event.block.number;
  cite.timestamp = event.block.timestamp;
  cite.tx = event.transaction.hash;
  cite.save();

  // Accumulate authorsShare on parent query
  const q = Query.load(event.params.queryId);
  if (q != null) {
    q.authorsShare = q.authorsShare.plus(event.params.amount);
    q.save();
  }

  // Daily aggregates
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

  // Author-day stat (for 7-day sparklines)
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
