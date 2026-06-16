# Chase 54

A Prestonwood Birdie Board Challenge.

54 holes. One goal. Birdie them all.

## Run

Install Node.js 20 or newer, then:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Storage

The app uses **localStorage** by default and seeds itself with 15 sample rounds on first launch.
To enable **Supabase** sync, follow the steps below.

## Supabase Setup (optional)

Supabase lets you persist rounds in a cloud database and sync across devices.

### 1. Create the schema

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) and open your project
2. Go to **SQL Editor**
3. Paste the contents of `supabase-schema.sql` and click **Run**

### 2. Add environment variables

Copy `.env.local.example` to `.env.local` and fill in your credentials:

```bash
cp .env.local.example .env.local
```

```env
# Supabase Dashboard > Settings > API > Project URL
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# Supabase Dashboard > Settings > API > anon / public key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

> Only use the **anon/public** key — never the service role key.
> Both variables are `NEXT_PUBLIC_` which means they are safe to use in client-side code.

### 3. Restart the dev server

```bash
npm run dev
```

### 4. Verify the connection

Open the app, tap the **gear icon** → **Data Settings** → **Test Supabase Connection**.
A green "Connected successfully" message confirms everything is working.

## How it works

- When Supabase env vars are present: rounds load from and save to Supabase. Local storage acts as an offline fallback.
- When env vars are absent: localStorage only.
- Course reference data (Highlands, Meadows, Fairways) is seeded to Supabase automatically on first load.
- Export / Import / Clear / Reset always operate on local browser storage.

## Project layout

```
src/
  app/page.tsx          # Full single-page app (all components)
  lib/
    types.ts            # Shared TypeScript types
    courses.ts          # Static course + hole data
    scoring.ts          # Score calculation helpers
    stats.ts            # Dashboard stat derivations
    sampleData.ts       # 15 seed rounds for first launch
    storage.ts          # localStorage repository
    supabaseClient.ts   # Supabase JS client initialization
    supabaseService.ts  # Supabase DB operations
    dataService.ts      # Unified async service (Supabase → localStorage fallback)
supabase-schema.sql     # Run once in Supabase SQL Editor
```
