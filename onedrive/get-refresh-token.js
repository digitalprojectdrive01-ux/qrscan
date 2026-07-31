#!/usr/bin/env node
/*
  ONE-TIME: authorize your PERSONAL OneDrive and print a refresh token.
  Node 18+. No dependencies.

  Prereq — register a free app (no admin needed):
    https://portal.azure.com -> Azure Active Directory -> App registrations -> New
      - Supported account types: "Personal Microsoft accounts only"
        (or "... and personal Microsoft accounts")
      - Redirect URI (type Web): http://localhost:5000/callback
    Then: Certificates & secrets -> New client secret (copy the VALUE).
    Copy the Application (client) ID.

  Run:
    MS_CLIENT_ID=xxx MS_CLIENT_SECRET=yyy node onedrive/get-refresh-token.js
    (Windows: set the vars first, or edit the constants below.)
  If your app is "personal accounts only", also set  MS_TENANT=consumers
*/
const http = require("http");
const { exec } = require("child_process");

const CLIENT_ID = process.env.MS_CLIENT_ID || "YOUR_CLIENT_ID";
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET || "YOUR_CLIENT_SECRET";
const TENANT = process.env.MS_TENANT || "common";
const REDIRECT = "http://localhost:5000/callback";
const SCOPE = "Files.ReadWrite offline_access User.Read";

if (CLIENT_ID.indexOf("YOUR_") === 0 || CLIENT_SECRET.indexOf("YOUR_") === 0) {
  console.error("Set MS_CLIENT_ID and MS_CLIENT_SECRET (env vars or edit this file)."); process.exit(1);
}
const authUrl = "https://login.microsoftonline.com/" + TENANT + "/oauth2/v2.0/authorize"
  + "?client_id=" + encodeURIComponent(CLIENT_ID)
  + "&response_type=code&redirect_uri=" + encodeURIComponent(REDIRECT)
  + "&response_mode=query&prompt=consent&scope=" + encodeURIComponent(SCOPE);

const server = http.createServer(async (req, res) => {
  if (req.url.indexOf("/callback") !== 0) { res.writeHead(404); res.end(); return; }
  const code = new URL(req.url, "http://localhost:5000").searchParams.get("code");
  if (!code) { res.writeHead(400); res.end("No code"); return; }
  try {
    const r = await fetch("https://login.microsoftonline.com/" + TENANT + "/oauth2/v2.0/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: "authorization_code", code: code, redirect_uri: REDIRECT, scope: SCOPE })
    });
    const j = await r.json();
    if (!r.ok || !j.refresh_token) { res.writeHead(500); res.end("Token error: " + JSON.stringify(j)); console.error(j); process.exit(1); }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h2>Done. You can close this tab.</h2><p>Refresh token printed in the terminal.</p>");
    console.log("\n================ REFRESH TOKEN (store this) ================\n");
    console.log(j.refresh_token);
    console.log("\n===========================================================\n");
    console.log("Set it in Vercel as MS_REFRESH_TOKEN (first run seeds it into Supabase,");
    console.log("after which it rotates automatically). Then set MS_CLIENT_ID / MS_CLIENT_SECRET too.");
    setTimeout(() => process.exit(0), 500);
  } catch (e) { res.writeHead(500); res.end(String(e)); console.error(e); process.exit(1); }
});
server.listen(5000, () => {
  console.log("Open this URL to sign in (also trying to open it for you):\n\n" + authUrl + "\n");
  const cmd = process.platform === "win32" ? "start \"\" \"" + authUrl + "\"" : (process.platform === "darwin" ? "open" : "xdg-open") + " \"" + authUrl + "\"";
  exec(cmd, () => {});
});
