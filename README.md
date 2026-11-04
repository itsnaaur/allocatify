# Allocatify

> **Live:** [allocatify.vercel.app](https://allocatify.vercel.app) · [Deploy your own](#deployment-vercel)

A **privacy-first, zero-setup** financial allocation engine. Map your financial distribution instantly—no sign-up, no bank syncing, no spreadsheets.

## Features

- **Zero Friction** — No accounts. Land on the page, enter numbers, see your budget visualized.
- **Privacy by Design** — Data stored only in your browser (IndexedDB). Nothing leaves your device.
- **Income sources** — Salary, freelance, side jobs, each with an optional pay day.
- **Loans & bills** — Enter what's left to pay (interest included), the monthly payment and due day; they're added to every month, with months left, payoff date and paid/overdue status.
- **Savings goals** — Price, deadline and priority; a suggested monthly saving from free money only, and how many months until you can afford it.
- **Safety buffer** — 10% of income (adjustable up to 50%, never below 10%) that suggestions never touch. Must-have categories are protected too.
- **Spending log** — Log expenses or import a bank statement CSV (columns, date order, decimal commas and debit/credit detected; duplicates skipped). See spent vs planned per category.
- **Month-end carry-over** — Move what's left into next month or a goal.
- **Trends** — Where each month's income went, and loans going down.
- **Smart-Start Templates** — 50/30/20, Freelancer Basic, Student Living, or build custom.
- **Exports** — CSV and PDF reports with income, loans, spending, goals and expenses.
- **Backup & restore** — One file with everything, validated before restoring; or delete all data.
- **Dark Mode** — System-aware theme toggle.

## Tech Stack

| Layer        | Technology               |
| ------------ | ------------------------ |
| Framework    | Next.js 15 (App Router)  |
| Styling      | Tailwind CSS + Radix UI  |
| State        | Zustand                  |
| Storage      | Dexie.js (IndexedDB)     |
| Charts       | Recharts                 |
| PDF          | @react-pdf/renderer      |
| Deployment   | Vercel                   |

## Technical Challenges Overcome

### 1. Rehydration of Local Data in Next.js

Next.js renders on the server first. IndexedDB (Dexie) exists only in the browser. Loading persisted data during SSR would fail or produce a hydration mismatch.

**Solution:** A `HydrationGuard` component that:
- Renders a loading state on the server and initial paint
- Calls `hydrate()` only inside `useEffect` (client-only)
- Sets `isHydrated` to `true` after data is loaded
- Prevents the main UI from rendering until the client has loaded from IndexedDB

This avoids "flash of default state" and keeps server/client HTML in sync.

### 2. CSV Parser for Unexpected Bank Formats

Bank CSVs vary: different column names, delimiters, date orders and number formats.

**Solution** (`lib/csv.ts`, `lib/bank-import.ts`):
- **Robust reading** — Quoted fields, escaped quotes, commas/newlines inside quotes, BOM; comma, semicolon or tab delimiters. Account-info lines above the header are skipped.
- **Column detection** — Date, amount (preferring a debit column, never the balance) and description, judged by header names and by what the cells contain.
- **Amounts and dates** — `$1,234.56`, `-1.234,56`, `(12.50)`, `12.50 DR`; day/month vs month/day detected, with a prompt when a file can't tell.
- **The user confirms** — Every guess can be changed in the preview; money-in rows and already-logged expenses are skipped.

### 3. Currency Without Floating-Point Errors

JavaScript's `0.1 + 0.2 !== 0.3` causes subtle budget math errors.

**Solution:** A **cents-based math engine** — all amounts stored and computed as integers (cents). `toCents()` and `fromCents()` convert at the edges. No float arithmetic in core logic.

## Development

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # Vitest: planner maths, templates, currency, backups, reports, bank import
npm run build
```

## Deployment (Vercel)

Connect the repo to Vercel. It will detect Next.js and deploy. No environment variables required.

## License

MIT
