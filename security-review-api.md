# API Security Review Report
**Application:** Wurgprat (Household Meal Planning Application)
**Review Date:** 2026-02-05
**Reviewed By:** Security Analysis Agent
**Scope:** All API routes in `/src/app/api/`

---

## Executive Summary

This security review identified **multiple critical and high-severity vulnerabilities** in the API layer of the Wurgprat application. The most concerning issues are:

1. **No rate limiting** on financial transaction endpoints (allowance system)
2. **No CSRF protection** on any state-changing operations
3. **Mass assignment vulnerabilities** in multiple update endpoints
4. **Insufficient input validation** across the application
5. **Information leakage** through verbose error messages

**Overall Risk Rating: HIGH**

The application has good household-level authorization controls and uses RLS (Row Level Security) at the database level, which provides a strong foundation. However, the lack of rate limiting and CSRF protection poses significant risks, especially for the allowance/financial transaction features.

---

## Critical Findings

### 1. No Rate Limiting on Financial Transactions
**Risk Rating:** CRITICAL
**Affected Endpoints:**
- `/api/kids/[id]/allowance` (POST)
- `/api/kids/[id]/allowance/withdraw` (POST)

**Description:**
The allowance system handles financial transactions but has no rate limiting. An attacker who gains access to a valid session could:
- Rapidly create thousands of deposit transactions
- Automate withdrawal requests
- Cause database bloat and potential denial of service

**Location:**
- File: `/src/app/api/kids/[id]/allowance/route.ts`, lines 105-271
- File: `/src/app/api/kids/[id]/allowance/withdraw/route.ts`, lines 14-147

**Evidence:**
```typescript
// No rate limiting check before processing transaction
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  // ... directly processes transaction
  const body = await request.json();
  const { amount, description } = body;
```

**Remediation:**
1. Implement rate limiting using a solution like `upstash/ratelimit` or `express-rate-limit`
2. Limit to 10 transactions per hour per user
3. Implement additional validation for large transactions (e.g., amounts > $100)
4. Add transaction frequency monitoring and alerting

---

### 2. No CSRF Protection
**Risk Rating:** CRITICAL
**Affected Endpoints:** ALL state-changing operations (POST, PUT, PATCH, DELETE)

**Description:**
The application uses NextAuth for authentication but does not implement CSRF protection for API routes. This means an attacker could create a malicious website that makes requests to the API on behalf of an authenticated user.

**Location:** No middleware found, no CSRF token validation in any endpoint

**Attack Scenario:**
1. User authenticates to wurgprat.com
2. User visits malicious site evil.com
3. evil.com makes POST request to `https://wurgprat.com/api/kids/[id]/allowance` with victim's session cookie
4. Transaction is processed successfully

**Evidence:**
```bash
# Search results show no CSRF protection
$ grep -r "csrf\|CSRF\|X-CSRF-Token" src/
# No results found
```

**Remediation:**
1. NextAuth provides built-in CSRF protection for its own endpoints, but API routes need custom protection
2. Implement CSRF token validation using Next.js middleware
3. Use the `SameSite=Strict` or `SameSite=Lax` cookie attribute (verify current setting)
4. Consider using custom headers (e.g., `X-Requested-With: XMLHttpRequest`) as an additional check

---

### 3. Mass Assignment Vulnerabilities
**Risk Rating:** HIGH
**Affected Endpoints:**
- `/api/kids/[id]/route.ts` (PUT)
- `/api/recipes/[id]/route.ts` (PUT)
- `/api/kids/[id]/route.ts` (PATCH)

**Description:**
Several endpoints accept request bodies and update database records without proper field whitelisting, allowing clients to potentially modify unintended fields.

**Location:**
File: `/src/app/api/kids/[id]/route.ts`, lines 56-118

**Evidence:**
```typescript
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // ...
  const body = await request.json();

  // Directly uses body fields without validation
  const { data: kid, error: updateError } = await supabase
    .from("kids")
    .update({
      first_name: body.first_name.trim(),
      last_name: body.last_name?.trim() || null,
      email: body.email?.trim() || null,
      birth_date: body.birth_date || null,
      allowance_balance: body.allowance_balance ?? 0,  // ⚠️ Direct balance manipulation
      prat_points: body.prat_points ?? 0,              // ⚠️ Direct points manipulation
    })
```

**Risk:**
A malicious client could modify `allowance_balance` and `prat_points` directly by including these fields in the request, bypassing the transaction system.

**Better Implementation (PATCH endpoint has partial protection):**
```typescript
// Line 144-163 shows allowedFields pattern
const updateData: Record<string, unknown> = {};
const allowedFields = [
  "first_name",
  "last_name",
  "email",
  "birth_date",
  // allowance_balance and prat_points should NOT be in allowedFields
];
```

**Remediation:**
1. Remove `allowance_balance` and `prat_points` from all direct update endpoints
2. These should ONLY be modified through dedicated transaction endpoints
3. Implement strict field whitelisting on ALL update operations
4. Consider using a validation library like Zod or Joi

---

### 4. Insufficient Input Validation
**Risk Rating:** HIGH
**Affected Endpoints:** Most POST/PUT/PATCH endpoints

**Description:**
The application lacks comprehensive input validation. While some endpoints check basic types, there's no validation library in use and many edge cases are not handled.

**Location:** Throughout `/src/app/api/`

**Evidence:**
```json
// package.json shows no validation libraries
{
  "dependencies": {
    // No zod, joi, yup, or similar validation libraries
  }
}
```

**Examples of Missing Validation:**

1. **Numeric Bounds** (`/api/kids/[id]/allowance/route.ts:116`)
```typescript
if (typeof amount !== "number" || amount <= 0) {
  // ✅ Good: checks positive
  // ❌ Missing: upper bound check, decimal places validation
}
```

2. **String Length** (`/api/kids/route.ts:100`)
```typescript
if (!body.first_name?.trim()) {
  // ✅ Checks for empty
  // ❌ Missing: max length, special character restrictions
}
```

3. **Email Validation** (`/api/kids/[id]/route.ts:91`)
```typescript
email: body.email?.trim() || null,
// ❌ No email format validation
```

4. **Allowance Splits** (`/api/settings/allowance-splits/route.ts:73`)
```typescript
if (!Array.isArray(splits) || splits.length !== 3) {
  // ✅ Checks array length
  // ❌ Missing: What if splits.length > 100 before this check? DoS risk
}
```

**Remediation:**
1. Install and use Zod for runtime type validation:
   ```typescript
   import { z } from 'zod';

   const AllowanceSchema = z.object({
     amount: z.number().positive().max(10000).multipleOf(0.01),
     description: z.string().min(1).max(500).optional()
   });
   ```
2. Validate ALL user input at the API boundary
3. Set reasonable limits on string lengths (e.g., names: 100 chars, descriptions: 2000 chars)
4. Validate email formats before storing
5. Sanitize inputs to prevent potential injection attacks

---

### 5. Information Leakage via Error Messages
**Risk Rating:** MEDIUM
**Affected Endpoints:** Most endpoints

**Description:**
Error responses include detailed database error messages and codes that expose internal structure and implementation details.

**Location:** Throughout `/src/app/api/`

**Evidence:**
```typescript
// /src/app/api/kids/[id]/route.ts:104-115
if (updateError) {
  console.error("Failed to update kid:", updateError);

  let errorMessage = "Failed to update kid";
  if (updateError.code === "42P01") {
    errorMessage = "Database table not found. Please run the kids migration.";
  } else if (updateError.message) {
    errorMessage = `Database error: ${updateError.message}`;  // ⚠️ Exposes DB internals
  }

  return NextResponse.json({ error: errorMessage }, { status: 500 });
}
```

**Additional Examples:**
- Line 72, `/src/app/api/kids/[id]/allowance/route.ts`: Logs full error to console (visible in logs)
- Line 233, `/src/app/api/kids/[id]/route.ts`: Exposes database error messages to client

**Risk:**
- Attackers can learn about database schema
- Error codes reveal database type (PostgreSQL)
- Stack traces in development might leak in production

**Remediation:**
1. Use generic error messages for clients: "An error occurred. Please try again."
2. Log detailed errors server-side only
3. Implement error codes for client-side handling without exposing internals
4. Ensure production environment doesn't expose stack traces

---

## High Findings

### 6. Missing Authentication on Cron Endpoint
**Risk Rating:** HIGH
**Affected Endpoint:** `/api/cron/rating-reminders`

**Description:**
The cron endpoint uses a simple bearer token check instead of proper API key authentication with rotation capabilities.

**Location:**
File: `/src/app/api/cron/rating-reminders/route.ts`, lines 10-14

**Evidence:**
```typescript
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
```

**Issues:**
1. String comparison vulnerable to timing attacks
2. No token rotation mechanism
3. If CRON_SECRET leaks, entire cron system is compromised
4. No logging of failed authentication attempts

**Remediation:**
1. Use constant-time string comparison to prevent timing attacks
2. Implement token rotation with grace period
3. Add rate limiting on this endpoint
4. Log all authentication attempts (success and failure)
5. Consider using Vercel's built-in cron authentication if available

---

### 7. Potential Race Conditions in Transactions
**Risk Rating:** MEDIUM-HIGH
**Affected Endpoints:**
- `/api/kids/[id]/allowance/route.ts`
- `/api/kids/[id]/allowance/withdraw/route.ts`

**Description:**
The allowance transaction endpoints perform multiple database operations without proper transaction isolation, creating potential race conditions.

**Location:**
File: `/src/app/api/kids/[id]/allowance/withdraw/route.ts`, lines 72-109

**Evidence:**
```typescript
// Step 1: Read balance
const { data: split, error: splitError } = await supabase
  .from("allowance_splits")
  .select("id, balance")
  .eq("kid_id", id)
  .eq("split_key", split_key)
  .single();

// Step 2: Check sufficient balance
if (split.balance < amount) {
  return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
}

// Step 3: Update balance (RACE CONDITION HERE)
const newBalance = split.balance - amount;
const { data: updatedSplit, error: updateError } = await supabase
  .from("allowance_splits")
  .update({ balance: newBalance })
  .eq("id", split.id)
```

**Attack Scenario:**
1. User has $50 balance
2. Two withdrawal requests for $30 each are sent simultaneously
3. Both requests read balance as $50
4. Both pass the balance check
5. Both updates succeed, resulting in -$10 balance

**Remediation:**
1. Use database transactions with SELECT FOR UPDATE
2. Implement optimistic locking with version numbers
3. Use PostgreSQL's row-level locking
4. Consider moving to stored procedures for atomic operations

---

### 8. IDOR Prevention Incomplete
**Risk Rating:** MEDIUM
**Affected Endpoints:** Several resource access endpoints

**Description:**
While most endpoints correctly filter by `household_id`, the implementation is inconsistent and some edge cases exist.

**Good Example:**
```typescript
// /src/app/api/kids/[id]/route.ts:31-36
const { data: kid, error: kidError } = await supabase
  .from("kids")
  .select("*")
  .eq("id", id)
  .eq("household_id", user.household_id)  // ✅ Correct authorization
  .single();
```

**Edge Case:**
File: `/src/app/api/grocery-items/[id]/route.ts`, lines 29-56

```typescript
// Relies on nested joins for authorization - more complex and error-prone
const { data: groceryItem, error: itemError } = await supabase
  .from("grocery_items")
  .select(`
    id,
    grocery_list_id,
    grocery_list:grocery_list_id (
      weekly_plan:weekly_plan_id (
        household_id
      )
    )
  `)
  .eq("id", params.id)
  .single();

// Authorization check done in application code
if (!householdId || householdId !== user.household_id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}
```

**Risk:**
Complex authorization logic is harder to audit and more prone to bugs.

**Remediation:**
1. Standardize authorization patterns across all endpoints
2. Prefer direct household_id checks over nested joins where possible
3. Create reusable authorization middleware
4. Add automated tests for authorization on all endpoints

---

### 9. No Request Size Limits
**Risk Rating:** MEDIUM
**Affected Endpoints:** All POST/PUT endpoints

**Description:**
No request body size limits are enforced at the API layer, allowing potential DoS attacks through large payloads.

**Vulnerable Endpoints:**
- `/api/recipes/create-from-url` - Can fetch arbitrary external URLs
- `/api/weekly-plans/create-complete` - Accepts large meal/grocery arrays
- `/api/ingredients/merge` - Accepts arrays of IDs

**Evidence:**
```typescript
// /src/app/api/weekly-plans/create-complete/route.ts:64
const { weekOf, meals, groceryItems, eventAssignments, notes } = body;
// No check on array sizes
```

**Remediation:**
1. Implement request size limits in Next.js config:
   ```javascript
   // next.config.js
   module.exports = {
     api: {
       bodyParser: {
         sizeLimit: '1mb',
       },
     },
   }
   ```
2. Validate array sizes before processing:
   ```typescript
   if (meals.length > 100) {
     return NextResponse.json({ error: "Too many meals" }, { status: 400 });
   }
   ```
3. Implement timeout limits on external URL fetches (partially implemented but needs review)

---

## Medium Findings

### 10. Weak Token Generation for Rating Links
**Risk Rating:** MEDIUM
**Affected Endpoint:** `/api/rate`

**Description:**
The rating token uses only 16 characters of HMAC output, reducing security margin.

**Location:**
File: `/src/utils/rating-token.ts`, lines 7-17

**Evidence:**
```typescript
export function generateRatingToken(
  recipeId: string,
  userId: string,
  rating: number
): string {
  const secret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET || "";
  return createHmac("sha256", secret)
    .update(`${recipeId}:${userId}:${rating}`)
    .digest("hex")
    .slice(0, 16);  // ⚠️ Only 16 characters = 64 bits
}
```

**Risk:**
While 64 bits is still reasonably secure for this use case, it's below the recommended 128 bits for security tokens. An attacker could potentially brute force valid tokens.

**Remediation:**
1. Use full HMAC output (32 bytes = 256 bits)
2. Add timestamp to HMAC input and validate token age
3. Implement one-time use tokens with database tracking

---

### 11. Case-Insensitive String Matching Without Sanitization
**Risk Rating:** LOW-MEDIUM
**Affected Endpoints:** Several search/lookup endpoints

**Description:**
The application uses `.ilike()` for case-insensitive matching, which could be vulnerable if not properly sanitized (though Supabase client should handle this safely).

**Location:**
File: `/src/app/api/weekly-plans/create-complete/route.ts`, line 292

**Evidence:**
```typescript
const { data: existingIngredient } = await supabase
  .from("ingredients")
  .select("id")
  .eq("household_id", user.household_id)
  .ilike("name", item.ingredientName)  // User-controlled input
  .single();
```

**Current Risk:** LOW (Supabase client provides parameterization)

**Remediation:**
1. Verify Supabase client properly parameterizes `.ilike()` queries
2. Add explicit input sanitization for wildcards (`%`, `_`)
3. Document that `.ilike()` should only be used with sanitized input

---

### 12. No Audit Logging for Sensitive Operations
**Risk Rating:** MEDIUM
**Affected Endpoints:** Financial transactions, data deletion

**Description:**
While transactions are logged in the `allowance_transactions` table, there's no comprehensive audit log for:
- Failed authentication attempts
- Authorization failures
- Data deletion operations
- Settings changes

**Evidence:**
```typescript
// /src/app/api/kids/[id]/route.ts:220-242
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // ...
  const { error: deleteError } = await supabase
    .from("kids")
    .delete()
    .eq("id", id)
    .eq("household_id", user.household_id);
  // ⚠️ No audit log of who deleted what
```

**Remediation:**
1. Implement comprehensive audit logging table
2. Log all failed authorization attempts
3. Log all data deletion operations with user, timestamp, and deleted data summary
4. Implement audit log retention policy
5. Create audit log review dashboard for household admins

---

## Low Findings

### 13. Missing Security Headers
**Risk Rating:** LOW
**Scope:** Application-wide

**Description:**
No custom security headers are configured in Next.js.

**Recommended Headers:**
```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}
```

---

### 14. Console Logging of Sensitive Data
**Risk Rating:** LOW
**Affected Endpoints:** Multiple

**Description:**
Sensitive data is logged to console, which may persist in production logs.

**Examples:**
- Line 72, `/src/app/api/kids/[id]/allowance/route.ts`: Full error objects
- Line 108, `/src/app/api/household/route.ts`: "User joining with invitation code"
- Line 383, `/src/app/api/recipes/create-from-url/route.ts`: Full extracted recipe data

**Remediation:**
1. Remove console.log statements or wrap in development-only checks
2. Use proper logging library with log levels
3. Sanitize logged data to remove sensitive information

---

## Positive Security Practices

The review identified several good security practices:

✅ **Consistent Authentication**: All endpoints properly check session authentication
✅ **Household-Level Authorization**: Strong household_id filtering prevents cross-household access
✅ **Service Role Bypass**: Uses `getServiceSupabase()` to properly bypass RLS for server operations
✅ **SSRF Protection**: URL validation in recipe import endpoint (`/api/recipes/create-from-url`)
✅ **HMAC Token Validation**: Rating links use HMAC for tamper protection
✅ **Input Sanitization**: String trimming and basic type checking throughout
✅ **Database RLS**: Relies on Supabase Row Level Security as defense-in-depth

---

## Remediation Priority

### Immediate (Deploy within 1 week)
1. **Implement rate limiting** on financial transaction endpoints
2. **Remove direct balance manipulation** from PUT/PATCH endpoints
3. **Add request size limits** to prevent DoS

### Short-term (Deploy within 1 month)
4. **Implement CSRF protection** using Next.js middleware
5. **Add comprehensive input validation** using Zod
6. **Fix information leakage** in error messages
7. **Implement transaction isolation** for financial operations

### Medium-term (Deploy within 3 months)
8. **Add audit logging** for sensitive operations
9. **Standardize authorization patterns**
10. **Implement security headers**
11. **Add monitoring and alerting** for suspicious activity

---

## Testing Recommendations

1. **Automated Security Tests**
   - Add API integration tests that verify authorization on all endpoints
   - Test CSRF protection (once implemented)
   - Test rate limiting (once implemented)
   - Fuzz test input validation

2. **Manual Testing**
   - Attempt IDOR attacks across all resource endpoints
   - Test concurrent transaction scenarios
   - Verify household isolation

3. **External Audit**
   - Consider penetration testing before public launch
   - Conduct code review with security specialist

---

## Compliance Considerations

If this application handles real financial data:
- Consider PCI DSS requirements
- Review data retention policies
- Implement proper data encryption at rest and in transit
- Add privacy policy and terms of service
- Ensure GDPR compliance if serving EU users

---

## Conclusion

The Wurgprat application has a solid foundation with good household-level authorization and consistent authentication. However, the lack of rate limiting, CSRF protection, and comprehensive input validation presents significant security risks.

**Recommended Action:** Prioritize implementing rate limiting and CSRF protection before deploying to production, especially given the financial transaction features.

**Overall Risk Rating: HIGH** (can be reduced to MEDIUM with immediate remediations)

---

**Report End**
