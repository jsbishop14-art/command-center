import { livePhone } from "./mode";
import { getSecret } from "../secrets";
import { stubFcc, type FccData } from "./stub";

// FCC unwanted-call complaints (handoff §8.3): a live query by caller-ID number against the
// Socrata dataset 3xyp-aqkj. It times out after 3 seconds; on a timeout or any error the lookup
// still returns a result, marked "FCC data unavailable" (spec §4 check 4). The stub stands in
// everywhere except the Mac mini. No AI.

export type FccResult = { available: boolean; count: number; lastDate: string | null; callTypes: string[] };

const TIMEOUT_MS = 3000;

export type FccFetcher = (phone: string, todayYmd: string) => Promise<FccData>;

type SocrataRow = { issue?: string; date?: string };

async function defaultFetch(phone: string, todayYmd: string): Promise<FccData> {
  if (!livePhone()) return stubFcc(phone, todayYmd);

  // Live path — Mac mini only, never exercised by tests. The exact field names and number format
  // are verified against the live dataset before go-live (handoff §8.3). Count the last 12 months,
  // keeping the most recent date and the call-type values.
  const token = getSecret("fcc_app_token");
  const headers: Record<string, string> = token ? { "X-App-Token": token } : {};
  const where = encodeURIComponent(`caller_id_number='${phone}'`);
  const url = `https://opendata.fcc.gov/resource/3xyp-aqkj.json?$where=${where}&$limit=500`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`FCC query failed: ${res.status}`);
  const rows = (await res.json()) as SocrataRow[];
  const callTypes = new Set<string>();
  let lastDate: string | null = null;
  for (const r of rows) {
    if (r.issue) callTypes.add(r.issue);
    const d = r.date ? r.date.slice(0, 10) : null;
    if (d && (!lastDate || d > lastDate)) lastDate = d;
  }
  return { count: rows.length, lastDate, callTypes: [...callTypes] };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("FCC timeout")), ms);
    if (typeof timer.unref === "function") timer.unref();
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

// Look up FCC complaints, never throwing: a timeout or error yields { available: false } so the
// overall lookup still returns (handoff §8.3). The fetcher and timeout are injectable for tests.
export async function fccLookup(
  phone: string,
  todayYmd: string,
  opts?: { fetcher?: FccFetcher; timeoutMs?: number },
): Promise<FccResult> {
  const fetcher = opts?.fetcher ?? defaultFetch;
  try {
    const d = await withTimeout(fetcher(phone, todayYmd), opts?.timeoutMs ?? TIMEOUT_MS);
    return { available: true, count: d.count, lastDate: d.lastDate, callTypes: d.callTypes };
  } catch {
    return { available: false, count: 0, lastDate: null, callTypes: [] };
  }
}
