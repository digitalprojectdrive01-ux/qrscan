# Local auto-backup (every 5 minutes)

Runs on any computer with **Node.js 18+**. Pulls all data from the deployed
endpoints and writes timestamped CSV files to a local folder — no browser needed.

## Configure
Edit the top of `backup.js`, or set env vars:
- `BASE`  = https://<your-app>.vercel.app
- `TOKEN` = your `PBI_TOKEN`
- `OUTDIR`= folder for backups (e.g. `C:\Users\you\Documents\ScanToolsBackups`)
- `EVERY_MIN` = 5

## Run
- **Windows:** edit `run-backup.cmd`, then double-click it (leave the window open).
- **Mac/Linux:** edit `run-backup.sh`, then `chmod +x run-backup.sh && ./run-backup.sh`
- Or directly: `node backup.js`

## Output
```
OUTDIR/
  scanner-records/ scanner-records-<timestamp>.csv  + scanner-records-latest.csv
  entry-events/    entry-events-<timestamp>.csv     + entry-events-latest.csv
  entry-presence/  entry-presence-<timestamp>.csv   + entry-presence-latest.csv
  entry-process/   entry-process-<timestamp>.csv    + entry-process-latest.csv
```

## Run it unattended (optional)
- **Windows Task Scheduler:** create a task → Trigger "At log on" → Action: start
  `run-backup.cmd`. It keeps running and backs up every 5 min.
- **Mac/Linux:** run under `pm2`, `nohup ./run-backup.sh &`, or a systemd service.

Keep `TOKEN` private — it can read all data.

## In-app alternative (no script)
On the Entry dashboard (Chrome/Edge): sign in as admin → Setup → Reporting →
"Auto-backup to a local folder" → pick a folder. It writes CSV every 5 minutes
while that browser tab stays open.
