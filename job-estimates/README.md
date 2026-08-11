# SkyLab Job Estimates

A single-file web app for building and tracking construction job estimates.

## How to use

Open `index.html` in any modern browser (Chrome, Safari, Firefox, Edge).
No install, no server, no account.

All data is saved to your browser's **localStorage** on that device, so:

- ✅ Data survives closing the tab, closing the browser, and restarting your computer.
- ✅ Works fully offline.
- ⚠️ Data is per-browser and per-device. To move to another device or browser,
  use the **⬇ Backup** button to download a JSON file, then use **⬆ Restore** on
  the other device.
- ⚠️ Clearing browser data / "Clear site data" for the page will erase estimates.
  Take a backup periodically.

## Features

- Multiple jobs with status flags (🟢 Active / 🟡 Pending / 🔴 Blocked / ⚪ Archived)
- Per-job details: PM, address, notes
- Multiple materials sections (Lumber, Hardware, add your own)
- Line items with qty × unit price → live line totals
- Materials upcharge, buffer, optional tax & delivery
- Labor tracking (subcontractor cost vs. what we charge, split by demo / install)
- Live totals: materials total, labor charge, grand total, expenses, profit, margin
- 🖨 Print / Save as PDF (clean print stylesheet)
- ⧉ Duplicate a job to reuse as a template
- ⬇ Backup / ⬆ Restore all jobs as a JSON file

## Pre-loaded example

The first-launch seed contains the **Dennis Dr** job as an example. Delete it
or edit it in place.

## Deploy it anywhere (optional)

Because it's one HTML file with no dependencies, you can also drop
`index.html` on any static host (GitHub Pages, Netlify, S3, a USB stick).
Estimates stored on one device stay on that device — use Backup/Restore to move.
