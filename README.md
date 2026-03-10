# Allocatify

> **Demo:** [Deploy to Vercel](#deployment) · [Live Preview](#)

A **privacy-first, zero-setup** financial allocation engine. Map your financial distribution instantly—no sign-up, no bank syncing, no spreadsheets.

## Features

- **Zero Friction** — No accounts. Land on the page, enter numbers, see your budget visualized.
- **Privacy by Design** — Data stored only in your browser (IndexedDB). Nothing leaves your device.
- **Smart-Start Templates** — 50/30/20, Freelancer Basic, Student Living, or build custom.
- **Reactive Engine** — Real-time updates as you change allocations.
- **Data Porter** — Export to CSV/PDF. Import from bank CSV with auto column detection.
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

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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

Bank CSVs vary: different column names, encodings, delimiters, and number formats.

**Solution:**
- **Flexible column detection** — `detectAmountColumn()` scans headers for common names (Amount, Debit, Credit, Total) and falls back to the first column that looks numeric
- **Robust parsing** — Handles quoted fields, commas in numbers (`$1,234.56`), and both comma and tab delimiters
- **Graceful degradation** — Returns clear error messages when no usable amount column is found

### 3. Currency Without Floating-Point Errors

JavaScript's `0.1 + 0.2 !== 0.3` causes subtle budget math errors.

**Solution:** A **cents-based math engine** — all amounts stored and computed as integers (cents). `toCents()` and `fromCents()` convert at the edges. No float arithmetic in core logic.

## Deployment (Vercel)

```bash
npm run build
```

Connect the repo to Vercel. It will detect Next.js and deploy. No environment variables required.

## License

MIT
