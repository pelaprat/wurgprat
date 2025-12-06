# 🍽️ Meal Planner

A web app for planning weekly meals and groceries together, with Google Calendar and Drive integration.

## Features

- **Weekly Meal Planning**: Visual calendar to plan breakfast, lunch, and dinner
- **Shared Access**: Both you and your partner can view and edit plans
- **Recipe Library**: Save and organize your favorite recipes
- **Grocery Lists**: Auto-generate shopping lists from your meal plan
- **Google Calendar Sync**: Meals appear on your shared calendar
- **Google Drive Export**: Save grocery lists as Google Docs

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Auth**: NextAuth.js with Google OAuth
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **APIs**: Google Calendar, Google Drive
- **Deployment**: Vercel

---

## Setup Guide

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd meal-planner
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, go to **SQL Editor** and run the contents of `supabase-schema.sql`
3. Go to **Settings > API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Set Up Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable these APIs:
   - Google Calendar API
   - Google Drive API
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth client ID**
6. Select **Web application**
7. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://your-domain.vercel.app/api/auth/callback/google` (production)
8. Copy the Client ID and Client Secret

### 4. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in all the values:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<run: openssl rand -base64 32>

# Google OAuth
GOOGLE_CLIENT_ID=<from step 3>
GOOGLE_CLIENT_SECRET=<from step 3>

# Supabase
NEXT_PUBLIC_SUPABASE_URL=<from step 2>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from step 2>
SUPABASE_SERVICE_ROLE_KEY=<from step 2>
```

Generate `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

### 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and import your GitHub repo
2. Add all environment variables from `.env.local`
3. Update `NEXTAUTH_URL` to your Vercel domain
4. Deploy!

### 3. Update Google OAuth

Go back to Google Cloud Console and add your production redirect URI:
```
https://your-app.vercel.app/api/auth/callback/google
```

---

## Adding Your Partner

Once deployed:

1. You sign in first (this creates your household)
2. In Supabase, note your `household_id` from the `users` table
3. When your partner signs in, update their user record to share the same `household_id`

(Future enhancement: Add an invite system with household codes)

---

## Project Structure

```
meal-planner/
├── src/
│   ├── app/
│   │   ├── api/auth/[...nextauth]/  # Auth endpoint
│   │   ├── meals/                    # Weekly planning page
│   │   ├── groceries/                # Grocery list page
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # Home page
│   ├── components/
│   │   ├── Navigation.tsx
│   │   └── Providers.tsx
│   ├── lib/
│   │   ├── auth.ts                   # NextAuth config
│   │   ├── google.ts                 # Google API helpers
│   │   └── supabase.ts               # Supabase client
│   └── types/
│       └── index.ts                  # TypeScript types
├── supabase-schema.sql               # Database schema
├── .env.example                      # Environment template
└── package.json
```

---

## Next Steps

Features to build out:

- [ ] Connect meal plan to Supabase (currently uses local state)
- [ ] Connect grocery list to Supabase
- [ ] Implement Calendar sync button
- [ ] Implement Drive export button
- [ ] Add recipe detail pages
- [ ] Add recipe import from URL
- [ ] Household invite system
- [ ] Meal suggestions based on history

---

## Development with Claude Code

This project was scaffolded for continued development with Claude Code. To iterate:

```bash
claude
```

Then ask Claude to help with features like:
- "Connect the meal plan page to Supabase"
- "Implement the Google Calendar sync"
- "Add a recipe import feature"

---

## License

MIT
