# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Build for production
npm run lint     # Run ESLint
```

## Architecture

This is a Next.js 14 App Router application for meal planning with household sharing.

### Key Integrations

- **NextAuth.js** (`src/lib/auth.ts`): Google OAuth with Calendar and Drive scopes. Access tokens are persisted in JWT for API calls.
- **Supabase** (`src/lib/supabase.ts`): PostgreSQL database with Row Level Security. Uses `getServiceSupabase()` for elevated server-side operations.
- **Google APIs** (`src/lib/google.ts`): Calendar for meal events, Drive for grocery list export.

### Data Model

You will find a description of the data model in `docs/DATA_MODEL.md`.

### UI Spec

You will find a description of the UI specs to follow in `docs/UI_SPECS.md`.

Database schema is in `supabase-schema.sql`.

### Type Definitions

`src/types/index.ts` contains TypeScript types for `Meal`, `MealPlan`, `GroceryItem`, `Household`, plus NextAuth session extensions.

### Component Structure

- `src/components/Providers.tsx` - Client-side SessionProvider wrapper
- `src/components/Navigation.tsx` - App navigation
- Pages use the App Router pattern in `src/app/`

## Environment Variables

Required in `.env.local` (see `.env.example`):
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
