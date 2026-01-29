# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Build for production
npm run lint     # Run ESLint
```

## Architecture

This is a Next.js 14 App Router application for household meal planning, grocery management, and kids' allowance tracking. All data is scoped to a household (family unit).

### Key Integrations

- **NextAuth.js** (`src/lib/auth.ts`): Google OAuth with Calendar and Drive scopes. Access tokens are persisted in JWT for API calls. Auto-refreshes tokens 5 minutes before expiry.
- **Supabase** (`src/lib/supabase.ts`): PostgreSQL database with Row Level Security. Uses `getServiceSupabase()` for server-side operations (bypasses RLS). Every table has RLS policies filtering by household via `get_user_household_id()`.
- **Google APIs** (`src/lib/google.ts`): Calendar for meal events, Drive for grocery list export, ICS calendar parsing for event imports.

### Data Model

Full schema: `supabase-schema.sql`. Data model documentation: `docs/DATA_MODEL.md`.

**Core tables:** `households`, `users`, `recipes`, `recipe_ingredients`, `recipe_ratings`, `ingredients`, `stores`, `weekly_plan`, `meals`, `grocery_list`, `grocery_items`, `events`, `weekly_plan_event_assignments`, `kids`, `allowance_splits`, `allowance_transactions`

**Household settings** are stored as JSONB in `households.settings` and include: `default_meal_time`, `week_start_day`, `calendar_id`, `departments[]`, `invitation_code`, `allowance_splits[]`.

### Type Definitions

`src/types/index.ts` contains TypeScript types: `Meal`, `MealPlan`, `GroceryItem`, `Household`, `Kid`, `AllowanceSplit`, `AllowanceTransaction`, `AllowanceSplitConfig`, plus NextAuth session extensions.

### UI Spec

UI specifications: `docs/UI_SPECS.md`.

### Directory Structure

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/                # All API endpoints
│   ├── kids/               # Kids management pages
│   ├── recipes/            # Recipe pages
│   ├── weekly-plans/       # Meal plan wizard and views
│   ├── ingredients/        # Ingredient management
│   ├── stores/             # Store management
│   ├── events/             # Calendar events
│   ├── settings/           # Household settings
│   └── onboarding/         # New user setup
├── components/             # Reusable UI components
│   ├── Navigation.tsx      # App nav (desktop dropdown + mobile drawer)
│   ├── BottomNav.tsx       # Mobile bottom navigation
│   ├── Providers.tsx       # NextAuth SessionProvider wrapper
│   ├── Modal.tsx           # Generic modal
│   ├── BottomSheet.tsx     # Mobile bottom sheet
│   ├── Toast.tsx           # Toast notifications
│   ├── Skeleton.tsx        # Loading skeletons
│   └── WizardProgress.tsx  # Multi-step form progress
├── contexts/               # React contexts (Household, MealPlanWizard, Events)
├── lib/                    # Core libraries (auth, supabase, google)
├── types/                  # TypeScript type definitions
├── utils/                  # Utility functions
├── constants/              # App constants
└── prompts/                # AI prompt templates
```

### Component Patterns

- Pages use the App Router pattern in `src/app/`
- Client components marked with `"use client"` at top
- Mobile-first design: card views on mobile, table views on desktop
- Modals slide up from bottom on mobile, center on desktop
- Loading states use skeleton components from `@/components/Skeleton`

### API Route Pattern

All API routes follow this pattern:
1. Check session via `getServerSession(authOptions)`
2. Get user's `household_id` from the `users` table
3. Query scoped to `household_id` using `getServiceSupabase()`
4. Return JSON with appropriate status codes
5. Error responses: `{ error: string }` with HTTP status

```typescript
// Standard API route structure
const session = await getServerSession(authOptions);
if (!session?.user?.email) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const supabase = getServiceSupabase();
const { data: user } = await supabase
  .from("users").select("id, household_id")
  .eq("email", session.user.email).single();
```

### Key Feature: Kids & Allowance System

Kids have two balance types: **allowance** (split into charity/saving/spending) and **prat points**.

- Allowance deposits auto-split based on household-configured percentages (default 10/20/70)
- Withdrawals require a description and target a specific split
- All transactions are logged in `allowance_transactions` with who/when/why
- Split config stored in `households.settings.allowance_splits`
- API routes: `/api/kids/[id]/allowance`, `/api/kids/[id]/allowance/withdraw`, `/api/kids/[id]/allowance/transactions`
- Settings: `/api/settings/allowance-splits`

### Database Migrations

New migration files go in `supabase-migrations/`. The full schema is maintained in `supabase-schema.sql`.

## Environment Variables

Required in `.env.local` (see `.env.example`):
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
