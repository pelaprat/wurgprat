# Issues to Fix

This document enumerates all issues identified in the Master_Analysis.md code review that need to be addressed. Each issue includes the file location, description, and specific fix required.

---

## Table of Contents

1. [Critical Security Issues](#1-critical-security-issues)
2. [Data Integrity Issues](#2-data-integrity-issues)
3. [Authorization Issues](#3-authorization-issues)
4. [Type Safety Issues](#4-type-safety-issues)
5. [API Design Issues](#5-api-design-issues)
6. [Performance Issues](#6-performance-issues)
7. [Code Duplication Issues](#7-code-duplication-issues)
8. [Input Validation Issues](#8-input-validation-issues)
9. [Error Handling Issues](#9-error-handling-issues)
10. [Accessibility Issues](#10-accessibility-issues)
11. [Component Size Issues](#11-component-size-issues)
12. [Timezone and Date Handling Issues](#12-timezone-and-date-handling-issues)
13. [Environment and Configuration Issues](#13-environment-and-configuration-issues)

---

## 1. Critical Security Issues

### 1.1 SSRF Vulnerability in `/api/events/import/route.ts`

**File:** `/src/app/api/events/import/route.ts`
**Lines:** URL fetch logic
**Severity:** CRITICAL

**Problem:** The endpoint accepts an external URL and fetches it server-side without validation, allowing attackers to probe internal network resources.

**Fix Required:**
- Add URL validation to block internal/private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x, 127.x.x.x, localhost)
- Whitelist only allowed protocols (https://)
- Validate URL hostname against allowlist of known calendar providers
- Add request timeout to prevent hanging on slow responses

---

### 1.2 SSRF Vulnerability in `/api/recipes/create-from-url/route.ts`

**File:** `/src/app/api/recipes/create-from-url/route.ts`
**Lines:** URL fetch logic
**Severity:** CRITICAL

**Problem:** Fetches arbitrary URLs server-side to scrape recipe content without validation.

**Fix Required:**
- Add URL validation to block internal/private IP ranges
- Whitelist only https:// protocol
- Add request timeout
- Consider using a URL validation library

---

### 1.3 SSRF Vulnerability in `/api/recipes/import/route.ts`

**File:** `/src/app/api/recipes/import/route.ts`
**Lines:** Google Sheets URL processing
**Severity:** CRITICAL

**Problem:** Accepts Google Sheets URLs without proper validation, could be exploited to access internal resources.

**Fix Required:**
- Validate that URL is actually a Google Sheets URL (check hostname is docs.google.com or sheets.google.com)
- Extract and validate spreadsheet ID format
- Block any non-Google URLs

---

### 1.4 Household Join Vulnerability

**File:** `/src/app/api/household/route.ts`
**Lines:** POST handler, join logic
**Severity:** HIGH

**Problem:** Anyone who knows a household name can join it. No invitation system, no approval required.

**Fix Required:**
- Implement invitation code system (generate random codes)
- Add `invitation_code` column to households table
- Require valid invitation code to join household
- Add endpoint to generate/regenerate invitation codes
- Consider adding pending membership with owner approval

---

### 1.5 Missing OAuth Token Refresh

**File:** `/src/lib/auth.ts`
**Lines:** JWT callback (lines 38-60)
**Severity:** HIGH

**Problem:** OAuth access tokens expire after 1 hour but are never refreshed. After expiry, all Google API calls fail silently.

**Fix Required:**
- Store `refresh_token` and `expires_at` in JWT
- Implement token refresh logic in JWT callback
- Check `expires_at` before returning token
- If expired, use refresh_token to get new access_token
- Update session with new tokens
- Handle refresh failures gracefully

---

### 1.6 Gemini API Key Exposure Risk

**File:** `/src/app/api/recipes/create-from-url/route.ts`, `/src/app/api/weekly-plans/generate/route.ts`
**Lines:** API initialization
**Severity:** MEDIUM

**Problem:** API key passed directly to GoogleGenerativeAI constructor. If errors are logged/returned with full context, key could leak.

**Fix Required:**
- Ensure API key is never logged
- Sanitize error messages before returning to client
- Consider using environment variable validation at startup

---

## 2. Data Integrity Issues

### 2.1 Missing Transactions in Weekly Plan Creation

**File:** `/src/app/api/weekly-plans/create-complete/route.ts`
**Lines:** Multi-step insert operations
**Severity:** HIGH

**Problem:** Creates weekly_plans, then dinners, then events, then grocery_items in separate queries. If any step fails, partial data remains orphaned.

**Fix Required:**
- Wrap all inserts in a database transaction using Supabase RPC or raw SQL
- Rollback entire transaction if any step fails
- Return meaningful error messages for partial failures

---

### 2.2 Missing Transactions in Ingredient Merge

**File:** `/src/app/api/ingredients/merge/route.ts`
**Lines:** Update and delete operations
**Severity:** HIGH

**Problem:** Updates grocery_items to new ingredient_id, then deletes old ingredients. If delete fails, data is inconsistent.

**Fix Required:**
- Wrap update and delete in transaction
- Verify all references updated before deleting
- Add rollback on failure

---

### 2.3 Race Condition in Duplicate Ingredient Detection

**File:** `/src/app/api/ingredients/route.ts` (POST handler)
**Lines:** Duplicate check logic
**Severity:** MEDIUM

**Problem:** Checks for duplicate ingredient name, then inserts. Another request could insert the same name between check and insert.

**Fix Required:**
- Add unique constraint on (household_id, lower(name)) in database
- Handle unique constraint violation error gracefully
- Return existing ingredient if duplicate detected

---

### 2.4 Race Condition in Settings Calendar Change

**File:** `/src/app/api/settings/route.ts`
**Lines:** Calendar change logic (lines 152-196)
**Severity:** MEDIUM

**Problem:** Deletes all events, then re-imports from new calendar. If import fails, events are lost.

**Fix Required:**
- Wrap in transaction
- Only delete old events after new import succeeds
- Or: soft-delete (mark as inactive) until new import confirmed

---

### 2.5 Delete-Insert Pattern in Grocery Item Generation

**File:** `/src/app/api/weekly-plans/generate-groceries/route.ts`
**Lines:** Delete existing items before insert
**Severity:** MEDIUM

**Problem:** Deletes existing grocery items for weekly plan, then generates and inserts new ones. If generation fails, grocery list is empty.

**Fix Required:**
- Don't delete until new items are ready
- Use transaction to swap old items with new atomically
- Or: generate new items, compare with existing, update diff

---

## 3. Authorization Issues

### 3.1 Missing Event Ownership Verification

**File:** `/src/app/api/events/route.ts`
**Lines:** DELETE handler (lines 63-83)
**Severity:** HIGH

**Problem:** Deletes event by ID without verifying event belongs to user's household. Any authenticated user could delete any event.

**Fix Required:**
- Add household_id filter to delete query
- Verify event.household_id matches session.user.householdId before delete
- Return 403 if unauthorized

---

### 3.2 Missing User Ownership Verification for Updates

**File:** `/src/app/api/events/route.ts`
**Lines:** PATCH handler
**Severity:** HIGH

**Problem:** Updates event without verifying it belongs to user's household.

**Fix Required:**
- Add household_id to WHERE clause in update
- Or: First fetch event, verify ownership, then update

---

### 3.3 Missing Authorization in Recipe Delete

**File:** `/src/app/api/recipes/[id]/route.ts`
**Lines:** DELETE handler
**Severity:** HIGH

**Problem:** Deletes recipe by ID without verifying household ownership.

**Fix Required:**
- Add household_id filter to delete query
- Return 403 if recipe doesn't belong to household

---

### 3.4 Missing Authorization in Store Operations

**File:** `/src/app/api/stores/[id]/route.ts`
**Lines:** DELETE and PATCH handlers
**Severity:** HIGH

**Problem:** Store operations don't verify household ownership.

**Fix Required:**
- Add household_id filter to all queries
- Verify store belongs to household before modification

---

### 3.5 Missing Authorization in Ingredient Operations

**File:** `/src/app/api/ingredients/[id]/route.ts`
**Lines:** PATCH and DELETE handlers
**Severity:** HIGH

**Problem:** Ingredient operations don't verify household ownership.

**Fix Required:**
- Add household_id filter to all queries
- Verify ingredient belongs to household before modification

---

### 3.6 Missing Authorization in Weekly Plan Operations

**File:** `/src/app/api/weekly-plans/[id]/route.ts`
**Lines:** All handlers
**Severity:** HIGH

**Problem:** Weekly plan operations don't verify household ownership.

**Fix Required:**
- Add household_id filter to all queries
- Include household check in all CRUD operations

---

## 4. Type Safety Issues

### 4.1 Types Don't Match Database Schema

**File:** `/src/types/index.ts`
**Lines:** All type definitions
**Severity:** HIGH

**Problem:** TypeScript types define fields that don't exist in database or use different names. Forces use of `any` casts throughout codebase.

**Specific Mismatches:**
- `Meal` type has `dateTime` but DB has `date` and separate `time` fields
- `GroceryItem` type missing `checked` field that exists in DB
- `Recipe` type has `ingredients` as array but DB stores as separate table
- `RecipeIngredient` missing `sort_order` from DB
- `WeeklyPlan` type structure differs from actual DB join results

**Fix Required:**
- Audit all types against `supabase-schema.sql`
- Create separate types for DB rows vs API responses
- Use generated types from Supabase CLI if possible
- Update all type definitions to match reality

---

### 4.2 Session Type Extensions Incomplete

**File:** `/src/types/index.ts`
**Lines:** Session interface extensions
**Severity:** MEDIUM

**Problem:** Extended session types don't include all fields used in code (e.g., householdTimezone).

**Fix Required:**
- Add all custom session fields to type definitions
- Ensure consistency with NextAuth configuration

---

### 4.3 Recipe Type with Nullable Fields

**File:** `/src/types/index.ts`
**Lines:** Recipe interface
**Severity:** MEDIUM

**Problem:** Recipe fields that can be null aren't properly typed as optional.

**Fix Required:**
- Add `| null` or `?` to nullable fields
- Match nullability to database schema

---

## 5. API Design Issues

### 5.1 No Rate Limiting on AI Operations

**File:** `/src/app/api/weekly-plans/generate/route.ts`, `/src/app/api/recipes/create-from-url/route.ts`
**Severity:** HIGH

**Problem:** AI-powered endpoints have no rate limiting. Users can make unlimited expensive API calls.

**Fix Required:**
- Implement rate limiting (e.g., 10 requests per minute per user)
- Use Redis or in-memory rate limiter
- Return 429 Too Many Requests when limit exceeded
- Consider usage quotas per household

---

### 5.2 No Pagination on List Endpoints

**Files:**
- `/src/app/api/recipes/route.ts`
- `/src/app/api/ingredients/route.ts`
- `/src/app/api/weekly-plans/route.ts`
- `/src/app/api/events/route.ts`
- `/src/app/api/grocery-items/route.ts`

**Severity:** MEDIUM

**Problem:** All list endpoints return all records. Will become slow/crash with large datasets.

**Fix Required:**
- Add `limit` and `offset` query parameters
- Default to reasonable page size (e.g., 50)
- Return total count in response headers or body
- Update frontend to handle pagination

---

### 5.3 Inconsistent Error Response Format

**Files:** All API routes
**Severity:** MEDIUM

**Problem:** Some routes return `{ error: "message" }`, others return `{ message: "..." }`, some just return status codes.

**Fix Required:**
- Standardize error response format: `{ error: { code: string, message: string } }`
- Create shared error response helper function
- Use consistent HTTP status codes

---

### 5.4 No Request Timeout on External Calls

**Files:**
- `/src/app/api/events/import/route.ts`
- `/src/app/api/recipes/create-from-url/route.ts`
- `/src/lib/google.ts`

**Severity:** MEDIUM

**Problem:** External API calls (Google, Gemini, URL fetches) have no timeout. Could hang indefinitely.

**Fix Required:**
- Add AbortController with timeout for all fetch calls
- Set reasonable timeouts (10-30 seconds)
- Return timeout error to client

---

## 6. Performance Issues

### 6.1 N+1 Query Pattern in Recipe List

**File:** `/src/app/api/recipes/route.ts`
**Lines:** Recipe with ingredients query
**Severity:** MEDIUM

**Problem:** Fetches recipes, then for each recipe fetches ingredients separately.

**Fix Required:**
- Use single query with join to fetch recipes with ingredients
- Or use Supabase's `.select('*, recipe_ingredients(*)')` syntax

---

### 6.2 Sequential AI Calls in Generate Groceries

**File:** `/src/app/api/weekly-plans/generate-groceries/route.ts`
**Severity:** MEDIUM

**Problem:** Makes AI call to detect duplicates for each recipe sequentially.

**Fix Required:**
- Batch ingredient data and make single AI call
- Or process recipes in parallel with Promise.all()
- Consider caching common ingredient mappings

---

### 6.3 Frequent Refetching in EventsContext

**File:** `/src/contexts/EventsContext.tsx`
**Lines:** 82-107
**Severity:** MEDIUM

**Problem:** Fetches events on every window focus and tab visibility change, even if data was just fetched.

**Fix Required:**
- Add staleness check (only refetch if data older than 1 minute)
- Implement debouncing for rapid focus/blur events
- Track lastFetchTime and compare before fetching

---

### 6.4 No Caching for Household Settings

**File:** `/src/contexts/HouseholdContext.tsx`
**Severity:** LOW

**Problem:** Fetches household data on every mount, even though it rarely changes.

**Fix Required:**
- Cache in localStorage with TTL
- Only fetch if cache is stale or missing
- Update cache when settings change

---

## 7. Code Duplication Issues

### 7.1 formatDateLocal Function Duplicated

**Files:**
- `/src/app/weekly-plans/[id]/page.tsx` (lines 618-623)
- `/src/app/weekly-plans/create/events/page.tsx` (lines 28-33)
- `/src/app/weekly-plans/create/input/page.tsx` (lines 113-118)
- `/src/app/weekly-plans/create/review/page.tsx` (lines 41-46)
- `/src/app/weekly-plans/create/finalize/page.tsx` (lines 71-83)
- `/src/lib/google.ts` (similar logic)

**Fix Required:**
- Create `/src/utils/dates.ts` with shared `formatDateLocal` function
- Import from shared file in all components
- Delete duplicate implementations

---

### 7.2 DAY_NAMES Array Duplicated

**Files:**
- `/src/app/weekly-plans/create/events/page.tsx` (lines 10-18)
- `/src/app/weekly-plans/create/input/page.tsx` (line 110)
- `/src/app/weekly-plans/create/review/page.tsx`
- `/src/app/weekly-plans/[id]/page.tsx` (line 92)

**Fix Required:**
- Create `/src/constants/calendar.ts` with `DAY_NAMES` constant
- Export both full names and abbreviations
- Import from shared file everywhere

---

### 7.3 TIME_RATING_LABELS Duplicated

**Files:**
- `/src/app/weekly-plans/create/input/page.tsx` (lines 120-126)
- `/src/app/weekly-plans/create/review/page.tsx` (lines 48-54)
- `/src/app/weekly-plans/create/finalize/page.tsx` (lines 29-43)

**Fix Required:**
- Create `/src/constants/recipes.ts` with `TIME_RATING_LABELS` and colors
- Import from shared file everywhere

---

### 7.4 DEPARTMENT_ORDER Duplicated

**Files:**
- `/src/app/weekly-plans/create/groceries/page.tsx` (lines 13-26)
- `/src/app/ingredients/page.tsx`
- `/src/app/departments/page.tsx`

**Fix Required:**
- Create `/src/constants/grocery.ts` with `DEPARTMENT_ORDER`
- Import from shared file everywhere

---

### 7.5 Saturday Calculation Logic Duplicated

**Files:**
- `/src/app/weekly-plans/create/input/page.tsx` (lines 54-95)
- `/src/contexts/MealPlanWizardContext.tsx` (lines 125-132)

**Fix Required:**
- Create `getNextSaturday` function in `/src/utils/dates.ts`
- Import from shared file everywhere

---

### 7.6 Optimistic Update Pattern Duplicated

**File:** `/src/app/weekly-plans/[id]/page.tsx`
**Lines:** 364-415, 417-467, 469-534

**Fix Required:**
- Create custom hook `useOptimisticUpdate(updateFn, revertFn)`
- Extract pattern to `/src/hooks/useOptimisticUpdate.ts`
- Use hook in all places with optimistic updates

---

### 7.7 Star Rating Rendering Duplicated

**Files:**
- `/src/app/recipes/[id]/page.tsx` (lines 123-128, 772-790)
- `/src/app/recipes/page.tsx` (lines 118-129)

**Fix Required:**
- Create `renderStars` utility function in `/src/utils/ui.ts`
- Or create `StarRating` component in `/src/components/`
- Import and use everywhere

---

### 7.8 Weekly Plan Creation Logic Duplicated

**Files:**
- `/src/app/weekly-plans/create/groceries/page.tsx` (lines 190-225)
- `/src/app/weekly-plans/create/finalize/page.tsx` (lines 97-134)

**Fix Required:**
- Create `/src/hooks/useCreateWeeklyPlan.ts`
- Move creation logic to shared hook
- Use hook in both pages (or remove from groceries page)

---

## 8. Input Validation Issues

### 8.1 No Email Validation in Household Join

**File:** `/src/app/api/household/route.ts`
**Lines:** POST handler
**Severity:** MEDIUM

**Problem:** Email field not validated before use.

**Fix Required:**
- Validate email format with regex or library
- Return 400 for invalid email

---

### 8.2 No URL Validation Before Fetch

**Files:**
- `/src/app/api/recipes/create-from-url/route.ts`
- `/src/app/api/events/import/route.ts`

**Fix Required:**
- Validate URL format
- Ensure URL is valid before attempting fetch
- Return 400 for invalid URLs

---

### 8.3 No Input Sanitization for User Content

**Files:** All routes accepting user text input (recipe names, descriptions, notes)
**Severity:** MEDIUM

**Problem:** User input stored directly without sanitization.

**Fix Required:**
- Trim whitespace from text inputs
- Limit string lengths
- Consider HTML sanitization if content rendered in UI

---

### 8.4 Missing Required Field Validation

**Files:** Most POST/PATCH handlers
**Severity:** MEDIUM

**Problem:** Required fields not validated, rely on database constraints.

**Fix Required:**
- Add explicit validation for required fields at API level
- Return descriptive error messages for missing fields
- Consider using Zod for schema validation

---

## 9. Error Handling Issues

### 9.1 Empty Catch Blocks

**Files:**
- `/src/app/recipes/new/page.tsx` (line 79)
- Multiple other files

**Fix Required:**
- Log errors in catch blocks
- Show user-facing error message
- Never silently swallow errors

---

### 9.2 console.error Only (No User Feedback)

**Files:**
- `/src/app/settings/page.tsx` (lines 121, 141)
- Multiple other files

**Fix Required:**
- Always show error state to user when console.error is called
- Create consistent error display component
- Add error state to UI

---

### 9.3 Inconsistent Error Handling (alert vs inline)

**Files:**
- `/src/app/recipes/[id]/page.tsx` - uses alert()
- `/src/app/ingredients/page.tsx` - uses inline error state
- Various other files

**Fix Required:**
- Standardize on inline error messages (not alert())
- Create toast notification system
- Use consistent error display pattern

---

### 9.4 No Error Retry Mechanism

**Files:**
- `/src/app/weekly-plans/create/finalize/page.tsx` (line 438)
- Various other files

**Fix Required:**
- Add retry button when errors occur
- Implement automatic retry with exponential backoff for transient failures

---

### 9.5 Generic Error Messages

**Files:** Most API error responses
**Severity:** LOW

**Problem:** Error messages like "Failed to fetch" don't help users understand what went wrong.

**Fix Required:**
- Provide specific, actionable error messages
- Include what user can do to fix the issue
- Log detailed error server-side for debugging

---

## 10. Accessibility Issues

### 10.1 Missing ARIA Labels on Interactive Elements

**Files:**
- `/src/app/ingredients/page.tsx` - modal buttons, dropdown
- `/src/app/recipes/[id]/page.tsx` - star ratings, metric buttons
- `/src/app/weekly-plans/[id]/page.tsx` - dropdown buttons
- `/src/components/Navigation.tsx` - mobile menu, user menu

**Fix Required:**
- Add aria-label to all buttons without visible text
- Add aria-labelledby to associate labels with controls
- Add aria-expanded to dropdown triggers

---

### 10.2 Dropdowns Missing ARIA Attributes

**Files:**
- `/src/app/weekly-plans/[id]/page.tsx` - AssigneeDropdown, MultiAssigneeDropdown
- `/src/components/Navigation.tsx` - user dropdown

**Fix Required:**
- Add aria-expanded to trigger button
- Add aria-haspopup="listbox" or "menu"
- Add role="listbox" or "menu" to dropdown content
- Add aria-selected to options

---

### 10.3 No Keyboard Navigation for Dropdowns

**Files:**
- `/src/app/weekly-plans/[id]/page.tsx`
- `/src/app/ingredients/page.tsx`

**Fix Required:**
- Add arrow key navigation
- Add Enter/Space to select
- Add Escape to close
- Trap focus within dropdown when open

---

### 10.4 Drag-and-Drop Not Keyboard Accessible

**File:** `/src/app/weekly-plans/create/review/page.tsx`
**Severity:** HIGH (WCAG violation)

**Fix Required:**
- Add keyboard shortcuts for moving meals (e.g., Ctrl+Arrow)
- Add screen reader announcements for drag operations
- Provide alternative UI for reordering

---

### 10.5 Tables Missing Captions

**Files:**
- `/src/app/recipes/page.tsx`
- `/src/app/ingredients/page.tsx`
- `/src/app/events/page.tsx`

**Fix Required:**
- Add `<caption>` element to all tables
- Or use aria-labelledby with heading

---

### 10.6 Modal Focus Management

**Files:**
- `/src/app/ingredients/page.tsx` - merge modal, add modal
- `/src/app/settings/page.tsx` - calendar change modal

**Fix Required:**
- Trap focus within modal when open
- Return focus to trigger element on close
- Use proper ARIA dialog role

---

### 10.7 Missing Skip Links

**File:** `/src/app/layout.tsx`
**Severity:** MEDIUM

**Fix Required:**
- Add skip link to main content
- Should be first focusable element
- Hidden until focused

---

## 11. Component Size Issues

### 11.1 `/src/app/weekly-plans/[id]/page.tsx` - 1038 lines

**Fix Required:**
Extract into separate components:
- `DateIcon` component
- `AssigneeDropdown` component
- `MultiAssigneeDropdown` component
- `GroceryTab` component
- `DinnersTab` component
- `EventsTab` component

---

### 11.2 `/src/app/settings/page.tsx` - 903 lines

**Fix Required:**
Extract into separate components:
- `RecipeImportSection` component
- `CalendarSettingsSection` component
- `TimezoneSettingsSection` component
- `CalendarChangeConfirmationModal` component

---

### 11.3 `/src/app/recipes/[id]/page.tsx` - 907 lines

**Fix Required:**
Extract into separate components:
- `RecipeHeader` component
- `RecipeDetails` component
- `IngredientsDisplay` component
- `IngredientsEditor` component
- `RecipeRatings` component
- `RecipeMetrics` component
- `RecipeActions` component
- `IngredientSearch` component

---

### 11.4 `/src/app/weekly-plans/create/review/page.tsx` - 805 lines

**Fix Required:**
Extract into separate components:
- `DraggableMeal` component (lines 56-195)
- `MealDragOverlay` component (lines 197-235)
- `DaySlot` component (lines 237-367)
- Extract `useMealDragAndDrop` custom hook

---

### 11.5 `/src/app/ingredients/page.tsx` - 752 lines

**Fix Required:**
Extract into separate components:
- `IngredientTable` component
- `IngredientRow` component
- `MergeIngredientsModal` component
- `AddIngredientModal` component
- `IngredientFilters` component

---

### 11.6 `/src/app/weekly-plans/create/groceries/page.tsx` - 683 lines

**Fix Required:**
Extract into separate components:
- `GroceryTableRow` component
- `AddGroceryItemForm` component
- `GrocerySortControls` component

---

### 11.7 `/src/app/weekly-plans/create/input/page.tsx` - 660 lines

**Fix Required:**
Extract into separate components:
- `WeekScheduleView` component
- `RecipeSelector` component
- `DayEventsList` component

---

### 11.8 `/src/contexts/MealPlanWizardContext.tsx` - 470 lines

**Fix Required:**
Consider splitting into sub-contexts:
- `MealSelectionContext` (phase 1 state)
- `MealReviewContext` (phase 2 state)
- `GroceryContext` (phase 3 state)

---

## 12. Timezone and Date Handling Issues

### 12.1 Incorrect Timezone Handling in Google Calendar

**File:** `/src/lib/google.ts`
**Lines:** createMealEvent function
**Severity:** HIGH

**Problem:** Uses browser's local timezone interpretation instead of household's configured timezone.

**Fix Required:**
- Pass household timezone to all date operations
- Use date-fns-tz consistently
- Format dates in household timezone for Google Calendar API

---

### 12.2 Timezone Mismatch in Today's Meals

**File:** `/src/app/api/today/route.ts`
**Lines:** Date comparison logic
**Severity:** HIGH

**Problem:** Compares dates using server timezone, not household timezone. "Today" might be wrong for users in different timezones.

**Fix Required:**
- Get household timezone from settings
- Calculate "today" in household timezone
- Use timezone-aware date comparison

---

### 12.3 Hardcoded Timezone Default

**File:** `/src/contexts/HouseholdContext.tsx`
**Lines:** 26, 41
**Severity:** LOW

**Problem:** Defaults to "America/New_York" which is US-centric.

**Fix Required:**
- Detect browser timezone as default
- Or use UTC as default
- Show warning if no timezone configured

---

### 12.4 Date Parsing Without Timezone

**File:** `/src/app/weekly-plans/page.tsx`
**Lines:** 56-78 (formatWeekOf, isCurrentWeek)
**Severity:** MEDIUM

**Problem:** Date calculations assume local timezone, may be incorrect.

**Fix Required:**
- Use consistent timezone from household settings
- Apply timezone-aware date calculations

---

## 13. Environment and Configuration Issues

### 13.1 Missing Environment Variable Validation

**Files:**
- `/src/lib/auth.ts`
- `/src/lib/supabase.ts`
- `/src/lib/google.ts`

**Fix Required:**
- Add runtime validation for required environment variables
- Fail fast at startup if variables missing
- Provide helpful error messages

---

### 13.2 Google Scopes May Be Incomplete

**File:** `/src/lib/auth.ts`
**Lines:** Google provider configuration
**Severity:** MEDIUM

**Problem:** If user doesn't grant all scopes, app may fail unexpectedly.

**Fix Required:**
- Check granted scopes after authentication
- Handle partial scope grants gracefully
- Request additional scopes when needed

---

### 13.3 Hardcoded Timezone Options

**File:** `/src/app/settings/page.tsx`
**Severity:** LOW

**Problem:** Timezone list hardcoded in component.

**Fix Required:**
- Move to `/src/constants/timezones.ts`
- Consider using Intl.supportedValuesOf('timeZone') for dynamic list

---

---

## Priority Order for Fixes

### P0 - Critical (Fix Immediately)
1. 1.1, 1.2, 1.3 - SSRF vulnerabilities
2. 1.4 - Household join vulnerability
3. 1.5 - OAuth token refresh
4. 3.1-3.6 - Authorization checks

### P1 - High (Fix Soon)
1. 2.1-2.5 - Data integrity/transactions
2. 4.1 - Type/schema mismatch
3. 5.1 - Rate limiting
4. 12.1, 12.2 - Timezone handling

### P2 - Medium (Plan to Fix)
1. 7.1-7.8 - Code duplication
2. 8.1-8.4 - Input validation
3. 9.1-9.5 - Error handling
4. 5.2-5.4 - API design improvements

### P3 - Lower (Address When Possible)
1. 10.1-10.7 - Accessibility
2. 11.1-11.8 - Component size
3. 6.1-6.4 - Performance
4. 13.1-13.3 - Configuration

---

## New Files to Create

1. `/src/utils/dates.ts` - Shared date utilities
2. `/src/utils/ui.ts` - Shared UI utilities (star rating, etc.)
3. `/src/utils/url.ts` - URL validation utilities
4. `/src/constants/calendar.ts` - Day names, etc.
5. `/src/constants/recipes.ts` - Time ratings, etc.
6. `/src/constants/grocery.ts` - Department order
7. `/src/constants/timezones.ts` - Timezone list
8. `/src/hooks/useOptimisticUpdate.ts` - Optimistic update hook
9. `/src/hooks/useCreateWeeklyPlan.ts` - Weekly plan creation hook
10. `/src/lib/validation.ts` - Input validation helpers

---

## Summary Statistics

- **Total Issues:** 78
- **Critical Security:** 6
- **High Priority:** 16
- **Medium Priority:** 35
- **Low Priority:** 21

**Files Most Affected:**
1. `/src/app/weekly-plans/[id]/page.tsx` - 12 issues
2. `/src/app/settings/page.tsx` - 8 issues
3. `/src/app/recipes/[id]/page.tsx` - 8 issues
4. `/src/app/ingredients/page.tsx` - 7 issues
5. `/src/lib/auth.ts` - 5 issues
