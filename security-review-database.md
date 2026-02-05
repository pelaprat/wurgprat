# Database and Data Security Review - Wurgprat
**Date:** 2026-02-05
**Reviewer:** Security Analysis
**Scope:** Database configuration, Row Level Security, SQL injection, data validation, and PII exposure

---

## Executive Summary

This security review examined the database and data security posture of the Wurgprat Next.js application. The application implements **Row Level Security (RLS)** at the database level but **bypasses it entirely in all API routes** using the service role key. While household-level authorization is manually enforced in most routes, this pattern introduces significant risk of data leakage through implementation errors.

**Overall Risk Assessment:**
- **Critical Issues:** 3
- **High Issues:** 4
- **Medium Issues:** 4
- **Low Issues:** 3

**Key Strengths:**
- Comprehensive RLS policies defined in database schema
- No raw SQL or string interpolation vulnerabilities found
- SSRF protection implemented for external URL fetching
- Consistent authentication pattern across API routes

**Key Weaknesses:**
- Service role key bypasses RLS in all API routes
- Missing UUID validation on path parameters
- Insufficient numeric bounds validation
- Database error messages exposed to clients
- No audit logging for sensitive operations

---

## Critical Findings

### C1: Complete RLS Bypass Pattern
**Risk:** CRITICAL
**Location:** `/src/lib/supabase.ts`, all API routes
**CVSS:** 8.5 (High)

**Description:**
The application defines comprehensive Row Level Security policies in the database schema (`supabase-schema.sql` lines 286-395) but bypasses them entirely by using `getServiceSupabase()` with the service role key in all API routes. While manual household_id verification is implemented, this pattern is fragile and error-prone.

**Evidence:**
```typescript
// supabase.ts line 10-18
export const getServiceSupabase = () => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
```

All API routes follow this pattern:
```typescript
// Example from /api/recipes/[id]/route.ts
const supabase = getServiceSupabase(); // Bypasses RLS
const { data: user } = await supabase
  .from("users")
  .select("household_id")
  .eq("email", session.user.email)
  .single();
// Manual household verification required in every query
```

**Impact:**
- A single missing `.eq("household_id", user.household_id)` clause could expose cross-household data
- RLS policies are unused defensive layers
- Difficult to audit for authorization gaps
- No defense-in-depth

**Recommendation:**
1. **Immediate:** Audit all queries to verify household_id filtering is present
2. **Short-term:** Implement automated tests that attempt cross-household access
3. **Long-term:** Consider using regular Supabase client with RLS enabled for read operations, reserving service role only for specific admin operations
4. **Best Practice:** Set up RLS with `auth.uid()` properly configured and use the anon key client where possible

**Files Affected:** All 45 API route files

---

### C2: Missing UUID Validation on Path Parameters
**Risk:** CRITICAL
**Location:** All API routes accepting `[id]` parameters
**CVSS:** 7.8 (High)

**Description:**
Path parameters (UUIDs) from URLs are used directly in database queries without validation. While Supabase will reject invalid UUIDs, this creates potential for:
- Information disclosure through error messages
- Denial of service through malformed queries
- Bypass of household checks in edge cases

**Evidence:**
```typescript
// /api/kids/[id]/route.ts line 34-36
const { data: kid, error: kidError } = await supabase
  .from("kids")
  .select("*")
  .eq("id", id)  // 'id' used directly without validation
  .eq("household_id", user.household_id)
```

**Attack Scenario:**
```
GET /api/kids/'; DROP TABLE kids; --/allowance
GET /api/kids/../../../etc/passwd
GET /api/kids/00000000-0000-0000-0000-000000000000
```

**Impact:**
- Potential SQL injection (mitigated by Supabase parameterization)
- Information leakage through database error messages
- DoS through malformed UUID parsing

**Recommendation:**
1. Implement UUID validation middleware or utility function:
```typescript
function isValidUuid(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
```
2. Validate all path parameters before database queries
3. Return generic "Not found" errors for invalid UUIDs
4. Add integration tests with malformed UUIDs

**Files Affected:**
- `/src/app/api/kids/[id]/route.ts`
- `/src/app/api/recipes/[id]/route.ts`
- `/src/app/api/ingredients/[id]/route.ts`
- `/src/app/api/weekly-plans/[id]/route.ts`
- All other routes with `[id]` parameters (20+ files)

---

### C3: Race Condition in Unauthenticated Rating Endpoint
**Risk:** CRITICAL
**Location:** `/src/app/api/rate/route.ts`
**CVSS:** 7.5 (High)

**Description:**
The `/api/rate` endpoint allows unauthenticated rating submissions via HMAC-signed URLs from emails. However, it does **not verify that the user belongs to the household** that owns the recipe before creating the rating. This could allow:
- Cross-household rating manipulation
- Stale rating links to work after user leaves household
- Rating injection if HMAC secret is compromised

**Evidence:**
```typescript
// /api/rate/route.ts lines 27-45
// Verify HMAC token
const expectedToken = generateRatingToken(recipeId, userId, rating);
if (token !== expectedToken) {
  return NextResponse.json({ error: "Invalid token" }, { status: 403 });
}

const supabase = getServiceSupabase();

// Upsert the rating - NO HOUSEHOLD VERIFICATION
const { error: saveError } = await supabase
  .from("recipe_ratings")
  .upsert({
    recipe_id: recipeId,
    user_id: userId,
    rating,
  }, { onConflict: "recipe_id,user_id" });
```

**Attack Scenario:**
1. User receives rating email while in household A
2. User leaves household A and joins household B
3. User clicks stale rating link
4. Rating is created for household A's recipe despite user no longer being a member

**Impact:**
- Data integrity compromise
- Unauthorized modification of recipe ratings
- Potential for targeted rating manipulation

**Recommendation:**
1. Before upserting rating, verify:
   - User exists and has a household_id
   - Recipe exists and belongs to user's current household
   - User's household matches recipe's household
2. Add timestamp validation to rating tokens (expire after 7 days)
3. Include household_id in HMAC calculation:
```typescript
.update(`${recipeId}:${userId}:${rating}:${householdId}`)
```

**Files Affected:**
- `/src/app/api/rate/route.ts`
- `/src/utils/rating-token.ts`

---

## High Findings

### H1: Database Error Message Exposure
**Risk:** HIGH
**Location:** Multiple API routes
**CVSS:** 6.5 (Medium)

**Description:**
Several API routes expose detailed database error messages to clients, potentially revealing schema information, table names, and implementation details.

**Evidence:**
```typescript
// /api/kids/[id]/route.ts lines 107-108
} else if (updateError.message) {
  errorMessage = `Database error: ${updateError.message}`;
}
```

**Impact:**
- Information disclosure about database schema
- Easier reconnaissance for attackers
- Potential exposure of sensitive field names

**Recommendation:**
1. Log detailed errors server-side only
2. Return generic error messages to clients
3. Implement error sanitization middleware:
```typescript
function sanitizeDbError(error: any): string {
  console.error("Database error:", error); // Server-side only
  return "An error occurred. Please try again.";
}
```

**Files Affected:**
- `/src/app/api/kids/[id]/route.ts` (lines 107-108, 186-187, 232-233)
- `/src/app/api/kids/route.ts` (lines 128-129)
- `/src/app/api/recipes/create-from-url/route.ts` (line 421)
- `/src/app/api/recipes/[id]/import-ingredients/route.ts` (line 578)

---

### H2: Insufficient Numeric Bounds Validation
**Risk:** HIGH
**Location:** `/src/app/api/kids/[id]/allowance/route.ts`, `/src/app/api/kids/[id]/allowance/withdraw/route.ts`
**CVSS:** 6.0 (Medium)

**Description:**
Allowance deposit and withdrawal endpoints validate that amounts are positive but lack upper bounds checking, precision limits, or overflow protection.

**Evidence:**
```typescript
// /api/kids/[id]/allowance/route.ts lines 116-121
if (typeof amount !== "number" || amount <= 0) {
  return NextResponse.json(
    { error: "Amount must be a positive number" },
    { status: 400 }
  );
}
// No upper limit check, no precision check
```

**Attack Scenarios:**
1. Deposit $999,999,999,999.99 to cause overflow
2. Deposit 0.000000000001 to test precision handling
3. Withdraw negative amounts (mitigated by check but worth noting)

**Impact:**
- Database overflow errors
- Precision loss in financial calculations
- Potential for money duplication bugs
- Denial of service through large numbers

**Recommendation:**
1. Add maximum amount validation:
```typescript
const MAX_AMOUNT = 999999.99; // $999,999.99
const MIN_AMOUNT = 0.01;

if (amount > MAX_AMOUNT || amount < MIN_AMOUNT) {
  return NextResponse.json({ error: "Amount out of valid range" }, { status: 400 });
}
```
2. Validate precision (max 2 decimal places):
```typescript
if (!Number.isFinite(amount) || Math.round(amount * 100) / 100 !== amount) {
  return NextResponse.json({ error: "Amount must have at most 2 decimal places" }, { status: 400 });
}
```
3. Use database constraints:
```sql
ALTER TABLE kids ADD CONSTRAINT check_allowance_balance
  CHECK (allowance_balance >= 0 AND allowance_balance <= 999999.99);
```

**Files Affected:**
- `/src/app/api/kids/[id]/allowance/route.ts`
- `/src/app/api/kids/[id]/allowance/withdraw/route.ts`
- `/src/app/api/kids/[id]/route.ts`

---

### H3: Weak Rating Token Secret Fallback
**Risk:** HIGH
**Location:** `/src/utils/rating-token.ts`
**CVSS:** 5.8 (Medium)

**Description:**
The rating token generation falls back to an empty string if environment variables are not set, making tokens predictable and vulnerable to forgery.

**Evidence:**
```typescript
// /src/utils/rating-token.ts line 12
const secret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET || "";
```

**Impact:**
- If both env vars are missing, HMAC uses empty secret
- Tokens become trivially forgeable
- Attacker could generate valid rating URLs for any user/recipe
- Mass rating manipulation possible

**Recommendation:**
1. Fail hard if no secret is available:
```typescript
const secret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET;
if (!secret) {
  throw new Error("Rating token secret not configured");
}
```
2. Add runtime environment validation on startup
3. Consider using a dedicated RATING_SECRET env var
4. Document required environment variables

**Files Affected:**
- `/src/utils/rating-token.ts`

---

### H4: No Input Sanitization for JSONB Fields
**Risk:** HIGH
**Location:** `/src/app/api/household/route.ts`, `/src/app/api/settings/route.ts`
**CVSS:** 5.5 (Medium)

**Description:**
JSONB fields (household settings, etc.) are stored without sanitization or schema validation, potentially allowing:
- JavaScript injection in stored data
- Schema pollution
- Prototype pollution attacks
- Unexpected data types breaking application logic

**Evidence:**
```typescript
// /api/household/route.ts lines 115-132
.insert({
  name: trimmedName,
  settings: {
    default_meal_time: "19:00",
    week_start_day: "saturday",
    calendar_id: "primary",
    invitation_code: newInvitationCode,
    departments: [/* ... */],
  },
})
```

```typescript
// /api/settings/route.ts lines 153-161
const updatedSettings = {
  ...(household?.settings || {}),  // Uncontrolled merge
  google_calendar_id,
};
```

**Impact:**
- XSS if JSONB rendered without escaping
- Application crashes from unexpected types
- Settings overwrite/pollution
- Difficult to maintain data integrity

**Recommendation:**
1. Define TypeScript schemas with validation:
```typescript
import { z } from 'zod';

const HouseholdSettingsSchema = z.object({
  default_meal_time: z.string().regex(/^\d{2}:\d{2}$/),
  week_start_day: z.enum(['monday', 'saturday', 'sunday']),
  calendar_id: z.string(),
  invitation_code: z.string().length(6),
  departments: z.array(z.string()).max(20),
  allowance_splits: z.array(z.object({
    key: z.string(),
    name: z.string(),
    percentage: z.number().min(0).max(100)
  })).optional()
});
```
2. Validate before storing:
```typescript
const validated = HouseholdSettingsSchema.parse(body.settings);
```
3. Whitelist allowed fields during merge operations
4. Add database CHECK constraints where possible

**Files Affected:**
- `/src/app/api/household/route.ts`
- `/src/app/api/settings/route.ts`
- `/src/app/api/settings/allowance-splits/route.ts`

---

## Medium Findings

### M1: Email and PII Exposure in Logs
**Risk:** MEDIUM
**Location:** Multiple API routes
**CVSS:** 4.5 (Medium)

**Description:**
User emails and household IDs are logged to console in several locations, potentially exposing PII in server logs, monitoring systems, or error tracking services.

**Evidence:**
```typescript
// /api/household/route.ts
console.log("User not found, creating user for:", session.user.email);
console.log(`User ${session.user.email} joining existing household...`);
console.log(`User ${session.user.email} created new household: ${trimmedName}`);
```

**Impact:**
- PII exposure in log aggregation systems
- GDPR/privacy compliance issues
- Increased attack surface if logs compromised

**Recommendation:**
1. Hash or redact PII in logs:
```typescript
const emailHash = crypto.createHash('sha256').update(email).digest('hex').slice(0, 8);
console.log(`User ${emailHash} created household`);
```
2. Use structured logging with PII filtering
3. Implement log sanitization pipeline
4. Review logging policy and retention

**Files Affected:**
- `/src/app/api/household/route.ts` (lines 44, 108, 146)
- `/src/app/api/settings/route.ts` (line 109)

---

### M2: Missing Rate Limiting
**Risk:** MEDIUM
**Location:** All API routes
**CVSS:** 4.3 (Medium)

**Description:**
No rate limiting is implemented on any API endpoint, allowing:
- Brute force attacks on invitation codes
- DoS through excessive requests
- Resource exhaustion
- Scraping of household data

**Recommendation:**
1. Implement rate limiting middleware:
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
```
2. Different limits for different routes:
   - Authentication: 5 req/15min per IP
   - Read operations: 100 req/15min per user
   - Write operations: 30 req/15min per user
   - Invitation code validation: 3 req/15min per IP
3. Use Vercel Edge Config or Redis for distributed rate limiting
4. Monitor for suspicious patterns

**Files Affected:** All API routes

---

### M3: Invitation Code Brute Force Vulnerability
**Risk:** MEDIUM
**Location:** `/src/app/api/household/route.ts`
**CVSS:** 4.0 (Medium)

**Description:**
Invitation codes are only 6 characters (alphanumeric uppercase), providing only 36^6 = ~2 billion combinations. Combined with no rate limiting and case-insensitive comparison, this is susceptible to brute force.

**Evidence:**
```typescript
// /src/app/api/household/route.ts lines 11-14
function generateInvitationCode(): string {
  return crypto.randomBytes(4).toString("base64url").slice(0, 6).toUpperCase();
}

// Lines 99-103
if (!storedCode || invitation_code.toUpperCase() !== storedCode.toUpperCase()) {
  return NextResponse.json({ error: "Invalid invitation code" }, { status: 403 });
}
```

**Attack Scenario:**
1. Attacker identifies household name through reconnaissance
2. Brute force 6-character invitation code (no rate limiting)
3. Gain unauthorized access to household

**Calculation:**
- 36^6 = 2,176,782,336 combinations
- At 1000 attempts/second = ~25 days
- At 10 attempts/second (more realistic) = ~7 years
- With distributed attack = much faster

**Recommendation:**
1. **Immediate:** Add rate limiting (3 attempts per 15 minutes per IP)
2. Increase code length to 12 characters: `crypto.randomBytes(9).toString('base64url').slice(0, 12)`
3. Add exponential backoff after failed attempts
4. Consider time-limited invitation links instead
5. Add account lockout after 5 failed attempts
6. Alert household admin on failed invitation attempts

**Files Affected:**
- `/src/app/api/household/route.ts`

---

### M4: No Request Body Size Limits
**Risk:** MEDIUM
**Location:** All API routes accepting POST/PUT/PATCH
**CVSS:** 3.8 (Low)

**Description:**
No explicit request body size limits are enforced, potentially allowing:
- DoS through large payload uploads
- Memory exhaustion
- Recipe/ingredient import abuse

**Recommendation:**
1. Configure Next.js API route body size limit in `next.config.js`:
```javascript
module.exports = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
```
2. Add per-route limits for special cases (e.g., recipe import)
3. Validate array lengths before processing

**Files Affected:** All POST/PUT/PATCH routes

---

## Low Findings

### L1: Weak HMAC Token Truncation
**Risk:** LOW
**Location:** `/src/utils/rating-token.ts`
**CVSS:** 3.0 (Low)

**Description:**
Rating tokens use SHA-256 HMAC but truncate to 16 characters, reducing security margin from 256 bits to ~48 bits of effective entropy.

**Evidence:**
```typescript
// /src/utils/rating-token.ts lines 13-16
return createHmac("sha256", secret)
  .update(`${recipeId}:${userId}:${rating}`)
  .digest("hex")
  .slice(0, 16);  // Only 16 hex chars = 64 bits
```

**Recommendation:**
Use at least 32 characters (128 bits) or full hash:
```typescript
.digest("hex"); // Use full 64 characters
// or
.slice(0, 32); // Minimum 128 bits
```

**Files Affected:**
- `/src/utils/rating-token.ts`

---

### L2: No Audit Logging for Sensitive Operations
**Risk:** LOW
**Location:** All API routes
**CVSS:** 2.8 (Low)

**Description:**
No audit trail is maintained for sensitive operations:
- Allowance deposits/withdrawals
- Recipe deletions
- Household membership changes
- Settings modifications

**Recommendation:**
1. Create `audit_log` table:
```sql
CREATE TABLE audit_log (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id uuid REFERENCES households(id),
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);
```
2. Log critical operations
3. Implement audit log retention policy
4. Provide audit log UI for household admins

**Files Affected:** All routes performing sensitive operations

---

### L3: Cron Job Secret Validation Only Checks Header
**Risk:** LOW
**Location:** `/src/app/api/cron/rating-reminders/route.ts`
**CVSS:** 2.5 (Low)

**Description:**
Cron endpoint only validates bearer token in header but doesn't implement additional safeguards like IP whitelisting or request signing.

**Evidence:**
```typescript
// /api/cron/rating-reminders/route.ts lines 11-14
const authHeader = request.headers.get("authorization");
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Recommendation:**
1. Add Vercel cron IP validation (if using Vercel cron)
2. Implement request timestamp validation
3. Add signature validation
4. Consider using Vercel's built-in cron authentication

**Files Affected:**
- `/src/app/api/cron/rating-reminders/route.ts`

---

## SQL Injection Analysis

### Finding: No SQL Injection Vulnerabilities Detected ✓

**Analysis:**
The codebase was thoroughly reviewed for SQL injection vulnerabilities:

1. **No raw SQL found:** Grep for `.rpc(`, `.query(`, `sql\``, and SQL keywords returned no matches
2. **Supabase Query Builder:** All database operations use Supabase's parameterized query builder
3. **No string interpolation in queries:** All values are passed as parameters

**Example of safe pattern:**
```typescript
await supabase
  .from("kids")
  .select("*")
  .eq("id", id)  // Parameterized, safe
  .eq("household_id", user.household_id);  // Parameterized, safe
```

**Conclusion:** SQL injection risk is effectively mitigated by the Supabase client library.

---

## Row Level Security Analysis

### RLS Policies Defined But Bypassed

**Schema Review:** `/supabase-schema.sql` lines 286-492

The database has comprehensive RLS policies:
- ✓ All tables have RLS enabled
- ✓ Policies filter by `get_user_household_id()`
- ✓ Helper function uses `auth.jwt()->>'email'`
- ✓ Policies cover SELECT, INSERT, UPDATE, DELETE

**Critical Issue:**
The RLS function `get_user_household_id()` (line 307-310) relies on `auth.jwt()` which is **only populated when using Supabase auth**. Since the application uses NextAuth instead and bypasses RLS with the service role key, these policies are **never enforced**.

**Evidence:**
```sql
-- supabase-schema.sql line 307-310
create or replace function get_user_household_id()
returns uuid as $$
  select household_id from public.users where email = auth.jwt()->>'email'
$$ language sql security definer set search_path = public;
```

```typescript
// All API routes use service role which bypasses RLS
const supabase = getServiceSupabase(); // Service role key
```

**Recommendation:**
- Document that RLS is not in use due to NextAuth
- Consider migrating to Supabase Auth to leverage RLS
- OR: Keep current pattern but add automated testing for household isolation
- Add comments in schema explaining RLS is defensive only

---

## Environment Variables Security

### Secrets Management Review

**Analysis of `.env.example`:**

✓ **Properly secured:**
- NEXTAUTH_SECRET (session signing)
- GOOGLE_CLIENT_SECRET (OAuth)
- SUPABASE_SERVICE_ROLE_KEY (database admin)
- GEMINI_API_KEY (AI features)
- RESEND_API_KEY (email)
- CRON_SECRET (cron authentication)

**Issues:**
1. No .env.local in .gitignore verification performed
2. No secret rotation policy documented
3. Service role key used universally (should be restricted)

**Recommendation:**
1. Verify .gitignore excludes `.env.local`
2. Document secret rotation procedures
3. Consider using Vercel Environment Variables for production
4. Implement secret scanning in CI/CD

---

## SSRF Protection Review

### Finding: Comprehensive SSRF Protection ✓

**Location:** `/src/utils/url.ts`

**Analysis:**
- ✓ Validates URL protocol (HTTP/HTTPS only)
- ✓ Blocks private IP ranges (10.x, 172.16-31.x, 192.168.x)
- ✓ Blocks localhost and link-local addresses
- ✓ Blocks cloud metadata endpoints (169.254.169.254)
- ✓ Blocks authentication credentials in URLs
- ✓ Enforces HTTPS for calendar URLs
- ✓ Implements fetch timeout (30 seconds)

**Coverage:**
Used in:
- ICS calendar imports (`/src/lib/google.ts` line 349)
- Recipe URL imports (via validation)

**Recommendation:**
Consider adding:
- DNS rebinding protection (resolve hostname, check IP before fetch)
- Content-Type validation after fetch
- Response size limits

---

## Data Encryption and PII

### Encryption Analysis

**Data at Rest:**
- ✓ Supabase provides encryption at rest
- ✓ No credit card or payment data stored
- ✓ No plaintext passwords (OAuth only)

**PII Stored:**
- User email (required for auth)
- User name (from Google profile)
- Kid names, emails, birthdates
- User profile pictures (URLs)

**Issues:**
1. No field-level encryption for sensitive kid data
2. Invitation codes stored in plaintext in JSONB
3. User emails logged in application logs

**Recommendation:**
1. Consider encrypting kid birthdates if not actively used
2. Implement PII data export (GDPR compliance)
3. Add data deletion flows
4. Document data retention policy

---

## Recommended Immediate Actions

1. **[CRITICAL]** Audit all API routes for missing `.eq("household_id", ...)` clauses
2. **[CRITICAL]** Implement UUID validation on all path parameters
3. **[CRITICAL]** Fix rating endpoint to verify household membership
4. **[HIGH]** Add numeric bounds validation to allowance operations
5. **[HIGH]** Fix rating token secret fallback to fail instead of empty string
6. **[MEDIUM]** Implement rate limiting on authentication and invitation endpoints
7. **[MEDIUM]** Add request body size limits
8. **[LOW]** Remove or hash PII from console.log statements

---

## Testing Recommendations

### Security Test Cases to Implement

1. **Cross-Household Data Access Tests:**
```typescript
test('User cannot access other household recipes', async () => {
  // Create two households
  // Verify user1 cannot read/update/delete user2's recipes
});
```

2. **UUID Validation Tests:**
```typescript
test('Invalid UUIDs return 400 not 500', async () => {
  const response = await fetch('/api/kids/not-a-uuid');
  expect(response.status).toBe(400);
});
```

3. **Allowance Bounds Tests:**
```typescript
test('Cannot deposit more than $999,999', async () => {
  const response = await POST('/api/kids/123/allowance', {
    amount: 9999999999
  });
  expect(response.status).toBe(400);
});
```

4. **Rate Limiting Tests:**
```typescript
test('Invitation code brute force is rate limited', async () => {
  // Make 10 requests in quick succession
  // Verify 429 Too Many Requests
});
```

---

## Compliance Considerations

### GDPR / Privacy

**Current State:**
- User consent not explicitly collected
- No data export functionality
- No account deletion flow
- PII logged in application logs

**Required Actions:**
1. Add privacy policy and terms of service
2. Implement data export API endpoint
3. Implement account deletion with data anonymization
4. Add cookie consent banner if using tracking
5. Document data retention periods

---

## Conclusion

The Wurgprat application demonstrates solid fundamental security practices with Supabase's query builder preventing SQL injection and SSRF protections in place. However, the decision to bypass Row Level Security in favor of manual household_id verification creates significant risk of data leakage through implementation errors.

**Priority Recommendations:**
1. Implement comprehensive integration tests for household data isolation
2. Add UUID validation middleware
3. Fix the unauthenticated rating endpoint
4. Implement rate limiting
5. Add numeric bounds validation
6. Consider migrating to RLS-enforced pattern or document current risks

The codebase would benefit from a security-focused code review before production deployment, particularly around the household isolation logic which is the primary security boundary in the application.

---

**Reviewed Files:** 45+ API routes, core libraries, database schema
**Review Method:** Manual static analysis, pattern matching, threat modeling
**Next Steps:** Address critical findings, implement recommended tests, schedule follow-up review
