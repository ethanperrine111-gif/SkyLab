# SkyLab Job Estimates

A single-file web app for building and tracking construction job estimates.

Open `index.html` in any modern browser. No install, no server, no account, works offline.

## Your data

Everything is saved to that browser's **localStorage** as you type.

- ✅ Survives closing the tab, quitting the browser, and restarting the computer.
- ⚠️ Data lives on **that one device, in that one browser**. Use **⬇ Backup** to
  download a JSON file and **⬆ Restore** to load it somewhere else.
- ⚠️ "Clear browsing data" for this page erases the estimates. Take a backup
  now and then.

If the saved data is ever unreadable, the app starts fresh but keeps a copy of the
damaged blob under the `skylab.estimates.v1.prev` localStorage key rather than
overwriting it.

## Printing — two copies

The 🖨 button prints (or saves as PDF). What it includes depends on one checkbox
in the **Summary** section, **Include our costs when printing**:

| | Unchecked (default) — customer copy | Checked — internal copy |
|---|---|---|
| Quantities & descriptions | ✅ | ✅ |
| Unit prices, line totals, section totals | ❌ | ✅ |
| Upcharge / buffer / tax lines | ❌ | ✅ |
| Materials total, labor charge, grand total | ✅ | ✅ |
| Subcontractor name & cost | ❌ | ✅ |
| Expenses, profit, margin | ❌ | ✅ |

Leave it unchecked for anything you hand to a customer. The setting is remembered.

## How the totals work

**What the customer pays**

```
materials subtotal   = sum of every line (qty x unit price)
  + tax              (only when "tax already included" is unchecked)
  + delivery         (only when "delivery included" is unchecked)
  + upcharge
  + buffer
  = materials total

grand total          = materials total + demo charge + install charge
```

**What we keep**

```
expenses = materials total + subcontractor cost + my expenses
profit   = grand total - expenses
margin   = profit / grand total
```

Materials are billed through at cost, so the same figure appears on both sides and
nets out — changing a lumber price moves the grand total but not the profit. Profit
comes from the gap between what you charge for labor and what the sub costs.

## Features

- Multiple jobs, each with a status (🟢 Active / 🟡 Pending / 🔴 Blocked / ⚪ Archived)
- Search across job name, PM, address, and notes
- Any number of materials sections; live line, section, and grand totals
- Enter in a line jumps to the next one and adds a row at the end
- ⧉ Duplicate a job to use it as a template
- ⬇ Backup / ⬆ Restore every job as a JSON file
- Works on a phone — the sidebar becomes a drawer and line items reflow to two rows

## Pre-loaded example

First launch seeds the **Dennis Dr** job. No unit prices were quoted for that one,
so the supplier's $3,949 is carried as a single line under "Materials Order" and the
itemized lumber/hardware lines sit at $0. Fill in unit prices and zero out that line
to itemize it properly.

Note: the original handwritten total read $5,249 for materials, but
$3,949 + $790 + $500 = **$5,239**. The app shows the arithmetic result. Profit is
$7,360 either way, since materials cancel out.

## Tests

`test.mjs` drives the app in headless Chromium via Playwright — 92 assertions
covering seeding, math, live recalculation, focus retention while typing,
persistence across reloads, add/delete/duplicate, search, corrupt-data recovery,
XSS escaping, mobile layout, and both print modes.

```sh
npm install playwright
node test.mjs
```

It points at a preinstalled Chromium via `executablePath`; drop that option to use
Playwright's own download.
