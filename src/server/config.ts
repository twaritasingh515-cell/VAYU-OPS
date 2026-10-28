/**
 * Server-Side Environment Configuration Module for VAYU-OPS
 *
 * CRITICAL SECURITY ARCHITECTURE:
 * - This module MUST only be loaded in server-side runtimes (Node.js, Express, Vite dev middleware, Cloud Run).
 * - NEVER import this file into React components, UI hooks, or any client-side bundle.
 * - Reads OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET exclusively from server environment variables.
 * - Client secrets are never logged, serialized, or returned over network APIs.
 * - Automatically falls back to 'anonymous' mode if credentials are omitted or empty.
 */

export type OpenSkyAuthMode = 'oauth' | 'anonymous';

export interface OpenSkyCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface OpenSkySafeSummary {
  readonly isConfigured: boolean;
  readonly authMode: OpenSkyAuthMode;
  readonly hasClientId: boolean;
  readonly hasClientSecret: boolean;
  readonly maskedClientId: string | null;
}

export interface OpenSkyConfig {
  readonly isConfigured: boolean;
  readonly authMode: OpenSkyAuthMode;
  readonly clientId: string | null;
  readonly clientSecret: string | null;
  /**
   * Safe summary without secrets, suitable for diagnostics, logs, or status indicators.
   */
  toSafeSummary(): OpenSkySafeSummary;
  /**
   * Secure getter for OAuth2 credentials; returns null if not properly configured.
   */
  getCredentials(): OpenSkyCredentials | null;
  /**
   * Custom JSON serialization to prevent secret exposure if serialized.
   */
  toJSON(): Record<string, unknown>;
  /**
   * Safe string representation.
   */
  toString(): string;
}

/**
 * Safely accesses server environment variables without assuming a specific runtime.
 * Works seamlessly in Node.js, Express, tsx, Vite server middlewares, and containerized runtimes.
 */
function readServerEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process && process.env) {
    return process.env[key];
  }
  return undefined;
}

/**
 * Masks a non-secret identifier (like a client ID) for safe diagnostic visibility.
 * Never used on client secrets.
 */
function maskIdentifier(val: string | null | undefined): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (trimmed.length <= 4) return '***';
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
}

/**
 * Validates whether an environment string is non-empty and not a placeholder.
 */
function isValidCredential(val: string | undefined): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed.length === 0) return false;
  // Guard against common placeholder defaults
  const lower = trimmed.toLowerCase();
  if (
    lower.includes('your_') ||
    lower.includes('my_') ||
    lower.includes('placeholder') ||
    lower.includes('example') ||
    lower.includes('opensky_') ||
    lower === 'undefined' ||
    lower === 'null' ||
    lower === 'test' ||
    lower === 'fake' ||
    lower === 'changeme'
  ) {
    return false;
  }
  return true;
}

/**
 * Internal memoized configuration instance
 */
let cachedConfig: OpenSkyConfig | null = null;
let hasLoggedInitStatus = false;

/**
 * Retrieves the typed OpenSky server configuration.
 *
 * If OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET are valid and non-empty,
 * mode is set to 'oauth'.
 * If either variable is missing, empty, or a placeholder, mode gracefully
 * defaults to 'anonymous' without throwing errors.
 */
export function getOpenSkyConfig(): OpenSkyConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const rawClientId = readServerEnv('OPENSKY_CLIENT_ID');
  const rawClientSecret = readServerEnv('OPENSKY_CLIENT_SECRET');

  const hasValidClientId = isValidCredential(rawClientId);
  const hasValidClientSecret = isValidCredential(rawClientSecret);

  const isConfigured = hasValidClientId && hasValidClientSecret;
  const authMode: OpenSkyAuthMode = isConfigured ? 'oauth' : 'anonymous';

  const sanitizedClientId = hasValidClientId ? rawClientId!.trim() : null;
  const sanitizedClientSecret = hasValidClientSecret ? rawClientSecret!.trim() : null;

  // Safe object with custom serialization to ensure secrets are never leaked
  const configInstance: OpenSkyConfig = {
    isConfigured,
    authMode,
    clientId: sanitizedClientId,
    clientSecret: sanitizedClientSecret,

    toSafeSummary(): OpenSkySafeSummary {
      return {
        isConfigured,
        authMode,
        hasClientId: hasValidClientId,
        hasClientSecret: hasValidClientSecret,
        maskedClientId: maskIdentifier(sanitizedClientId),
      };
    },

    getCredentials(): OpenSkyCredentials | null {
      if (!isConfigured || !sanitizedClientId || !sanitizedClientSecret) {
        return null;
      }
      return {
        clientId: sanitizedClientId,
        clientSecret: sanitizedClientSecret,
      };
    },

    // Custom JSON serialization prevents accidental JSON.stringify leakage
    toJSON() {
      return {
        isConfigured,
        authMode,
        hasClientId: hasValidClientId,
        hasClientSecret: hasValidClientSecret,
        maskedClientId: maskIdentifier(sanitizedClientId),
        clientSecret: '[PROTECTED_SERVER_SECRET]',
      };
    },

    toString() {
      return `[OpenSkyConfig mode=${authMode} configured=${isConfigured} client=${maskIdentifier(sanitizedClientId) || 'none'}]`;
    },
  };

  // Safe initialization logging (strictly non-sensitive)
  if (!hasLoggedInitStatus) {
    hasLoggedInitStatus = true;
    if (isConfigured) {
      console.log(
        `[VAYU-OPS Server Config] OpenSky Network OAuth2 configured for client ID: ${maskIdentifier(sanitizedClientId)}. Mode: authenticated.`
      );
    } else {
      console.log(
        '[VAYU-OPS Server Config] OpenSky credentials not set or incomplete. Running in anonymous mode (resilient live queries with local cached replay).'
      );
    }
  }

  cachedConfig = configInstance;
  return configInstance;
}

/**
 * Resets configuration cache (useful for testing or runtime environment updates)
 */
export function resetOpenSkyConfigCache(): void {
  cachedConfig = null;
  hasLoggedInitStatus = false;
}
