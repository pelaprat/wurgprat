# Remaining Issues to Fix

This document contains the remaining issues from the code review that still need to be addressed.

**Last Updated:** After initial fix session

---

## Table of Contents

1. [Type Safety Issues](#1-type-safety-issues)
2. [API Design Issues](#2-api-design-issues)
3. [Performance Issues](#3-performance-issues)
4. [Input Validation Issues](#4-input-validation-issues)
5. [Error Handling Issues](#5-error-handling-issues)
6. [Accessibility Issues](#6-accessibility-issues)
7. [Component Size Issues](#7-component-size-issues)
8. [Environment and Configuration Issues](#8-environment-and-configuration-issues)

---

## Previously Fixed Issues

The following categories have been addressed:

- **SSRF Vulnerabilities** - Added URL validation in `/src/utils/url.ts`, updated all fetch endpoints
- **OAuth Token Refresh** - Implemented in `/src/lib/auth.ts`
- **Household Join Vulnerability** - Added invitation code system in `/src/app/api/household/route.ts`
- **Code Duplication** - Created shared utilities in `/src/utils/` and `/src/constants/`
- **Timezone Handling** - Fixed in `/src/app/api/today/route.ts` and `/src/contexts/HouseholdContext.tsx`
- **Authorization Checks** - Verified all routes have `household_id` filters

---

## 1. Type Safety Issues

### 1.1 Types Don't Match Database Schema

**File:** `/src/types/index.ts`
**Severity:** HIGH

**Problem:** TypeScript types are outdated and don't match the actual database schema. This forces use of `any` casts and inline type definitions throughout the codebase.

**Specific Mismatches:**

1. **`Meal` type** - Completely wrong structure:
   - Type has: `name`, `description`, `recipe_url`, `ingredients[]`
   - DB has: `weekly_plan_id`, `recipe_id`, `day`, `meal_type`, `custom_meal_name`, `is_leftover`, `assigned_user_id`, etc.

2. **`MealPlan` type** - Doesn't match any table (should be `WeeklyPlan`)

3. **`GroceryItem` type** - Wrong structure:
   - Type has: `name`, `category`, `household_id`
   - DB has: `grocery_list_id`, `ingredient_id`, `quantity` (numeric), `unit`

4. **`Household` type** - Missing fields:
   - Missing: `timezone`, `settings` (jsonb)

5. **Missing types entirely:**
   - `Recipe`, `Ingredient`, `Store`, `Event`
   - `RecipeIngredient`, `WeeklyPlan`, `GroceryList`
   - `RecipeRating`, `WeeklyPlanEventAssignment`

**Fix Required:**
- Audit all types against `supabase-schema.sql`
- Create accurate types matching the database
- Consider using Supabase CLI to generate types: `npx supabase gen types typescript`

---

### 1.2 Session Type Extensions Incomplete

**File:** `/src/types/index.ts`
**Severity:** MEDIUM

**Problem:** Extended session types don't include all fields used in code.

**Fix Required:**
- Add `error` field to JWT type (used in token refresh)
- Ensure consistency with NextAuth configuration

---

## 2. API Design Issues

### 2.1 No Rate Limiting on AI Operations

**Files:**
- `/src/app/api/weekly-plans/generate/route.ts`
- `/src/app/api/recipes/create-from-url/route.ts`
- `/src/app/api/weekly-plans/generate-grocery-list/route.ts`

**Severity:** HIGH

**Problem:** AI-powered endpoints have no rate limiting. Users can make unlimited expensive API calls.

**Fix Required:**
- Implement rate limiting (e.g., 10 requests per minute per user)
- Use Redis or in-memory rate limiter
- Return 429 Too Many Requests when limit exceeded

---

### 2.2 No Pagination on List Endpoints

**Files:**
- `/src/app/api/recipes/route.ts`
- `/src/app/api/ingredients/route.ts`
- `/src/app/api/weekly-plans/route.ts`
- `/src/app/api/events/route.ts`

**Severity:** MEDIUM

**Problem:** All list endpoints return all records. Will become slow with large datasets.

**Fix Required:**
- Add `limit` and `offset` query parameters
- Default to reasonable page size (e.g., 50)
- Return total count in response

---

### 2.3 Inconsistent Error Response Format

**Files:** All API routes
**Severity:** LOW

**Problem:** Some routes return `{ error: "message" }`, others return `{ message: "..." }`.

**Fix Required:**
- Standardize error response format
- Create shared error response helper function

---

## 3. Performance Issues

### 3.1 Frequent Refetching in EventsContext

**File:** `/src/contexts/EventsContext.tsx`
**Severity:** MEDIUM

**Problem:** Fetches events on every window focus and tab visibility change, even if data was just fetched.

**Fix Required:**
- Add staleness check (only refetch if data older than 1 minute)
- Implement debouncing for rapid focus/blur events

---

### 3.2 No Caching for Household Settings

**File:** `/src/contexts/HouseholdContext.tsx`
**Severity:** LOW

**Problem:** Fetches household data on every mount.

**Fix Required:**
- Cache in localStorage with TTL
- Only fetch if cache is stale

---

## 4. Input Validation Issues

### 4.1 No Input Sanitization for User Content

**Files:** All routes accepting user text input
**Severity:** MEDIUM

**Problem:** User input stored directly without sanitization.

**Fix Required:**
- Trim whitespace from text inputs
- Limit string lengths
- Consider using Zod for schema validation

---

### 4.2 Missing Required Field Validation

**Files:** Most POST/PATCH handlers
**Severity:** MEDIUM

**Problem:** Required fields not validated at API level, rely on database constraints.

**Fix Required:**
- Add explicit validation for required fields
- Return descriptive error messages for missing fields

---

## 5. Error Handling Issues

### 5.1 Empty Catch Blocks

**Files:**
- `/src/app/recipes/new/page.tsx`
- Multiple other files

**Fix Required:**
- Log errors in catch blocks
- Show user-facing error message
- Never silently swallow errors

---

### 5.2 console.error Only (No User Feedback)

**Files:**
- `/src/app/settings/page.tsx`
- Multiple other files

**Fix Required:**
- Always show error state to user when console.error is called
- Add error state to UI

---

### 5.3 Inconsistent Error Handling (alert vs inline)

**Files:**
- `/src/app/recipes/[id]/page.tsx` - uses alert()
- `/src/app/ingredients/page.tsx` - uses inline error state

**Fix Required:**
- Standardize on inline error messages (not alert())
- Consider toast notification system

---

## 6. Accessibility Issues

### 6.1 Missing ARIA Labels on Interactive Elements

**Files:**
- `/src/app/ingredients/page.tsx` - modal buttons, dropdown
- `/src/app/recipes/[id]/page.tsx` - star ratings, metric buttons
- `/src/app/weekly-plans/[id]/page.tsx` - dropdown buttons
- `/src/components/Navigation.tsx` - mobile menu, user menu

**Fix Required:**
- Add aria-label to all buttons without visible text
- Add aria-expanded to dropdown triggers

---

### 6.2 Dropdowns Missing ARIA Attributes

**Files:**
- `/src/app/weekly-plans/[id]/page.tsx` - AssigneeDropdown, MultiAssigneeDropdown
- `/src/components/Navigation.tsx` - user dropdown

**Fix Required:**
- Add aria-expanded, aria-haspopup, role attributes
- Add aria-selected to options

---

### 6.3 No Keyboard Navigation for Dropdowns

**Files:**
- `/src/app/weekly-plans/[id]/page.tsx`
- `/src/app/ingredients/page.tsx`

**Fix Required:**
- Add arrow key navigation
- Add Enter/Space to select, Escape to close

---

### 6.4 Drag-and-Drop Not Keyboard Accessible

**File:** `/src/app/weekly-plans/create/review/page.tsx`
**Severity:** HIGH (WCAG violation)

**Fix Required:**
- Add keyboard shortcuts for moving meals
- Provide alternative UI for reordering

---

### 6.5 Modal Focus Management

**Files:**
- `/src/app/ingredients/page.tsx` - merge modal, add modal
- `/src/app/settings/page.tsx` - calendar change modal

**Fix Required:**
- Trap focus within modal when open
- Return focus to trigger element on close

---

## 7. Component Size Issues

### 7.1 Large Components (600+ lines)

The following components are too large and should be split:

| File | Lines | Suggested Extractions |
|------|-------|----------------------|
| `/src/app/weekly-plans/[id]/page.tsx` | ~1038 | DateIcon, AssigneeDropdown, GroceryTab, DinnersTab, EventsTab |
| `/src/app/settings/page.tsx` | ~903 | RecipeImportSection, CalendarSettingsSection, TimezoneSection |
| `/src/app/recipes/[id]/page.tsx` | ~907 | RecipeHeader, IngredientsEditor, RecipeRatings, RecipeMetrics |
| `/src/app/weekly-plans/create/review/page.tsx` | ~805 | Components already extracted inline, move to separate files |
| `/src/app/ingredients/page.tsx` | ~752 | IngredientTable, MergeModal, AddModal, Filters |
| `/src/app/weekly-plans/create/groceries/page.tsx` | ~683 | GroceryTableRow, AddGroceryItemForm |
| `/src/app/weekly-plans/create/input/page.tsx` | ~660 | WeekScheduleView, RecipeSelector |

---

### 7.2 Optimistic Update Pattern Duplicated

**File:** `/src/app/weekly-plans/[id]/page.tsx`

**Fix Required:**
- Create custom hook `useOptimisticUpdate`
- Extract to `/src/hooks/useOptimisticUpdate.ts`

---

### 7.3 Star Rating Rendering Duplicated

**Files:**
- `/src/app/recipes/[id]/page.tsx`
- `/src/app/recipes/page.tsx`

**Fix Required:**
- Create `StarRating` component in `/src/components/`

---

## 8. Environment and Configuration Issues

### 8.1 Missing Environment Variable Validation

**Files:**
- `/src/lib/auth.ts`
- `/src/lib/supabase.ts`
- `/src/lib/google.ts`

**Fix Required:**
- Add runtime validation for required environment variables
- Fail fast at startup if variables missing

---

### 8.2 Google Scopes May Be Incomplete

**File:** `/src/lib/auth.ts`
**Severity:** MEDIUM

**Problem:** If user doesn't grant all scopes, app may fail unexpectedly.

**Fix Required:**
- Check granted scopes after authentication
- Handle partial scope grants gracefully

---

## Priority Order

### P1 - High Priority
1. Type/schema mismatches (1.1)
2. Rate limiting on AI endpoints (2.1)
3. Drag-and-drop keyboard accessibility (6.4)

### P2 - Medium Priority
1. Pagination on list endpoints (2.2)
2. Input validation (4.1, 4.2)
3. Error handling improvements (5.1-5.3)
4. ARIA attributes (6.1-6.3, 6.5)

### P3 - Lower Priority
1. Performance optimizations (3.1, 3.2)
2. Component refactoring (7.1-7.3)
3. Environment validation (8.1, 8.2)

---

## Summary

- **Total Remaining Issues:** 26
- **High Priority:** 3
- **Medium Priority:** 12
- **Lower Priority:** 11
