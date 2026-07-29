#!/usr/bin/env node
/*
  Local auto-backup for Scan Tools.  Node 18+ (uses global fetch). No dependencies.
  Pulls data from the deployed export endpoints every N minutes and writes
  timestamped CSV files to a local folder — runs headless, no browser tab needed.

  Configure with env vars OR edit the four constants below:
    BASE       = https://<your-app>.vercel.app
    TOKEN      = your PBI_TOKEN
    OUTDIR     = folder to write backups into
    EVERY_MIN  = 5

  Run:   node backup.js
  (Windows: double-click run-backup.cmd ·  Mac/Linux: ./run-backup.sh)
*/
const fs = require("fs");
const path = require("path");

const BASE      = process.env.BASE      || "https://YOUR-APP.vercel.app";
const TOKEN     = process.env.TOKEN     || "YOUR_PBI_TOKEN";
const OUTDIR    = process.env.OUTDIR    || "./backups";
const EVERY_MIN = parseInt(process.env.EVERY_MIN || "5", 10);

const FEEDS = [
  { name: "scanner-records", url: "/api/export?format=csv" },
  { name: "entry-events",    url: "/api/entry-export?dataset=events&format=csv" },
  { name: "entry-presence",  url: "/api/entry-export?dataset=presence&format=csv" },
  { name: "entry-process",   url: "/api/entry-export?dataset=process&format=csv" }
];

function ts(){ return new Date().toISOString().slice(0,19).replace(/[:T]/g,"-"); }
function ensureDir(d){ fs.mkdirSync(d, { recursive: true }); }

async function pull(feed){
  const sep = feed.url.indexOf("?") === -1 ? "?" : "&";
  const url = BASE + feed.url + sep + "token=" + encodeURIComponent(TOKEN);
  const r = await fetch(url, { headers: { "x-report-token": TOKEN } });
  if(!r.ok) throw new Error("HTTP " + r.status + ": " + (await r.text()).slice(0,180));
  return await r.text();
}

async function runOnce(){
  ensureDir(OUTDIR);
  const stamp = ts();
  for(const f of FEEDS){
    try{
      const body = await pull(f);
      const dir = path.join(OUTDIR, f.name);
      ensureDir(dir);
      fs.writeFileSync(path.join(dir, f.name + "-" + stamp + ".csv"), body);
      fs.writeFileSync(path.join(dir, f.name + "-latest.csv"), body); // rolling latest
      const rows = Math.max(0, body.split("\n").filter(Boolean).length - 1);
      console.log(new Date().toLocaleTimeString(), "saved", f.name, "(" + rows + " rows)");
    }catch(e){
      console.error(new Date().toLocaleTimeString(), "FAILED", f.name, "-", e.message);
    }
  }
}

(async function main(){
  if(TOKEN.indexOf("YOUR_") === 0 || BASE.indexOf("YOUR-") !== -1){
    console.error("Set BASE and TOKEN first (env vars, or edit the top of backup.js).");
    process.exit(1);
  }
  console.log("Backup -> " + path.resolve(OUTDIR) + "  every " + EVERY_MIN + " min  from " + BASE);
  await runOnce();
  setInterval(runOnce, EVERY_MIN * 60 * 1000);
})();
