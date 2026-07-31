#!/usr/bin/env node
/*
  Local auto-backup for Scan Tools -> CSV + SQLite, into your OneDrive folder.
  Node 18+ (global fetch). SQLite is optional (better-sqlite3); CSV always works.

  It writes files into OUTDIR. Point OUTDIR at a folder inside your synced
  OneDrive and OneDrive uploads them automatically (no API / no login needed).
  On Windows OUTDIR defaults to  %OneDrive%\ScanToolsBackups  automatically.

  Configure with env vars or edit the constants below:
    BASE       = https://<your-app>.vercel.app
    TOKEN      = your PBI_TOKEN
    OUTDIR     = a folder inside your OneDrive (auto on Windows)
    EVERY_MIN  = 5

  Enable SQLite output (optional):  npm install
  Run:  node backup.js   (or run-backup.cmd on Windows)
*/
const fs = require("fs");
const path = require("path");

const BASE      = process.env.BASE  || "https://YOUR-APP.vercel.app";
const TOKEN     = process.env.TOKEN || "YOUR_PBI_TOKEN";
const DEFAULT_OUT = process.env.OneDrive ? path.join(process.env.OneDrive, "ScanToolsBackups") : "./backups";
const OUTDIR    = process.env.OUTDIR || DEFAULT_OUT;
const EVERY_MIN = parseInt(process.env.EVERY_MIN || "5", 10);

const FEEDS = [
  { name: "scanner-records", table: "scanner_records", url: "/api/export?format=json" },
  { name: "entry-events",    table: "ec_event",        url: "/api/entry-export?dataset=events&format=json" },
  { name: "entry-presence",  table: "ec_presence",     url: "/api/entry-export?dataset=presence&format=json" },
  { name: "entry-process",   table: "ec_process",      url: "/api/entry-export?dataset=process&format=json" }
];

// Optional SQLite engine (no native compiler needed if a prebuilt binary is used).
let Database = null;
try { Database = require("better-sqlite3"); } catch (e) { /* CSV-only fallback */ }

function ts(){ return new Date().toISOString().slice(0,19).replace(/[:T]/g,"-"); }
function ensureDir(d){ fs.mkdirSync(d, { recursive: true }); }
function unionCols(rows){ const cols=[]; rows.forEach(r=>Object.keys(r).forEach(k=>{ if(cols.indexOf(k)===-1) cols.push(k); })); return cols; }
function cell(v){ if(v===null||v===undefined) return ""; const s=(typeof v==="object")?JSON.stringify(v):String(v); return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }
function toCsv(rows){ if(!rows.length) return ""; const cols=unionCols(rows); const out=[cols.join(",")]; rows.forEach(r=>out.push(cols.map(c=>cell(r[c])).join(","))); return out.join("\r\n"); }

async function pullJson(feed){
  const sep = feed.url.indexOf("?") === -1 ? "?" : "&";
  const url = BASE + feed.url + sep + "token=" + encodeURIComponent(TOKEN);
  const r = await fetch(url, { headers: { "x-report-token": TOKEN } });
  if(!r.ok) throw new Error("HTTP " + r.status + ": " + (await r.text()).slice(0,160));
  return await r.json();
}

function buildSqlite(dbPath, datasets){
  if(!Database) return false;
  try{
    const db = new Database(dbPath);
    db.pragma("journal_mode = DELETE");
    for(const d of datasets){
      const rows = d.rows || [];
      const cols = rows.length ? unionCols(rows) : (d.cols || ["data"]);
      db.exec('DROP TABLE IF EXISTS "' + d.table + '"');
      db.exec('CREATE TABLE "' + d.table + '" (' + cols.map(c => '"'+c+'" TEXT').join(", ") + ')');
      if(rows.length){
        const stmt = db.prepare('INSERT INTO "'+d.table+'" ('+cols.map(c=>'"'+c+'"').join(",")+') VALUES ('+cols.map(()=>"?").join(",")+')');
        const many = db.transaction(rs => { for(const r of rs){ stmt.run(cols.map(c => {
          const v = r[c];
          if(v===null||v===undefined) return null;
          if(typeof v==="boolean") return v?1:0;
          if(typeof v==="object") return JSON.stringify(v);
          return v;
        })); } });
        many(rows);
      }
    }
    db.close();
    return true;
  }catch(e){ console.error("  SQLite build failed:", e.message); return false; }
}

async function runOnce(){
  ensureDir(OUTDIR);
  const stamp = ts();
  const datasets = [];
  for(const f of FEEDS){
    try{
      const rows = await pullJson(f);
      const dir = path.join(OUTDIR, f.name); ensureDir(dir);
      const csv = toCsv(rows);
      fs.writeFileSync(path.join(dir, f.name + "-" + stamp + ".csv"), csv);
      fs.writeFileSync(path.join(dir, f.name + "-latest.csv"), csv);
      datasets.push({ table: f.table, rows });
      console.log(new Date().toLocaleTimeString(), "csv", f.name, "(" + rows.length + " rows)");
    }catch(e){
      console.error(new Date().toLocaleTimeString(), "FAILED", f.name, "-", e.message);
      datasets.push({ table: f.table, rows: [] });
    }
  }
  const dbDir = path.join(OUTDIR, "sqlite"); ensureDir(dbDir);
  const dbTs = path.join(dbDir, "scan-tools-" + stamp + ".sqlite");
  if(buildSqlite(dbTs, datasets)){
    try{ fs.copyFileSync(dbTs, path.join(dbDir, "scan-tools-latest.sqlite")); }catch(e){}
    console.log(new Date().toLocaleTimeString(), "sqlite  scan-tools-" + stamp + ".sqlite");
  } else {
    console.log(new Date().toLocaleTimeString(), "sqlite skipped (run 'npm install' to enable better-sqlite3)");
  }
}

(async function main(){
  if(TOKEN.indexOf("YOUR_") === 0 || BASE.indexOf("YOUR-") !== -1){
    console.error("Set BASE and TOKEN first (env vars, or edit the top of backup.js).");
    process.exit(1);
  }
  console.log("Backup -> " + path.resolve(OUTDIR));
  console.log("  CSV: yes   SQLite: " + (Database ? "yes" : "no (npm install to enable)") + "   every " + EVERY_MIN + " min");
  if(/OneDrive/i.test(OUTDIR)) console.log("  OneDrive folder detected — files will sync to the cloud automatically.");
  await runOnce();
  setInterval(runOnce, EVERY_MIN * 60 * 1000);
})();
