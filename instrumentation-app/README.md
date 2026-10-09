# Instrumentation Engineering Operations & Maintenance System

A mobile-first maintenance management system for an instrumentation department: breakdown
tracking, equipment database, live dashboard, shift handover, PM/calibration, spare parts,
and an AI troubleshooting assistant. Built on Next.js + Supabase, deployable free on Vercel.

## What's included and working

- Auth (Supabase, email/password), route protection via middleware, roles (admin/engineer/technician)
- Live dashboard with active/critical/completed breakdown counts
- Full breakdown workflow: report → assign → investigate → repair → test → restore → close,
  with findings/root cause/corrective action fields and computed downtime
- Equipment database: list, add, detail page with breakdown history
- AI troubleshooting assistant wired to a free Groq API endpoint
- Complete database schema with Row-Level Security policies (`supabase/schema.sql`)
- Scaffolded (queries working, forms not yet built) pages for: shift handover, PM &
  calibration, spare parts, reports, admin user list — each page says exactly what the
  next build step is

## 1. Prerequisites (all free)

- [GitHub](https://github.com) account
- [Supabase](https://supabase.com) account
- [Vercel](https://vercel.com) account
- [Groq](https://console.groq.com) account (optional, only for the AI assistant — free tier)
- Node.js 18+ installed locally, or use GitHub Codespaces (also free)

## 2. Set up Supabase

1. Create a new Supabase project.
2. Go to **SQL Editor** → New query → paste the entire contents of `supabase/schema.sql` → Run.
3. Go to **Project Settings → API** and copy your **Project URL** and **anon public key**.
4. Go to **Authentication → Providers** and make sure Email is enabled.
5. Create your first user: **Authentication → Users → Add user** (this becomes your first
   technician account — promote yourself to `admin` by running, in the SQL Editor:
   ```sql
   update profiles set role = 'admin' where id = 'paste-the-user-id-here';
   ```

## 3. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GROQ_API_KEY=your-groq-key   # optional, for the AI assistant
```

## 4. Run locally (optional, to test before deploying)

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

## 5. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## 6. Deploy on Vercel

1. In Vercel: **Add New → Project → Import** your GitHub repo.
2. Vercel auto-detects Next.js — no build config changes needed.
3. Under **Environment Variables**, add the same three variables from `.env.local`.
4. Click **Deploy**. Your app will be live at `your-project.vercel.app`.
5. Every future `git push` to `main` auto-deploys.

## 7. Next build steps (in priority order)

1. Shift handover create-form (mirror `breakdowns/new/page.tsx`)
2. Spare parts + PM/calibration create-forms
3. Photo upload for breakdowns (Supabase Storage — bucket + `breakdown_photos` insert)
4. Reports: PDF/CSV export route
5. Admin: role-change control on the users page
6. MTTR/MTBF calculations as a Postgres view, surfaced on the dashboard
7. AI knowledge base search (full-text now, pgvector later once you have real case history)

## Notes

- All RLS policies are enforced at the database level — the frontend doesn't need to
  duplicate permission checks, but the roadmap above should still add UI-level guards
  (e.g. hiding "Add Equipment" from technicians) for a cleaner experience.
- `types/database.ts` has hand-written types for now. Once your schema is stable, run
  `npx supabase gen types typescript --project-id your-project-id` for full type safety.

## v23 additions

- **Automatic stock deduction:** record parts on a breakdown ("Spare parts used"). Stock is deducted
  atomically in the database; "Return" puts it back.
- **Reorder suggestions:** the Spare Parts page flags out-of-stock, low-stock and running-low parts
  (from the last 90 days of usage), suggests an order quantity and exports a CSV.
- **Calendar:** month view of PM due dates (including projected recurrences), breakdowns by day and
  rosters uploaded that month.
- **Team Workload** (engineers/admins): open work per person weighted by priority, unassigned faults,
  and a suggested assignee. The "Assign to" list also shows each person's open count.

**Upgrade an existing database:** run `supabase/migrations/v23_parts_calendar_workload.sql` once in the
Supabase SQL Editor *before* deploying. New installs get the same SQL at the end of `schema.sql`.

## v24 additions

- **PM "Mark done":** any signed-in staff member can complete a PM task. The next due date rolls forward
  from the date done, and every completion is logged (who, when, notes) with a CSV download.
- **Calibration records:** new "Calibration records" tab under PM & Calibration with as-found / as-left,
  standard used, certificate number, result, next due date and the person who performed it. Calibration
  due dates also appear on the Calendar.
- **Spare-part audit trail:** every use now records the person (name + SAP), the machine/equipment, the
  location, notes and time. New **Usage history** page with filters and **CSV / PDF download** of all records.

**Upgrade an existing database:** run `supabase/migrations/v24_pm_done_calibration_parts_audit.sql` once in
the Supabase SQL Editor (after v23) *before* deploying. New installs get the same SQL at the end of `schema.sql`.

## v25 additions

- **Equipment is registered per production line.** Adding equipment now requires a line, and the Equipment
  page has line filters. Older items without a line show under "No line" and can be assigned with one tap.
- **Line-filtered pickers.** Choosing a line on the Report Breakdown, Edit Breakdown, PM schedule,
  Calibration and Spare-part-used forms lists only the equipment registered on that line.
- **Shift handovers per line.** Each handover is written for one line (with optional shift personnel), the
  Handover page has line filters and shows the latest handover for every line.

**Upgrade an existing database:** run `supabase/migrations/v25_equipment_by_line_handover_by_line.sql` once in
the Supabase SQL Editor (after v24) *before* deploying. New installs get the same SQL at the end of `schema.sql`.

## v26 additions

- **Packer spout calibration** (menu: *Spout Calibration*), built from the paper log. Per production line, each
  packer gets a sheet of M/N rows (packer RP, spouts SP1..SPn, check weigher CW) with **Before** zero/span,
  **After** zero/span and **Error % = (span before - span after) x 2**, worked out automatically.
  Lines 3, 4, 5 default to 8 spouts per packer, Line 1 & 2 to 12 (editable in Packer setup).
- **Daily rotation:** one packer per line per day, in order, none on Sundays; the page shows what is due today.
- **Sign-off:** every sheet has Instrumentation (recorded automatically) and Production (name, staff no., remarks,
  can be signed later) blocks; the PDF includes signature boxes for both departments.
- **Downloads:** single-sheet PDF, all-sheets PDF and CSV, filtered by line, packer and date range.

**Upgrade an existing database:** run `supabase/migrations/v26_packer_spout_calibration.sql` once in the Supabase SQL
Editor (after v25) *before* deploying, then open *Spout Calibration -> Packer setup* to add each line's packers.

## v27 additions

- **Shift duty on the Calendar:** pick Shift A, B, C or General and every day is marked **D** (morning),
  **N** (night), **O** (off) or **G** (general). Shifts rotate 3 mornings, 3 nights, 3 off. A 7-day strip and
  today's position (for example "Night, day 2 of 3") are shown, and the selected day lists all three shifts.
- **Monthly Duty Roster** (menu: *Duty Roster*): staff names and SAP numbers on the left, days across, with
  D / N / O / G. Admins add staff (pick an app user, or type name + SAP), assign each to A, B, C or General
  (Mon-Sat), change any single day (tap in Edit mode) or a range (Quick set), and everyone can download
  **CSV (Excel)** or **PDF**.
- **Shift pattern settings:** admins tell the app what each shift is doing on a chosen date; the rest is calculated.

**Upgrade an existing database:** run `supabase/migrations/v27_shift_duty_roster.sql` once in the Supabase SQL
Editor (after v26) *before* deploying. It presets the pattern to "today = Shift B night day 2, Shift C morning
day 2, Shift A off day 2" for the day it is run; check it under *Duty Roster -> Shift pattern*.

## v28 additions

- **Leave on the duty roster:** Annual (AL), Sick (SL) and Casual (CA) leave. Admins plan leave for a person
  over an optional date interval ("Plan leave"), by default counting only working days (rest days stay O), or
  every day if ticked. Each leave period can later be changed (move the end later to add days, earlier to
  reduce them) or removed, and single days can still be changed by tapping the roster.
- **Leave record** (Duty Roster -> Leave record): days of AL, SL and CA per person per year, split into taken
  and planned, worked out from the roster, with CSV and PDF downloads. Roster exports now include the leave codes.
- **Your own calendar:** when you view your own shift on the Calendar, your leave and duty changes show as AL / SL / CA.
- **Shift pattern correction:** today (2026-10-09) Shift B is on night day 3, Shift C on morning day 3 and
  Shift A on off day 3.

**Upgrade an existing database (in this order, each once):**
1. `supabase/migrations/v28_leave_codes.sql` (allows the leave codes)
2. `supabase/migrations/v28_fix_shift_pattern.sql` (sets the corrected shift reference)
