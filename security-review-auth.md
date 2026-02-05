# Security Review: Authentication & Authorization

**Review Date:** 2026-02-05
**Reviewer:** Security Analysis
**Application:** Wurgprat (Next.js 14 Household Manager)
**Scope:** NextAuth.js implementation, session handling, access control, token security, OAuth configuration

---

## Executive Summary

This review assessed the authentication and authorization mechanisms of a Next.js 14 application using NextAuth.js with Google OAuth, Supabase PostgreSQL with Row Level Security (RLS), and multi-tenant household data scoping.

### Overall Security Posture: **MEDIUM-HIGH RISK**

**Key Strengths:**
- Consistent session validation across all API routes
- Proper OAuth implementation with token refresh logic
- Good separation of concerns with service role key for server operations
- HMAC-based token validation for email links prevents tampering
- Well-structured household scoping in application logic

**Critical Concerns:**
- **RLS policies are completely bypassed** - All API routes use service role key which circumvents database-level security
- Access tokens exposed to client-side code via session object
- Missing NextAuth security configurations (session strategy, JWT maxAge, secure cookie settings)
- No rate limiting on authentication endpoints or API routes
- Lack of defense-in-depth: relies solely on application-layer authorization

---

## Detailed Findings

### CRITICAL RISK

#### 1. Row Level Security Bypass (Critical)
**Location:** `/home/user/wurgprat/src/lib/supabase.ts` (lines 10-18)
All API routes throughout `/home/user/wurgprat/src/app/api/`

**Issue:**
All API routes use `getServiceSupabase()` which creates a Supabase client with the service role key. This **completely bypasses** the Row Level Security (RLS) policies defined in the database schema.

```typescript
// src/lib/supabase.ts
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

Every API route follows this pattern:
```typescript
const supabase = getServiceSupabase(); // Bypasses RLS!
const { data: user } = await supabase
  .from("users")
  .select("household_id")
  .eq("email", session.user.email)
  .single();
```

**Impact:**
- RLS policies are never enforced since the service role key has superuser privileges
- A single authorization bug in application code could expose data across households
- No defense-in-depth: database security layer is unused
- If an attacker finds an injection vulnerability or logic flaw, they could access all household data

**Evidence:**
- `supabase-schema.sql` (lines 286-394): RLS policies defined for all tables
- `src/app/api/kids/[id]/route.ts`, `src/app/api/recipes/[id]/route.ts`, etc.: All use service role key
- 45 API route files use `getServiceSupabase()`

**Risk Rating:** **CRITICAL**

**Recommendation:**
Implement one of two approaches:

**Option A: Use RLS with authenticated Supabase client**
```typescript
// Create a user-scoped Supabase client
export const getUserSupabase = (userEmail: string) => {
  // Use anon key and set user context for RLS
  const client = createClient(supabaseUrl, supabaseAnonKey);
  // Set user context via RLS helper
  client.rpc('set_user_context', { user_email: userEmail });
  return client;
};
```

**Option B: Keep service role but add explicit RLS checks**
```typescript
// Add RLS-like checks in application layer
// Create a helper that enforces household scoping
export const getScopedSupabase = async (session: Session) => {
  const supabase = getServiceSupabase();

  // Get and verify household
  const { data: user } = await supabase
    .from("users")
    .select("household_id")
    .eq("email", session.user.email)
    .single();

  if (!user?.household_id) {
    throw new Error("Unauthorized");
  }

  // Return wrapped client that auto-adds household_id filters
  return createHouseholdScopedClient(supabase, user.household_id);
};
```

---

#### 2. Access Tokens Exposed to Client (High)
**Location:** `/home/user/wurgprat/src/lib/auth.ts` (lines 139-145)

**Issue:**
Google OAuth access tokens are included in the NextAuth session object and sent to the client:

```typescript
async session({ session, token }) {
  // Send properties to the client
  session.accessToken = token.accessToken as string; // ⚠️ Exposed to client!
  if (token.error) {
    session.error = token.error as string;
  }
  // ...
  return session;
}
```

**Impact:**
- Access tokens visible in browser DevTools, session storage, and client-side JavaScript
- Increased attack surface: XSS vulnerabilities could exfiltrate tokens
- Tokens could be used to access user's Google Calendar and Drive outside the application
- Violates principle of least privilege (client shouldn't have server credentials)

**Evidence:**
- `src/types/index.ts` (lines 4-6): Session interface includes `accessToken`
- `src/app/api/events/[id]/route.ts` (line 289): Uses `session.accessToken` from client

**Risk Rating:** **HIGH**

**Recommendation:**
1. **Immediate:** Remove access tokens from client session
2. Store tokens server-side only (database or encrypted session storage)
3. Create server-side proxy endpoints for Google API calls:

```typescript
// Remove from session callback
async session({ session, token }) {
  // Don't expose access token
  // session.accessToken = token.accessToken; // ❌ Remove this
  if (token.error) {
    session.error = token.error as string;
  }
  return session;
}

// Store tokens in database
async jwt({ token, account }) {
  if (account) {
    // Save to database instead of JWT
    await saveUserTokens(token.sub, {
      accessToken: account.access_token,
      refreshToken: account.refresh_token,
      expiresAt: account.expires_at
    });
  }
  return token;
}
```

---

### HIGH RISK

#### 3. Missing NextAuth Security Configuration (High)
**Location:** `/home/user/wurgprat/src/lib/auth.ts` (lines 55-164)

**Issue:**
NextAuth configuration is missing critical security settings:

```typescript
export const authOptions: NextAuthOptions = {
  providers: [/* ... */],
  callbacks: {/* ... */},
  pages: {
    signIn: "/auth/signin",
  },
  // ❌ Missing: session strategy
  // ❌ Missing: JWT configuration
  // ❌ Missing: cookie configuration
  // ❌ Missing: secret verification
};
```

**Missing Configurations:**

1. **No explicit session strategy:** Defaults to JWT, but should be explicit
2. **No JWT maxAge:** Tokens never expire
3. **No cookie security settings:** Missing httpOnly, sameSite, secure flags
4. **No secret validation:** Should verify NEXTAUTH_SECRET is set and strong
5. **No session maxAge:** Sessions could last indefinitely

**Impact:**
- Sessions may not expire properly
- JWTs could be valid longer than intended
- Cookies vulnerable to XSS/CSRF without proper flags
- Session fixation attacks possible

**Evidence:**
- No session maxAge in auth options
- No JWT configuration present
- Default NextAuth settings used

**Risk Rating:** **HIGH**

**Recommendation:**
Add comprehensive security configuration:

```typescript
export const authOptions: NextAuthOptions = {
  // Explicit strategy
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },

  // JWT configuration
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Cookie security
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

  // Verify secret is set
  secret: process.env.NEXTAUTH_SECRET,

  providers: [/* ... */],
  callbacks: {/* ... */},
  pages: {/* ... */}
};

// Add runtime check
if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) {
  throw new Error("NEXTAUTH_SECRET must be set and at least 32 characters");
}
```

---

#### 4. OAuth Scope Over-Permissioning (High)
**Location:** `/home/user/wurgprat/src/lib/auth.ts` (lines 62-68)

**Issue:**
Application requests broad Google API scopes:

```typescript
scope: [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",        // Full calendar access
  "https://www.googleapis.com/auth/drive.file",     // Drive file access
].join(" "),
```

**Impact:**
- `calendar` scope grants access to **all** calendar data (read, write, delete)
- `drive.file` scope allows creating and accessing Drive files
- If tokens are compromised, attacker has full access to user's calendar and files
- Violates principle of least privilege

**Evidence:**
- Code only uses calendar events for meal planning
- No evidence of needing full calendar manipulation
- Drive only used for grocery list export

**Risk Rating:** **HIGH**

**Recommendation:**
Use more restrictive scopes:

```typescript
scope: [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",    // Events only
  "https://www.googleapis.com/auth/drive.file",         // Keep (minimal for file creation)
].join(" "),
```

Or implement scope-specific consent:
- Request calendar scope only when user enables calendar integration
- Use incremental authorization to request scopes as needed

---

#### 5. Weak Secret Fallback in HMAC Token Generation (High)
**Location:** `/home/user/wurgprat/src/utils/rating-token.ts` (lines 12-16)

**Issue:**
HMAC token generation falls back to empty string if secrets not configured:

```typescript
export function generateRatingToken(
  recipeId: string,
  userId: string,
  rating: number
): string {
  const secret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET || ""; // ⚠️ Empty fallback!
  return createHmac("sha256", secret)
    .update(`${recipeId}:${userId}:${rating}`)
    .digest("hex")
    .slice(0, 16);
}
```

**Impact:**
- If both secrets are undefined, HMAC uses empty string as key
- Tokens become trivially forgeable: `HMAC("", data)` is predictable
- Attacker could submit ratings for any user/recipe combination
- No warning or error when secrets are missing

**Evidence:**
- Used in `/home/user/wurgprat/src/app/api/cron/rating-reminders/route.ts` (line 127)
- Validated in `/home/user/wurgprat/src/app/api/rate/route.ts` (line 28)

**Risk Rating:** **HIGH**

**Recommendation:**
Fail securely when secrets are missing:

```typescript
export function generateRatingToken(
  recipeId: string,
  userId: string,
  rating: number
): string {
  const secret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("CRON_SECRET or NEXTAUTH_SECRET must be configured with at least 32 characters");
  }

  return createHmac("sha256", secret)
    .update(`${recipeId}:${userId}:${rating}`)
    .digest("hex")
    .slice(0, 16);
}
```

---

### MEDIUM RISK

#### 6. No Rate Limiting on Authentication or API Endpoints (Medium)
**Location:** All API routes in `/home/user/wurgprat/src/app/api/`

**Issue:**
No rate limiting implemented on:
- Authentication endpoints (`/api/auth/*`)
- API routes (recipe creation, allowance transactions, etc.)
- Cron endpoint (only bearer token check)

**Impact:**
- Brute force attacks on authentication possible
- API abuse and resource exhaustion
- DoS attacks via repeated expensive operations
- Credential stuffing attacks

**Risk Rating:** **MEDIUM**

**Recommendation:**
Implement rate limiting using middleware or edge functions:

```typescript
// middleware.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});

export async function middleware(request: NextRequest) {
  const ip = request.ip ?? "127.0.0.1";
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
```

---

#### 7. Invitation Code Weakness (Medium)
**Location:** `/home/user/wurgprat/src/app/api/household/route.ts` (lines 11-14, 98-99)

**Issue:**
Invitation codes are only 6 characters and use case-insensitive comparison:

```typescript
function generateInvitationCode(): string {
  return crypto.randomBytes(4).toString("base64url").slice(0, 6).toUpperCase();
}

// Validation
if (invitation_code.toUpperCase() !== storedCode.toUpperCase()) {
  return NextResponse.json({ error: "Invalid invitation code" }, { status: 403 });
}
```

**Impact:**
- Only ~36^6 = 2.2 billion possible codes (alphanumeric, case-insensitive)
- No rate limiting allows brute force attacks
- No lockout mechanism after failed attempts
- Attacker could join arbitrary household with enough attempts

**Risk Rating:** **MEDIUM**

**Recommendation:**
1. Increase code length to 12 characters minimum
2. Add rate limiting on invitation code validation
3. Implement lockout after N failed attempts
4. Add invitation code expiration
5. Log all invitation attempts for monitoring

```typescript
function generateInvitationCode(): string {
  // 12 characters = 62^12 ≈ 3.2 × 10^21 possibilities
  return crypto.randomBytes(9).toString("base64url").slice(0, 12).toUpperCase();
}

// Add to household settings
interface HouseholdSettings {
  invitation_code: string;
  invitation_code_expires_at?: string;
  invitation_attempts?: number;
  invitation_locked_until?: string;
}
```

---

#### 8. Insufficient Session Validation in Server Components (Medium)
**Location:** Client-facing pages (inferred from API patterns)

**Issue:**
No evidence of session validation middleware for Next.js routes/pages. Authorization only happens at API layer.

**Impact:**
- Users could potentially access pages without valid sessions
- Client-side code may attempt API calls that fail
- Poor user experience and potential information leakage
- No centralized session check for protected routes

**Risk Rating:** **MEDIUM**

**Recommendation:**
Implement Next.js middleware for session validation:

```typescript
// middleware.ts
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });

  // Protect all routes except public ones
  const isPublicRoute = ['/auth/', '/api/auth/', '/'].some(route =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (!isPublicRoute && !token) {
    return NextResponse.redirect(new URL('/auth/signin', request.url));
  }

  // Check household requirement
  if (token && !token.hasHousehold) {
    const needsOnboarding = !request.nextUrl.pathname.startsWith('/onboarding');
    if (needsOnboarding) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

### LOW RISK

#### 9. Google API Token Refresh Logic Could Fail Silently (Low)
**Location:** `/home/user/wurgprat/src/lib/auth.ts` (lines 44-52)

**Issue:**
Token refresh errors are caught but return expired tokens:

```typescript
} catch (error) {
  console.error("Error refreshing access token:", error);
  return {
    accessToken: token.accessToken ?? "",      // Returns expired token
    accessTokenExpires: token.accessTokenExpires ?? 0,
    refreshToken: token.refreshToken ?? "",
    error: "RefreshAccessTokenError",
  };
}
```

**Impact:**
- API calls to Google may fail with expired tokens
- User sees cryptic errors instead of re-authentication prompt
- Session continues to exist but is non-functional

**Risk Rating:** **LOW**

**Recommendation:**
Force re-authentication on refresh failure:

```typescript
} catch (error) {
  console.error("Error refreshing access token:", error);
  // Force sign out on refresh failure
  return {
    accessToken: "",
    accessTokenExpires: 0,
    refreshToken: "",
    error: "RefreshAccessTokenError",
    forceSignOut: true, // Add this flag
  };
}

// In session callback
async session({ session, token }) {
  if (token.forceSignOut) {
    // Trigger sign out flow
    return { ...session, error: "TokenRefreshError" };
  }
  // ...
}
```

---

#### 10. No Security Headers Configuration (Low)
**Location:** Application-wide (Next.js configuration)

**Issue:**
No evidence of security headers configuration in Next.js config.

**Impact:**
- Missing Content-Security-Policy
- No X-Frame-Options (clickjacking protection)
- No X-Content-Type-Options
- No Referrer-Policy

**Risk Rating:** **LOW**

**Recommendation:**
Add security headers in `next.config.js`:

```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
          }
        ]
      }
    ];
  }
};
```

---

#### 11. Environment Variable Validation Missing (Low)
**Location:** Application startup

**Issue:**
No validation that required environment variables are set before runtime.

**Impact:**
- Application could start with missing credentials
- Errors only appear when features are used
- Difficult to debug in production

**Risk Rating:** **LOW**

**Recommendation:**
Add startup validation:

```typescript
// src/lib/env-validation.ts
const requiredEnvVars = [
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRET'
] as const;

export function validateEnvironment() {
  const missing = requiredEnvVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please check your .env.local file.`
    );
  }

  // Validate secret lengths
  if (process.env.NEXTAUTH_SECRET!.length < 32) {
    throw new Error('NEXTAUTH_SECRET must be at least 32 characters');
  }

  if (process.env.CRON_SECRET!.length < 32) {
    throw new Error('CRON_SECRET must be at least 32 characters');
  }
}

// Call in app startup (layout.tsx or instrumentation.ts)
validateEnvironment();
```

---

## Positive Security Practices Observed

1. **Consistent Authorization Pattern:** All API routes check session and household membership
2. **Good OAuth Flow:** Proper token refresh implementation with 5-minute buffer
3. **HMAC Token Validation:** Rating links use cryptographic verification
4. **Cron Endpoint Protection:** Bearer token required for scheduled jobs
5. **SQL Injection Prevention:** Using Supabase ORM prevents direct SQL injection
6. **Email Verification:** Using Google OAuth means emails are verified
7. **Household Scoping:** Consistent pattern of filtering data by household_id
8. **Service Role Isolation:** Service key used only on server, never exposed to client

---

## Remediation Priority

### Immediate (Next Sprint)
1. ✅ **Fix RLS Bypass** - Implement proper RLS usage or add RLS-equivalent checks
2. ✅ **Remove Access Tokens from Client** - Store server-side only
3. ✅ **Fix HMAC Secret Fallback** - Fail securely when secrets missing
4. ✅ **Add NextAuth Security Config** - Session/JWT settings, cookie security

### Short Term (Within 1 Month)
5. ✅ **Reduce OAuth Scopes** - Use minimal required permissions
6. ✅ **Implement Rate Limiting** - Protect all API endpoints
7. ✅ **Strengthen Invitation Codes** - Longer codes, rate limiting, expiration
8. ✅ **Add Route Protection Middleware** - Centralized session checks

### Medium Term (Within 3 Months)
9. ✅ **Add Security Headers** - CSP, X-Frame-Options, etc.
10. ✅ **Environment Validation** - Startup checks for required vars
11. ✅ **Audit Logging** - Log authentication events, authorization failures
12. ✅ **Security Monitoring** - Alert on suspicious patterns

---

## Testing Recommendations

### Immediate Testing Needed

1. **Authorization Boundary Testing**
   - Attempt to access another household's data by manipulating IDs
   - Test if RLS policies would catch application logic bugs
   - Verify household_id filtering in every query

2. **Token Security Testing**
   - Verify access tokens not visible in browser
   - Test token refresh flow under various conditions
   - Confirm expired tokens cause re-authentication

3. **Session Management Testing**
   - Test session expiration
   - Verify logout clears all tokens
   - Test concurrent sessions from different devices

4. **HMAC Token Testing**
   - Verify rating links fail with tampered tokens
   - Test token generation with missing secrets
   - Confirm tokens can't be reused across users/recipes

---

## Compliance Considerations

### GDPR / Privacy
- ✅ OAuth only collects necessary user data (email, name, picture)
- ⚠️ Access tokens stored in JWT could be considered over-collection
- ⚠️ No data retention policy documented
- ⚠️ No user data export/deletion mechanism visible

### OWASP Top 10 Coverage
- ✅ **A01:2021 - Broken Access Control:** Mitigated by consistent household checks (but see RLS bypass)
- ⚠️ **A02:2021 - Cryptographic Failures:** Access tokens exposed, missing session security
- ✅ **A03:2021 - Injection:** Using ORM prevents SQL injection
- ⚠️ **A05:2021 - Security Misconfiguration:** Missing security headers, default NextAuth config
- ⚠️ **A07:2021 - Identification and Authentication Failures:** No rate limiting, weak invitation codes

---

## Conclusion

The application demonstrates a solid foundation in authentication with NextAuth.js and consistent authorization patterns across API routes. However, the **critical architectural issue of bypassing Row Level Security** creates significant risk. Combined with access tokens exposed to the client and missing NextAuth security configurations, the overall security posture requires immediate attention.

**Priority Actions:**
1. Address the RLS bypass issue immediately
2. Remove access tokens from client sessions
3. Add comprehensive NextAuth security configuration
4. Implement rate limiting across the application

With these remediations in place, the application would achieve a **HIGH** security posture appropriate for production use handling sensitive household and financial data.

---

**Report Generated:** 2026-02-05
**Next Review Recommended:** After remediation of critical findings (30 days)
