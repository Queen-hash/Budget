# Finly — Budget Planner

## Overview
A pure client-side web app for personal budget management, built with vanilla HTML, CSS, and JavaScript. Data is persisted via `localStorage`.

## Tech Stack
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Charts**: SVG (trend chart), Canvas API (donut chart)
- **Storage**: localStorage (key: `finlyV1`)
- **Fonts**: Google Fonts (Plus Jakarta Sans, DM Mono)
- **Server**: `serve` static file server on port 5000

## Project Structure
```
index.html   — Main app shell, all pages (Dashboard, Transaksi, Budget, Kalender, Pengaturan)
script.js    — All app logic, state management, rendering
style.css    — All styles, theming (dark/light), responsive
```

## Features
- **Dashboard**: Summary cards (income, spent, remaining, savings), smart insights, weekly/daily/monthly trend chart, donut distribution chart, expense breakdown, recent transactions
- **Wallet Separation**: Two wallet cards — Saldo Tunai (cash) & Saldo Digital (e-wallet/bank) — calculated per transaction's `walletType`
- **Net Flow Chart**: SVG line chart showing cumulative daily cash flow (14 days). Shows warning if 3 consecutive down days detected
- **Smart Insights**: Auto-generated alerts ("overspend X%", "category dominates Y%", "budget lasts N days")
- **Time Filter**: Trend chart supports Harian (7 days), Mingguan (M1–M5), Bulanan (6 months)
- **Transaksi**: Full CRUD, grouped by date, search by keyword, filter by type and category
- **Budget**: Custom categories with budget allocation, savings mode with compound interest
- **Kalender**: Monthly calendar with transaction dots and 3D hover effect
- **Pengaturan**: Theme toggle, reset, export CSV, backup JSON, restore from JSON
- **Empty States**: Friendly empty states with CTA button on all list views
- **Mobile UX**: Bottom sheet choice picker for income/expense on mobile (tombol + Pemasukan/Pengeluaran tidak disembunyikan lagi)
- **UX Polish**: Loading state on save buttons (spinner + "Menyimpan..."), smooth SVG animation, offline footer indicator

## Running
```bash
serve . -l 5000
```

## Deployment
Configured as static site deployment (publicDir: `.`)
