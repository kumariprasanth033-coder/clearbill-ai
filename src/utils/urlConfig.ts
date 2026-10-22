/**
 * ClearBill AI - Public Application & Receipt URL Resolver
 * Resolves the machine-readable public URL for QR codes.
 *
 * Prevents Google 403 Forbidden errors when scanning on external mobile phones:
 * 1. Honors explicit VITE_PUBLIC_APP_URL from environment / deployment.
 * 2. In Google AI Studio preview environments, automatically converts restricted
 *    'ais-dev-*.run.app' (which requires developer Google login) to public
 *    'ais-pre-*.run.app' (the shared public app URL).
 * 3. Supports local storage override for LAN testing (e.g. http://192.168.1.X:3000).
 */

export function getPublicAppBaseUrl(): string {
  // 1. Check user-configured override in localStorage (helpful for LAN / Wi-Fi IP testing)
  if (typeof window !== 'undefined') {
    const customOverride = localStorage.getItem('cb_public_app_url');
    if (customOverride && customOverride.trim().startsWith('http')) {
      return customOverride.trim().replace(/\/+$/, '');
    }
  }

  // 2. Check environment variable VITE_PUBLIC_APP_URL
  const envPublicUrl = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_PUBLIC_APP_URL : null;
  if (
    envPublicUrl &&
    typeof envPublicUrl === 'string' &&
    envPublicUrl.trim() &&
    !envPublicUrl.includes('YOUR-REAL-PUBLIC-DOMAIN')
  ) {
    return envPublicUrl.trim().replace(/\/+$/, '');
  }

  // 3. Browser origin check with Google AI Studio Dev-to-Pre translation
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;

    // CRITICAL BUG FIX FOR GOOGLE 403 FORBIDDEN:
    // In AI Studio, 'ais-dev-*.run.app' is restricted to the developer's Google Cloud session.
    // External mobile devices scanning this URL receive Google's 403 Forbidden error.
    // The public shared counterpart is 'ais-pre-*.run.app'.
    if (origin.includes('ais-dev-') && origin.includes('.run.app')) {
      return origin.replace('ais-dev-', 'ais-pre-');
    }

    return origin.replace(/\/+$/, '');
  }

  return 'http://localhost:3000';
}

export function buildPublicReceiptUrl(token: string): string {
  const base = getPublicAppBaseUrl();
  return `${base}/receipt/${encodeURIComponent(token)}`;
}

export function isLocalhostOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export function isAiStudioDevOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.origin.includes('ais-dev-') && window.location.origin.includes('.run.app');
}
