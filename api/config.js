// Vercel Serverless Function — returns the PUBLIC Supabase config from
// environment variables, so no key is committed to source control.
//
// Set these in Vercel → Project → Settings → Environment Variables:
//   SUPABASE_URL       = https://<project>.supabase.co
//   SUPABASE_ANON_KEY  = <your anon/public key>
//
// Note: the anon key is designed to be public and still reaches the browser.
// Real protection comes from Row Level Security + disabling public sign-ups.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const url = process.env.SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || "";

  if (!url || !anonKey) {
    res.status(500).json({ error: "Missing SUPABASE_URL / SUPABASE_ANON_KEY env vars" });
    return;
  }
  res.status(200).json({ url, anonKey });
}
