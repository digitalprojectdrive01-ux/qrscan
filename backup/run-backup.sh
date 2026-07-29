#!/usr/bin/env bash
# edit these, then: chmod +x run-backup.sh && ./run-backup.sh
export BASE="https://YOUR-APP.vercel.app"
export TOKEN="YOUR_PBI_TOKEN"
export OUTDIR="$HOME/ScanToolsBackups"
export EVERY_MIN=5
node "$(dirname "$0")/backup.js"
