// Power BI live data feed.
// Returns ALL scan_records as JSON (default) or CSV, using the Supabase
// service-role key SERVER-SIDE (bypasses RLS). Access is gated by a token.
//
// Vercel env vars required:
//   SUPABASE_URL          = https://<project>.supabase.co
//   SUPABASE_SERVICE_KEY  = <service_role key>   (SECRET — never in the browser)
//   PBI_TOKEN             = <a long random string you choose>
//
// Power BI: Get Data -> Web -> https://<app>.vercel.app/api/export?token=PBI_TOKEN&format=json
//   (token may also be sent as header  x-report-token )

async function fetchAll(base, key) {
  const cols = "id,user_id,code,format,source,session_label,is_repeat,created_at";
  const pageSize = 1000;
  let from = 0, all = [];
  // Paginate with PostgREST Range headers until fewer than a full page returns.
  for (let guard = 0; guard < 500; guard++) {
    const url = base + "/rest/v1/scan_records?select=" + cols + "&order=created_at.desc";
    const r = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        Range: from + "-" + (from + pageSize - 1),
        "Range-Unit": "items",
        Prefer: "count=none"
      }
    });
    if (!r.ok) throw new Error("Supabase " + r.status + ": " + (await r.text()));
    const chunk = await r.json();
    all = all.concat(chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
    if (all.length > 200000) break; // safety cap
  }
  return all;
}

function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCsv(rows) {
  const cols = ["id", "user_id", "code", "format", "source", "session_label", "is_repeat", "created_at"];
  const out = [cols.join(",")];
  for (const r of rows) out.push(cols.map((c) => csvCell(r[c])).join(","));
  return out.join("\r\n");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const token = req.query.token || req.headers["x-report-token"];
  const expected = process.env.PBI_TOKEN || "";
  if (!expected || token !== expected) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const base = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_KEY || "";
  if (!base || !key) {
    res.status(500).json({ error: "Missing SUPABASE_URL / SUPABASE_SERVICE_KEY env vars" });
    return;
  }

  try {
    const rows = await fetchAll(base, key);
    if ((req.query.format || "json") === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.status(200).send(toCsv(rows));
    } else {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.status(200).json(rows);
    }
  } catch (e) {
    res.status(502).json({ error: String((e && e.message) || e) });
  }
}
