/**
 * URL validation utilities to prevent SSRF attacks
 */

/**
 * List of private/internal IP ranges that should be blocked
 */
const BLOCKED_IP_PATTERNS = [
  /^127\./,                    // Localhost
  /^10\./,                     // Private Class A
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private Class B
  /^192\.168\./,               // Private Class C
  /^169\.254\./,               // Link-local
  /^0\./,                      // Current network
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Carrier-grade NAT
  /^198\.1[89]\./,             // Benchmarking
  /^::1$/,                     // IPv6 localhost
  /^fc00:/i,                   // IPv6 private
  /^fe80:/i,                   // IPv6 link-local
];

const BLOCKED_HOSTNAMES = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "metadata.google.internal",  // GCP metadata
  "169.254.169.254",           // Cloud metadata endpoint
];

/**
 * Check if a hostname or IP is internal/private
 */
function isInternalHost(hostname: string): boolean {
  const lowerHostname = hostname.toLowerCase();

  // Check blocked hostnames
  if (BLOCKED_HOSTNAMES.includes(lowerHostname)) {
    return true;
  }

  // Check IP patterns
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return true;
    }
  }

  // Check for localhost variations
  if (lowerHostname.endsWith(".localhost") || lowerHostname.endsWith(".local")) {
    return true;
  }

  return false;
}

/**
 * Validate a URL for safe external fetching (SSRF protection)
 * Returns an object with validation result and any errors
 */
export function validateExternalUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    // Only allow http and https protocols
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, error: "Only HTTP and HTTPS URLs are allowed" };
    }

    // Check for internal hosts
    if (isInternalHost(parsed.hostname)) {
      return { valid: false, error: "URLs pointing to internal/private addresses are not allowed" };
    }

    // Block URLs with authentication credentials
    if (parsed.username || parsed.password) {
      return { valid: false, error: "URLs with authentication credentials are not allowed" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

/**
 * Validate that a URL is a valid Google Sheets URL
 */
export function validateGoogleSheetsUrl(url: string): { valid: boolean; error?: string; spreadsheetId?: string } {
  const validation = validateExternalUrl(url);
  if (!validation.valid) {
    return validation;
  }

  try {
    const parsed = new URL(url);

    // Must be from Google domains
    const validHosts = ["docs.google.com", "sheets.google.com"];
    if (!validHosts.includes(parsed.hostname)) {
      return { valid: false, error: "URL must be a Google Sheets URL" };
    }

    // Extract spreadsheet ID from various URL formats
    // Format 1: /spreadsheets/d/{spreadsheetId}/...
    const match = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      return { valid: false, error: "Could not extract spreadsheet ID from URL" };
    }

    return { valid: true, spreadsheetId: match[1] };
  } catch {
    return { valid: false, error: "Invalid Google Sheets URL format" };
  }
}

/**
 * Validate that a URL is a valid ICS calendar URL
 */
export function validateIcsUrl(url: string): { valid: boolean; error?: string } {
  const validation = validateExternalUrl(url);
  if (!validation.valid) {
    return validation;
  }

  // Must use HTTPS for calendar URLs
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return { valid: false, error: "Calendar URLs must use HTTPS" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid calendar URL format" };
  }
}

/**
 * Create a fetch wrapper with timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
