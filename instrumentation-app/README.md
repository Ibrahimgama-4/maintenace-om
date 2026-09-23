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
