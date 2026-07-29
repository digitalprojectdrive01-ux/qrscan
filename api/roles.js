// Admin-only user/role management for the Entry Control Dashboard.
//   GET  /api/roles                       -> list users with their roles
//   POST /api/roles  {user_id, role}      -> set a user's role (view|scan|admin)
// Caller must present a Supabase JWT (Authorization: Bearer <token>) whose
// user has role 'admin'. Uses the service key server-side only.
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY

async function getCaller(base, anonKey, jwt) {
  try {
    const r = await fetch(base + "/auth/v1/user", { headers: { apikey: anonKey, Authorization: "Bearer " + jwt } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}
async function roleOf(base, serviceKey, userId) {
  const r = await fetch(base + "/rest/v1/user_roles?select=role&user_id=eq." + encodeURIComponent(userId),
    { headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey } });
  if (!r.ok) return "view";
  const j = await r.json();
  return (j[0] && j[0].role) || "view";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const base = process.env.SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || "";
  if (!base || !serviceKey || !anonKey) {
    res.status(500).json({ error: "Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_KEY" });
    return;
  }

  const authz = req.headers["authorization"] || "";
  if (authz.indexOf("Bearer ") !== 0) { res.status(401).json({ error: "unauthorized" }); return; }
  const caller = await getCaller(base, anonKey, authz.slice(7));
  if (!caller || !caller.id) { res.status(401).json({ error: "unauthorized" }); return; }
  if ((await roleOf(base, serviceKey, caller.id)) !== "admin") { res.status(403).json({ error: "forbidden" }); return; }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};
    const userId = body.user_id;
    const role = body.role;
    if (!userId || ["view", "scan", "admin"].indexOf(role) === -1) { res.status(400).json({ error: "bad request" }); return; }
    const r = await fetch(base + "/rest/v1/user_roles", {
      method: "POST",
      headers: {
        apikey: serviceKey, Authorization: "Bearer " + serviceKey,
        "Content-Type": "application/json", Prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify({ user_id: userId, role: role, updated_at: new Date().toISOString() })
    });
    if (!r.ok) { res.status(502).json({ error: await r.text() }); return; }
    res.status(200).json({ ok: true });
    return;
  }

  // GET: list users (admin API, paginated) merged with roles
  let users = [], page = 1;
  for (let i = 0; i < 25; i++) {
    const r = await fetch(base + "/auth/v1/admin/users?page=" + page + "&per_page=200",
      { headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey } });
    if (!r.ok) break;
    const j = await r.json();
    const list = j.users || (Array.isArray(j) ? j : []);
    if (!list.length) break;
    users = users.concat(list);
    if (list.length < 200) break;
    page++;
  }
  let roles = [];
  const rr = await fetch(base + "/rest/v1/user_roles?select=user_id,role",
    { headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey } });
  if (rr.ok) roles = await rr.json();
  const roleMap = {};
  roles.forEach((x) => { roleMap[x.user_id] = x.role; });
  const out = users.map((u) => ({ id: u.id, email: u.email, role: roleMap[u.id] || "view" }));
  out.sort((a, b) => (a.email || "").localeCompare(b.email || ""));
  res.status(200).json(out);
}
