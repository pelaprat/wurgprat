# Wurgprat Unified Security Remediation Plan

**Generated:** 2026-02-05
**Based on:** 5 independent security reviews covering Authentication, Database, API, Frontend, and Infrastructure

---

## Executive Summary

A comprehensive security analysis of the Wurgprat application identified **47 security findings** across 5 domains. The most critical issues are:

1. **RLS Bypass** - All database queries bypass Row Level Security, eliminating defense-in-depth
2. **OAuth Token Exposure** - Access tokens sent to client, enabling account takeover via XSS
3. **Vulnerable Dependencies** - Next.js 14.2.3 has known cache poisoning and DoS vulnerabilities
4. **Missing Security Headers** - No CSP, HSTS, or X-Frame-Options configured
5. **No Rate Limiting** - Financial transactions and expensive operations unprotected

**Overall Risk Rating: HIGH**

With remediation, risk can be reduced to LOW-MEDIUM within 4-6 weeks.

---

## Risk Matrix Summary

| Severity | Count | Domains Affected |
|----------|-------|------------------|
| CRITICAL | 5 | Auth, Database, API, Frontend, Infrastructure |
| HIGH | 14 | All domains |
| MEDIUM | 13 | All domains |
| LOW | 7 | Auth, Database, API, Infrastructure |

---

## Phase 1: CRITICAL (Deploy within 48 hours)

### 1.1 Update Vulnerable Dependencies
**Source:** Infrastructure Review
**Risk:** CRITICAL (CVSS 7.5-9.8)
**Effort:** 1 hour

```bash
npm install next@14.2.35 eslint-config-next@latest
npm audit fix
npm run build && npm test
```

### 1.2 Remove OAuth Access Token from Client Session
**Source:** Auth Review, Frontend Review
**Risk:** CRITICAL
**Effort:** 2-4 hours

**File:** `src/lib/auth.ts`

```typescript
// REMOVE from session callback (lines 139-145):
async session({ session, token }) {
  // DELETE THIS LINE: session.accessToken = token.accessToken as string;
  if (token.error) {
    session.error = token.error as string;
  }
  return session;
}
```

**Impact:** Google API calls must now be made server-side only. Update any client components using `session.accessToken`.

### 1.3 Fix HMAC Secret Fallback
**Source:** Auth Review, Database Review
**Risk:** CRITICAL
**Effort:** 30 minutes

**File:** `src/utils/rating-token.ts`

```typescript
export function generateRatingToken(
  recipeId: string,
  userId: string,
  rating: number
): string {
  const secret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("Rating token secret not configured");
  }

  return createHmac("sha256", secret)
    .update(`${recipeId}:${userId}:${rating}`)
    .digest("hex")
    .slice(0, 32); // Increase from 16 to 32 characters
}
```

### 1.4 Add UUID Validation to All API Routes
**Source:** Database Review
**Risk:** CRITICAL
**Effort:** 2-3 hours

**Create:** `src/utils/validation.ts`

```typescript
export function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function validateUuidParam(id: string): NextResponse | null {
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }
  return null;
}
```

Apply to all `[id]` routes (~20+ files).

### 1.5 Fix Rating Endpoint Household Verification
**Source:** Database Review
**Risk:** CRITICAL
**Effort:** 1 hour

**File:** `src/app/api/rate/route.ts`

Add household verification before upserting rating:

```typescript
// After HMAC validation, before upsert:
const { data: user } = await supabase
  .from("users")
  .select("household_id")
  .eq("id", userId)
  .single();

const { data: recipe } = await supabase
  .from("recipes")
  .select("household_id")
  .eq("id", recipeId)
  .single();

if (!user || !recipe || user.household_id !== recipe.household_id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}
```

---

## Phase 2: HIGH Priority (Deploy within 1 week)

### 2.1 Implement Security Headers
**Source:** Frontend Review, Infrastructure Review
**Risk:** HIGH
**Effort:** 2-4 hours

**Create:** `src/middleware.ts`

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Content Security Policy
  response.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.supabase.co https://*.google.com https://generativelanguage.googleapis.com",
    "frame-src https://accounts.google.com",
    "frame-ancestors 'none'",
  ].join('; '));

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 2.2 Add NextAuth Security Configuration
**Source:** Auth Review
**Risk:** HIGH
**Effort:** 1-2 hours

**File:** `src/lib/auth.ts`

```typescript
export const authOptions: NextAuthOptions = {
  // Add these configurations:
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60,   // 24 hours
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  // ... existing providers, callbacks, pages
};
```

### 2.3 Fix Mass Assignment in Kids Update Endpoint
**Source:** API Review
**Risk:** HIGH
**Effort:** 1 hour

**File:** `src/app/api/kids/[id]/route.ts`

Remove `allowance_balance` and `prat_points` from PUT endpoint:

```typescript
// REMOVE these fields from update object:
// allowance_balance: body.allowance_balance ?? 0,  // DELETE
// prat_points: body.prat_points ?? 0,              // DELETE
```

### 2.4 Add Numeric Bounds Validation to Allowance Operations
**Source:** Database Review, API Review
**Risk:** HIGH
**Effort:** 1-2 hours

**File:** `src/app/api/kids/[id]/allowance/route.ts`

```typescript
const MAX_AMOUNT = 999999.99;
const MIN_AMOUNT = 0.01;

if (typeof amount !== "number" || !Number.isFinite(amount)) {
  return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
}

if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
  return NextResponse.json({ error: "Amount must be between $0.01 and $999,999.99" }, { status: 400 });
}

// Check decimal precision
if (Math.round(amount * 100) / 100 !== amount) {
  return NextResponse.json({ error: "Amount must have at most 2 decimal places" }, { status: 400 });
}
```

### 2.5 Fix Open Redirect Vulnerability
**Source:** Frontend Review
**Risk:** HIGH
**Effort:** 30 minutes

**File:** `src/app/api/rate/route.ts`

```typescript
const recipeId = searchParams.get("recipe");

// Validate recipeId is a valid UUID before redirecting
if (!recipeId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recipeId)) {
  return NextResponse.json({ error: "Invalid recipe ID" }, { status: 400 });
}

return NextResponse.redirect(`${baseUrl}/recipes/${recipeId}?rated=${rating}`);
```

### 2.6 Reduce OAuth Scope Permissions
**Source:** Auth Review
**Risk:** HIGH
**Effort:** 30 minutes

**File:** `src/lib/auth.ts`

```typescript
// Change from full calendar access to events only:
scope: [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events", // Changed from .calendar
  "https://www.googleapis.com/auth/drive.file",
].join(" "),
```

### 2.7 Sanitize Database Error Messages
**Source:** Database Review, API Review
**Risk:** HIGH
**Effort:** 2 hours

Create `src/utils/errors.ts`:

```typescript
export function sanitizeDbError(error: unknown, fallback: string = "An error occurred"): string {
  console.error("Database error:", error); // Server-side logging only
  return fallback;
}
```

Replace all instances of `errorMessage = \`Database error: ${error.message}\`` with `sanitizeDbError(error)`.

---

## Phase 3: MEDIUM Priority (Deploy within 2-4 weeks)

### 3.1 Implement Rate Limiting
**Source:** API Review, Database Review, Infrastructure Review
**Risk:** MEDIUM
**Effort:** 4-6 hours

**Create:** `src/lib/rate-limit.ts` and apply to:
- `/api/kids/[id]/allowance` - 10 req/hour per user
- `/api/kids/[id]/allowance/withdraw` - 10 req/hour per user
- `/api/recipes/create-from-url` - 5 req/min per user
- `/api/household` (invitation validation) - 3 req/15min per IP
- All authentication endpoints - 5 req/min per IP

### 3.2 Add CSRF Protection
**Source:** API Review, Frontend Review
**Risk:** MEDIUM
**Effort:** 3-4 hours

Add CSRF token validation in middleware for POST, PUT, PATCH, DELETE requests:

```typescript
// In middleware.ts
if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
  const csrfToken = request.headers.get('x-csrf-token');
  // Validate against session token
}
```

### 3.3 Fix Race Conditions in Transactions
**Source:** API Review
**Risk:** MEDIUM-HIGH
**Effort:** 4-6 hours

Use database transactions with SELECT FOR UPDATE for allowance operations:

```sql
-- Or use stored procedure:
CREATE OR REPLACE FUNCTION withdraw_allowance(
  p_kid_id UUID,
  p_split_key TEXT,
  p_amount DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
  v_balance DECIMAL;
BEGIN
  SELECT balance INTO v_balance
  FROM allowance_splits
  WHERE kid_id = p_kid_id AND split_key = p_split_key
  FOR UPDATE;

  IF v_balance >= p_amount THEN
    UPDATE allowance_splits
    SET balance = balance - p_amount
    WHERE kid_id = p_kid_id AND split_key = p_split_key;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
```

### 3.4 Strengthen Invitation Codes
**Source:** Auth Review, Database Review
**Risk:** MEDIUM
**Effort:** 2-3 hours

- Increase code length from 6 to 12 characters
- Add rate limiting (3 attempts per 15 min per IP)
- Add expiration (7 days)
- Log all validation attempts

### 3.5 Add Input Validation Library
**Source:** API Review
**Risk:** MEDIUM
**Effort:** 4-6 hours

Install and implement Zod:

```bash
npm install zod
```

Create schemas for all API inputs with proper bounds, formats, and sanitization.

### 3.6 Add Structured Logging
**Source:** Infrastructure Review
**Risk:** MEDIUM
**Effort:** 3-4 hours

Create `src/lib/logger.ts` with:
- Log levels (debug, info, warn, error)
- PII redaction
- Production-only error logging
- Structured JSON output

Replace all `console.log` statements.

### 3.7 Add HTML Escaping to Email Templates
**Source:** Frontend Review
**Risk:** MEDIUM
**Effort:** 1-2 hours

Create escape function and apply to all user-generated content in emails:

```typescript
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
```

### 3.8 Validate JSONB Input Schemas
**Source:** Database Review
**Risk:** MEDIUM
**Effort:** 2-3 hours

Use Zod schemas for all JSONB fields (household settings, allowance splits, etc.).

### 3.9 Clear LocalStorage on Logout
**Source:** Frontend Review
**Risk:** MEDIUM
**Effort:** 1 hour

Add cleanup in auth flow:

```typescript
// On logout
localStorage.removeItem(WIZARD_STORAGE_KEY);
```

### 3.10 Improve Cron Endpoint Security
**Source:** Infrastructure Review
**Risk:** MEDIUM
**Effort:** 2 hours

- Use constant-time comparison
- Add IP allowlisting for Vercel cron IPs
- Add request logging

---

## Phase 4: LOW Priority (Deploy within 2-3 months)

### 4.1 Environment Variable Validation
Add startup validation for all required environment variables with minimum length requirements for secrets.

### 4.2 Add Audit Logging
Create `audit_log` table and log:
- Authentication events
- Authorization failures
- Allowance transactions
- Data deletions
- Settings changes

### 4.3 Add Route Protection Middleware
Implement centralized session validation for protected pages.

### 4.4 Update Outdated Dependencies
Regularly update googleapis, date-fns, and other non-security dependencies.

### 4.5 Implement Security Monitoring
- Set up error tracking (Sentry)
- Monitor API abuse patterns
- Alert on authentication failures

---

## Architecture Decision: RLS Bypass

**Issue:** All API routes use `getServiceSupabase()` with service role key, completely bypassing Row Level Security policies.

**Current Risk:** A single missing `.eq("household_id", ...)` clause could expose cross-household data.

**Options:**

1. **Option A: Continue with Application-Level Authorization** (Recommended short-term)
   - Pros: No architecture change, faster to implement fixes
   - Cons: Must audit every query, no defense-in-depth
   - Action: Add automated tests for household isolation

2. **Option B: Migrate to RLS-Enforced Pattern** (Recommended long-term)
   - Pros: Defense-in-depth, database-level security
   - Cons: Requires NextAuth-to-Supabase auth integration, significant refactor
   - Action: Plan migration for v2.0

**Immediate Action:** Audit all 45 API route files to verify every query includes household_id filtering.

---

## Testing Requirements

### Security Test Suite

Add these tests before deploying fixes:

```typescript
describe('Security Tests', () => {
  describe('Authorization', () => {
    test('User cannot access other household recipes');
    test('User cannot access other household kids');
    test('User cannot modify other household data');
  });

  describe('Input Validation', () => {
    test('Invalid UUIDs return 400');
    test('Large allowance amounts rejected');
    test('Invalid email formats rejected');
  });

  describe('Rate Limiting', () => {
    test('Excessive requests return 429');
    test('Allowance transactions rate limited');
  });

  describe('CSRF', () => {
    test('State-changing requests require CSRF token');
  });
});
```

### Manual Testing Checklist

- [ ] Security headers present in all responses
- [ ] OAuth flow works with new cookie settings
- [ ] Rate limiting doesn't block legitimate users
- [ ] CSP doesn't break application features
- [ ] All Google API calls work without client access token

---

## Compliance Checklist

### OWASP Top 10 2021 Coverage

| Category | Status | Findings |
|----------|--------|----------|
| A01: Broken Access Control | ⚠️ | RLS bypass, IDOR edge cases |
| A02: Cryptographic Failures | ⚠️ | Token exposure, weak HMAC |
| A03: Injection | ✅ | ORM prevents SQL injection |
| A04: Insecure Design | ⚠️ | Missing CSP, open redirect |
| A05: Security Misconfiguration | ⚠️ | Missing headers, weak defaults |
| A06: Vulnerable Components | ❌ | Critical Next.js vulnerabilities |
| A07: Auth Failures | ⚠️ | No rate limiting, weak codes |
| A08: Data Integrity Failures | ⚠️ | Race conditions in transactions |
| A09: Logging Failures | ⚠️ | PII in logs, no audit trail |
| A10: SSRF | ✅ | Excellent SSRF protection |

### GDPR Considerations

- [ ] Implement data export endpoint
- [ ] Implement account deletion flow
- [ ] Add privacy policy
- [ ] Review data retention periods
- [ ] Remove PII from logs

---

## Summary Timeline

| Phase | Timeframe | Risk Reduction | Effort |
|-------|-----------|----------------|--------|
| Phase 1 | 48 hours | 40% | 8-10 hours |
| Phase 2 | 1 week | 35% | 10-14 hours |
| Phase 3 | 2-4 weeks | 20% | 20-30 hours |
| Phase 4 | 2-3 months | 5% | 10-15 hours |
| **Total** | **~6 weeks** | **100%** | **48-69 hours** |

---

## Individual Review Files

For detailed findings, see:
- `security-review-auth.md` - Authentication & Authorization
- `security-review-database.md` - Database & Data Security
- `security-review-api.md` - API Security
- `security-review-frontend.md` - Frontend & Client-Side Security
- `security-review-infrastructure.md` - Infrastructure & Configuration

---

**Next Steps:**
1. Create GitHub issues for each Phase 1 item with "security-critical" label
2. Assign ownership and begin immediate fixes
3. Schedule security sprint for Phase 2 items
4. Establish recurring security review process (quarterly)
