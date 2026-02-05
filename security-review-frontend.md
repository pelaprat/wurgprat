# Frontend & Client-Side Security Review
## Wurgprat Application

**Review Date:** 2026-02-05
**Reviewed By:** Claude (Security Analysis)
**Scope:** Next.js 14 App Router frontend, client-side components, API routes

---

## Executive Summary

This security review identified **1 critical**, **3 high**, **4 medium**, and **2 low** severity vulnerabilities in the Wurgprat application's frontend and client-side implementation. The most serious issue is the exposure of OAuth access tokens to the client, which could allow attackers to access users' Google Calendar and Drive data. Additionally, the application lacks essential security headers including Content Security Policy (CSP), making it vulnerable to various injection attacks.

**Overall Security Posture:** ⚠️ **Needs Immediate Attention**

The application demonstrates good practices in several areas (no XSS vulnerabilities in rendering, SSRF protection, HMAC token validation), but critical issues with token handling and missing security headers require immediate remediation.

---

## Detailed Findings

### 1. CRITICAL: OAuth Access Token Exposed to Client

**Risk Level:** 🔴 **CRITICAL**
**File:** `/src/lib/auth.ts` (Line 141)
**CWE:** CWE-522 (Insufficiently Protected Credentials)

#### Description
The NextAuth session callback includes the Google OAuth `accessToken` in the session object that is sent to the client:

```typescript
async session({ session, token }) {
  // Send properties to the client
  session.accessToken = token.accessToken as string;  // ⚠️ EXPOSED TO CLIENT
  if (token.error) {
    session.error = token.error as string;
  }
  return session;
}
```

#### Impact
- **Severity:** CRITICAL
- Attackers with XSS access or malicious browser extensions can steal OAuth access tokens
- Stolen tokens grant full access to users' Google Calendar and Drive with the following scopes:
  - `https://www.googleapis.com/auth/calendar`
  - `https://www.googleapis.com/auth/drive.file`
- Tokens can be used until expiry (typically 1 hour) to read/modify calendar events and Drive files
- Enables lateral movement attacks against users' Google accounts

#### Proof of Concept
An attacker could execute:
```javascript
// In browser console or via XSS
const session = await fetch('/api/auth/session').then(r => r.json());
console.log(session.accessToken); // Exposed!
// Use token to access Google APIs directly
```

#### Remediation
1. **NEVER expose access tokens to the client**
2. Create server-side API routes that use the token on behalf of the user:
   ```typescript
   // Remove from session callback:
   async session({ session, token }) {
     // DO NOT include: session.accessToken = token.accessToken;
     return session;
   }
   ```
3. For Google API calls, access tokens should only be retrieved server-side:
   ```typescript
   // In API routes only:
   const session = await getServerSession(authOptions);
   const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
   const accessToken = token.accessToken; // Never send to client
   ```

---

### 2. HIGH: Missing Content Security Policy (CSP)

**Risk Level:** 🟠 **HIGH**
**File:** `/next.config.mjs`, no middleware found
**CWE:** CWE-1021 (Improper Restriction of Rendered UI Layers)

#### Description
The application has no Content Security Policy headers configured. This leaves it vulnerable to:
- Cross-Site Scripting (XSS) attacks
- Data injection attacks
- Clickjacking
- Malicious third-party script injection

#### Current Configuration
```javascript
// next.config.mjs
const nextConfig = {};  // No security headers configured
export default nextConfig;
```

#### Impact
- **Severity:** HIGH
- Without CSP, a single XSS vulnerability can lead to complete account takeover
- Attackers can inject arbitrary JavaScript to steal credentials, tokens, or user data
- No defense-in-depth against script injection

#### Remediation
Add security headers to `next.config.mjs`:

```javascript
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Adjust based on Next.js requirements
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co https://oauth2.googleapis.com https://www.googleapis.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'"
            ].join('; ')
          },
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
          }
        ]
      }
    ];
  }
};
```

**Note:** Start with a permissive CSP and gradually tighten it. Use CSP report-only mode initially to identify issues.

---

### 3. HIGH: Sensitive User Data in URL Parameters

**Risk Level:** 🟠 **HIGH**
**File:** `/src/app/api/cron/rating-reminders/route.ts` (Lines 129, 110)
**CWE:** CWE-598 (Use of GET Request Method With Sensitive Query Strings)

#### Description
The rating reminder email system includes sensitive user and recipe IDs in URL query parameters:

```typescript
const ratingUrls: string[] = [];
for (let r = 1; r <= 5; r++) {
  const token = generateRatingToken(recipe.id, user.id, r);
  ratingUrls.push(
    `${baseUrl}/api/rate?recipe=${recipe.id}&user=${user.id}&rating=${r}&token=${token}`
    // ⚠️ User ID exposed in URL
  );
}
```

#### Impact
- **Severity:** HIGH
- User IDs and recipe IDs logged in:
  - Email provider logs
  - Browser history
  - Proxy/CDN logs
  - Referrer headers when users navigate away
- Enables user enumeration attacks
- Recipe IDs can be correlated to specific households
- URLs shared via screenshots expose internal IDs

#### Remediation
1. Use opaque, single-use tokens instead of exposing IDs:
```typescript
// Generate a one-time rating token that encodes user+recipe
const opaqueToken = generateOpaqueRatingToken(recipe.id, user.id, r);
ratingUrls.push(`${baseUrl}/api/rate/${opaqueToken}`);
```

2. Store token mappings server-side with expiry:
```typescript
// In database or cache
{
  token: 'abc123xyz',
  recipe_id: recipe.id,
  user_id: user.id,
  rating: r,
  expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  used: false
}
```

3. Rate endpoint should use path parameter instead:
```typescript
// /src/app/api/rate/[token]/route.ts
export async function GET(request: NextRequest, { params }: { params: { token: string } })
```

---

### 4. HIGH: Open Redirect Vulnerability

**Risk Level:** 🟠 **HIGH**
**File:** `/src/app/api/rate/route.ts` (Line 54)
**CWE:** CWE-601 (URL Redirection to Untrusted Site)

#### Description
The `/api/rate` endpoint redirects users to a recipe page using user-controlled input without validation:

```typescript
// Redirect to the recipe page
const baseUrl = process.env.NEXTAUTH_URL || "https://wurgprat.com";
return NextResponse.redirect(`${baseUrl}/recipes/${recipeId}?rated=${rating}`);
// ⚠️ recipeId is user-controlled and could contain path traversal
```

#### Impact
- **Severity:** HIGH
- Attackers can craft malicious URLs to redirect users to attacker-controlled sites
- Phishing attacks using legitimate wurgprat.com domain
- Potential for XSS via path traversal: `/api/rate?recipe=../../evil&...`

#### Proof of Concept
```
https://wurgprat.com/api/rate?recipe=../../@attacker.com/phishing&user=123&rating=5&token=valid
```

#### Remediation
1. Validate the `recipeId` is a valid UUID before redirecting:
```typescript
const recipeId = searchParams.get("recipe");
// Validate it's a valid UUID
if (!recipeId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recipeId)) {
  return NextResponse.json({ error: "Invalid recipe ID" }, { status: 400 });
}
```

2. Alternatively, whitelist redirect targets or use a safe redirect function:
```typescript
function safeRedirect(baseUrl: string, path: string): string {
  const url = new URL(path, baseUrl);
  if (url.origin !== new URL(baseUrl).origin) {
    throw new Error('Invalid redirect target');
  }
  return url.toString();
}
```

---

### 5. MEDIUM: No CSRF Protection on State-Changing API Routes

**Risk Level:** 🟡 **MEDIUM**
**Affected Files:** All API routes in `/src/app/api/`
**CWE:** CWE-352 (Cross-Site Request Forgery)

#### Description
API routes perform authentication checks but lack CSRF token validation for state-changing operations (POST, PUT, PATCH, DELETE). While NextAuth provides some CSRF protection for auth routes, application API routes are not protected.

Example vulnerable endpoint:
```typescript
// /src/app/api/kids/[id]/route.ts - No CSRF token check
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ⚠️ No CSRF token validation - vulnerable to CSRF attacks
  // ... delete kid ...
}
```

#### Impact
- **Severity:** MEDIUM (mitigated by SameSite cookies in modern browsers)
- Attackers can perform actions on behalf of authenticated users
- Vulnerable actions:
  - Delete kids, recipes, ingredients, stores
  - Modify allowance balances
  - Create/update meal plans
  - Change household settings

#### Proof of Concept
Attacker hosts malicious page:
```html
<form action="https://wurgprat.com/api/kids/abc-123" method="POST" id="evil">
  <input type="hidden" name="_method" value="DELETE">
</form>
<script>document.getElementById('evil').submit();</script>
```

#### Remediation
1. **Recommended:** Use Next.js built-in CSRF protection or add a CSRF middleware:
```typescript
// middleware.ts
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  // For state-changing requests, validate CSRF token
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const csrfToken = request.headers.get('x-csrf-token');
    const token = await getToken({ req: request });

    if (!csrfToken || csrfToken !== token?.csrfToken) {
      return new Response('Invalid CSRF token', { status: 403 });
    }
  }
}
```

2. **Alternative:** Use `SameSite=Strict` cookie attribute (already partially mitigated by modern browsers defaulting to `Lax`)

3. **Defense in depth:** Require re-authentication for sensitive operations (delete, large balance changes)

---

### 6. MEDIUM: Sensitive Data in LocalStorage

**Risk Level:** 🟡 **MEDIUM**
**File:** `/src/contexts/MealPlanWizardContext.tsx` (Lines 168-206)
**CWE:** CWE-922 (Insecure Storage of Sensitive Information)

#### Description
The meal plan wizard stores potentially sensitive household data in browser localStorage:

```typescript
localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify({
  weekOf: state.weekOf,
  userDescription: state.userDescription,
  selectedRecipeIds: state.selectedRecipeIds,
  proposedMeals: state.proposedMeals,
  stapleItems: state.stapleItems,
  groceryItems: state.groceryItems,
  eventAssignments: state.eventAssignments,
  timestamp: Date.now()
}));
```

#### Impact
- **Severity:** MEDIUM
- LocalStorage is accessible to all JavaScript on the domain (including third-party scripts)
- Data persists across sessions and is not encrypted
- Shared computers expose meal planning data to other users
- XSS vulnerabilities can extract this data
- Malicious browser extensions can access localStorage

#### Sensitive Data Exposed
- Recipe selections (dietary preferences, food allergies may be inferred)
- Event assignments (reveals household routines and schedules)
- Grocery items (shopping patterns, household size)
- User descriptions (free-text input may contain PII)

#### Remediation
1. **Short-term:** Add warning for shared computers and clear on logout:
```typescript
// Clear wizard data on unmount/logout
useEffect(() => {
  return () => {
    if (!session) {
      localStorage.removeItem(WIZARD_STORAGE_KEY);
    }
  };
}, [session]);
```

2. **Long-term:** Move wizard state to server-side session storage:
```typescript
// Store incomplete wizard state in database with expiry
const { data, error } = await supabase
  .from('wizard_sessions')
  .upsert({
    user_id: session.user.id,
    state: state,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });
```

3. **Alternative:** Use encrypted localStorage with per-session keys (complex, not recommended)

---

### 7. MEDIUM: Invitation Code Exposure

**Risk Level:** 🟡 **MEDIUM**
**File:** `/src/app/api/household/route.ts` (Line 214)
**CWE:** CWE-200 (Exposure of Sensitive Information)

#### Description
The household GET endpoint returns the invitation code to any authenticated household member:

```typescript
return NextResponse.json({
  household: {
    id: household.id,
    name: household.name,
    invitation_code: household.settings?.invitation_code,  // ⚠️ Exposed
    member_count: members?.length || 0,
    members: members || [],
  },
});
```

#### Impact
- **Severity:** MEDIUM
- Any household member can access the invitation code at any time
- If a member's account is compromised, attacker gains the invitation code
- No audit trail of who accessed the invitation code
- Cannot easily revoke access for specific members

#### Remediation
1. Add role-based access control for invitation codes:
```typescript
// Only allow household admins to view invitation code
const { data: user } = await supabase
  .from('users')
  .select('id, household_id, role')
  .eq('email', session.user.email)
  .single();

if (user.role !== 'admin') {
  return NextResponse.json({
    household: {
      id: household.id,
      name: household.name,
      // Don't include invitation_code for non-admins
      member_count: members?.length || 0,
    }
  });
}
```

2. Create a separate endpoint for retrieving invitation codes with audit logging:
```typescript
// POST /api/household/reveal-invitation-code
export async function POST() {
  // Log the access
  await supabase.from('audit_log').insert({
    user_id: user.id,
    action: 'reveal_invitation_code',
    timestamp: new Date()
  });

  return NextResponse.json({ invitation_code: household.settings?.invitation_code });
}
```

3. Implement time-limited invitation codes that expire after 7 days

---

### 8. MEDIUM: HTML Injection in Email Templates

**Risk Level:** 🟡 **MEDIUM**
**File:** `/src/app/api/cron/rating-reminders/route.ts` (Lines 194, 196)
**CWE:** CWE-79 (Improper Neutralization of Input During Web Page Generation)

#### Description
Recipe names are directly interpolated into HTML email templates without escaping:

```typescript
function buildEmailHtml(firstName: string, recipeName: string, ratingUrls: string[]): string {
  return `
    <h1 style="...">Hey ${firstName}!</h1>
    <p style="...">
      Tonight you had <strong>${recipeName}</strong>. How was it?
      <!-- ⚠️ recipeName not HTML-escaped -->
    </p>
  `;
}
```

#### Impact
- **Severity:** MEDIUM
- Attackers with recipe creation privileges can inject HTML/JavaScript into emails
- Email clients may render malicious content
- Potential for phishing attacks that appear to come from Wurgprat
- Social engineering attacks targeting household members

#### Proof of Concept
Create recipe with name:
```
<script>alert('XSS')</script>Chicken Soup
```
Or:
```
Pasta<img src=x onerror=alert('XSS')>
```

#### Remediation
1. HTML-escape all user-generated content in emails:
```typescript
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function buildEmailHtml(firstName: string, recipeName: string, ratingUrls: string[]): string {
  return `
    <h1 style="...">Hey ${escapeHtml(firstName)}!</h1>
    <p style="...">
      Tonight you had <strong>${escapeHtml(recipeName)}</strong>. How was it?
    </p>
  `;
}
```

2. Use a templating library with auto-escaping (e.g., react-email, handlebars)

3. Implement input validation on recipe names to restrict special characters:
```typescript
// In recipe creation API
if (!/^[a-zA-Z0-9\s\-'&,.()]+$/.test(recipeName)) {
  return NextResponse.json({ error: "Recipe name contains invalid characters" }, { status: 400 });
}
```

---

### 9. LOW: No Rate Limiting on API Endpoints

**Risk Level:** 🟢 **LOW**
**Affected Files:** All API routes in `/src/app/api/`
**CWE:** CWE-770 (Allocation of Resources Without Limits)

#### Description
API endpoints lack rate limiting, making them vulnerable to:
- Brute force attacks (e.g., trying invitation codes)
- Resource exhaustion
- Denial of Service (DoS)
- Credential stuffing

#### Impact
- **Severity:** LOW (requires authentication for most endpoints)
- Attackers can make unlimited requests to authenticated endpoints
- Potential for API abuse and increased hosting costs
- `/api/rate` endpoint could be spammed via email URLs

#### Remediation
Implement rate limiting using middleware or edge functions:

```typescript
// middleware.ts or using Vercel Edge Config
import rateLimit from '@/lib/rate-limit';

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

export async function middleware(request: NextRequest) {
  const ip = request.ip ?? '127.0.0.1';

  try {
    await limiter.check(10, ip); // 10 requests per minute per IP
  } catch {
    return new Response('Too Many Requests', { status: 429 });
  }
}
```

Or use Vercel's built-in rate limiting:
```typescript
// vercel.json
{
  "functions": {
    "src/app/api/**": {
      "maxDuration": 10,
      "memory": 1024
    }
  },
  "firewall": {
    "rules": [
      {
        "action": "deny",
        "rateLimit": {
          "algo": "sliding_window",
          "window": "1m",
          "requests": 100
        }
      }
    ]
  }
}
```

---

### 10. LOW: Missing Security Headers

**Risk Level:** 🟢 **LOW**
**File:** `next.config.mjs`
**CWE:** CWE-693 (Protection Mechanism Failure)

#### Description
Beyond CSP (covered in Finding #2), the application is missing several defense-in-depth security headers:
- `X-Frame-Options` - No clickjacking protection
- `X-Content-Type-Options` - No MIME-sniffing protection
- `Referrer-Policy` - Referrer information may leak sensitive data
- `Permissions-Policy` - Unnecessary browser features enabled

#### Impact
- **Severity:** LOW (defense-in-depth)
- Clickjacking attacks possible (e.g., invisible iframe overlays)
- MIME-sniffing could enable XSS in certain scenarios
- Referrer headers may leak sensitive URLs with IDs

#### Remediation
See remediation in Finding #2 - add all security headers together in `next.config.mjs`

---

## Positive Security Findings

The following security best practices were observed:

### ✅ XSS Prevention
- **No `dangerouslySetInnerHTML` usage** throughout the application
- **No `.innerHTML` or `.outerHTML` manipulation** in client code
- React's automatic escaping protects against most XSS vectors
- User-generated content (recipes, descriptions, notes) properly escaped in JSX

### ✅ Code Injection Prevention
- **No `eval()` usage** found
- **No `Function()` constructor usage**
- No dynamic code execution vulnerabilities

### ✅ Server-Side Request Forgery (SSRF) Protection
- Robust URL validation in `/src/utils/url.ts`
- Blocks private IP ranges (10.x, 172.16.x, 192.168.x, 127.x, localhost)
- Blocks cloud metadata endpoints (169.254.169.254)
- Validates protocols (only HTTP/HTTPS allowed)
- Blocks URLs with embedded credentials

```typescript
// Example of good SSRF protection:
const validation = validateExternalUrl(url);
if (!validation.valid) {
  throw new Error(validation.error || "Invalid URL");
}
```

### ✅ HMAC Token Validation
- Rating links use HMAC tokens to prevent tampering
- Uses crypto-grade secret for token generation
- Token includes recipe ID, user ID, and rating to prevent reuse attacks

### ✅ Server-Side Authentication
- All API routes properly check for authenticated session
- Uses `getServerSession(authOptions)` consistently
- Database queries filtered by `household_id` for multi-tenancy

### ✅ Environment Variable Separation
- `NEXT_PUBLIC_*` prefix only for truly public values (Supabase URL, anon key)
- Secrets (service role keys, API keys, OAuth secrets) kept server-side only
- No hardcoded credentials found

### ✅ Type Safety
- TypeScript used throughout for type safety
- Proper input validation on API routes
- Supabase types generated for database schema

---

## Remediation Priority

### Immediate (Fix within 1 week)
1. **CRITICAL:** Remove `accessToken` from session callback (#1)
2. **HIGH:** Implement Content Security Policy (#2)
3. **HIGH:** Fix open redirect in `/api/rate` (#4)

### Short-term (Fix within 1 month)
4. **HIGH:** Refactor rating URLs to use opaque tokens (#3)
5. **MEDIUM:** Add CSRF protection to API routes (#5)
6. **MEDIUM:** Clear wizard localStorage on logout (#6)

### Long-term (Fix within 3 months)
7. **MEDIUM:** Implement role-based access for invitation codes (#7)
8. **MEDIUM:** Add HTML escaping to email templates (#8)
9. **LOW:** Implement rate limiting (#9)
10. **LOW:** Add remaining security headers (#10)

---

## Testing Recommendations

### Manual Testing Checklist
- [ ] Verify access token is NOT present in `/api/auth/session` response
- [ ] Test CSP headers don't break functionality (check browser console)
- [ ] Attempt CSRF attacks on DELETE endpoints
- [ ] Test open redirect with malicious `recipeId` values
- [ ] Verify localStorage is cleared on logout
- [ ] Test email rendering with HTML-injected recipe names

### Automated Testing
1. **Security Headers Test:**
```bash
curl -I https://wurgprat.com | grep -i "content-security-policy\|x-frame-options\|x-content-type"
```

2. **Session Token Exposure Test:**
```bash
curl -X GET https://wurgprat.com/api/auth/session -H "Cookie: next-auth.session-token=..." | grep "accessToken"
```

3. **SSRF Protection Test:**
```bash
curl -X POST https://wurgprat.com/api/recipes/create-from-url \
  -H "Content-Type: application/json" \
  -d '{"url":"http://169.254.169.254/latest/meta-data"}' # Should fail
```

### Penetration Testing
Engage a professional penetration tester to validate these findings and discover additional vulnerabilities before public launch.

---

## Compliance Considerations

### GDPR (General Data Protection Regulation)
- **Issue:** User IDs in email URLs create unnecessary tracking (#3)
- **Issue:** localStorage persists meal planning data indefinitely (#6)
- **Recommendation:** Implement data minimization and retention policies

### OWASP Top 10 2021 Mapping
- **A01:2021 - Broken Access Control:** Findings #5, #7
- **A02:2021 - Cryptographic Failures:** Finding #1
- **A03:2021 - Injection:** Finding #8
- **A04:2021 - Insecure Design:** Findings #2, #3
- **A05:2021 - Security Misconfiguration:** Findings #2, #10
- **A07:2021 - Identification and Authentication Failures:** Finding #1

---

## Additional Recommendations

### 1. Security Monitoring & Logging
Implement security event logging for:
- Failed authentication attempts
- API rate limit violations
- CSRF token validation failures
- Unusual access patterns to invitation codes

### 2. Dependency Security
```bash
# Run regularly
npm audit
npm audit fix

# Consider using
npm install -g snyk
snyk test
```

### 3. Secure Development Practices
- Implement pre-commit hooks to scan for secrets (`git-secrets`, `trufflehog`)
- Use GitHub Dependabot for dependency vulnerability alerts
- Regular security training for development team
- Security code review checklist for PRs

### 4. Incident Response Plan
Prepare for security incidents:
- Document process for revoking compromised invitation codes
- Process for rotating OAuth client secrets
- User notification templates for data breaches
- Contact information for security researcher disclosures

---

## Conclusion

The Wurgprat application has a solid security foundation with good XSS prevention, SSRF protection, and authentication practices. However, the critical exposure of OAuth access tokens to the client and lack of Content Security Policy headers require immediate attention before the application handles sensitive user data at scale.

After implementing the immediate and short-term remediations, the application's security posture will be significantly improved. The development team should prioritize security throughout the development lifecycle and consider a professional security audit before major releases.

**Next Steps:**
1. Create GitHub issues for each finding with priority labels
2. Assign ownership and deadlines for immediate fixes
3. Schedule security review sprint for short-term fixes
4. Establish recurring security review process (quarterly)

---

**Report prepared by:** Claude (AI Security Analyst)
**Review methodology:** Static code analysis, manual code review, OWASP guidelines
**Codebase commit:** Latest (2026-02-05)
