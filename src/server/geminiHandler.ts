import { GoogleGenAI } from '@google/genai';
import type { IncomingMessage, ServerResponse } from 'http';

// Circuit breaker to avoid spamming the Gemini API once daily free-tier quota is reached
let quotaExceededUntil = 0;

export { generateFallbackExplanation } from '../services/fallbackExplanation';
import { generateFallbackExplanation } from '../services/fallbackExplanation';
import { getOpenSkyConfig } from './config';

// In-memory cache for OpenSky OAuth2 token (server-side only)
let openSkyToken: { token: string; expiresAt: number } | null = null;
let tokenBackoffUntil = 0;
let hasLoggedAuthNotice = false;

async function getOpenSkyBearerToken(): Promise<string | null> {
  // If in backoff period due to previous connection/auth failure, smoothly return null
  // (Anonymous mode will be used without blocking requests or throwing unhandled errors)
  if (Date.now() < tokenBackoffUntil) {
    return null;
  }

  const config = getOpenSkyConfig();
  const credentials = config.getCredentials();

  // If credentials are not configured or invalid, operate gracefully in anonymous mode
  if (!credentials) {
    return null;
  }

  // Return cached token if valid for at least another 60 seconds
  if (openSkyToken && openSkyToken.expiresAt > Date.now() + 60000) {
    return openSkyToken.token;
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    });

    const resp = await fetch(
      'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: AbortSignal.timeout(3500),
      }
    );

    if (!resp.ok) {
      tokenBackoffUntil = Date.now() + 15 * 60 * 1000;
      if (!hasLoggedAuthNotice) {
        hasLoggedAuthNotice = true;
        console.log(`[VAYU-OPS Server] OpenSky auth response status: ${resp.status}. Operating in anonymous mode.`);
      }
      return null;
    }

    const data = (await resp.json()) as any;
    if (data?.access_token) {
      openSkyToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in || 1800) * 1000,
      };
      hasLoggedAuthNotice = false;
      return data.access_token;
    }
  } catch (_err) {
    // When external auth service is unreachable, back off for 15 minutes and fall back to anonymous mode
    tokenBackoffUntil = Date.now() + 15 * 60 * 1000;
    if (!hasLoggedAuthNotice) {
      hasLoggedAuthNotice = true;
      console.log('[VAYU-OPS Server] OpenSky OAuth auth server unreachable; operating in anonymous mode.');
    }
  }
  return null;
}

export function createGeminiMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    // 0. OpenSky Server-Side Configuration Status (strictly non-sensitive metadata)
    if (req.url?.startsWith('/api/opensky/status') && req.method === 'GET') {
      const config = getOpenSkyConfig();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify(config.toSafeSummary()));
      return;
    }
    // 1. OpenSky Network Proxy (solves browser CORS and manages OAuth authentication securely)
    if (req.url?.startsWith('/api/opensky/states') && req.method === 'GET') {
      try {
        const urlObj = new URL(req.url, 'http://localhost:3000');
        const lamin = urlObj.searchParams.get('lamin') || '24.0';
        const lomin = urlObj.searchParams.get('lomin') || '70.0';
        const lamax = urlObj.searchParams.get('lamax') || '31.0';
        const lomax = urlObj.searchParams.get('lomax') || '77.5';

        const openSkyUrl = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
        const headers: Record<string, string> = {
          'User-Agent': 'VAYU-OPS Decision Support Engine (Indian Air Operations)',
        };

        const token = await getOpenSkyBearerToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const openSkyRes = await fetch(openSkyUrl, {
          headers,
          signal: AbortSignal.timeout(4500),
        });
        if (!openSkyRes.ok) {
          res.statusCode = openSkyRes.status;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ error: 'OpenSky API request failed', status: openSkyRes.status }));
          return;
        }

        const json = await openSkyRes.json();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-OpenSky-Auth', token ? 'AUTHENTICATED' : 'ANONYMOUS');
        res.end(JSON.stringify(json));
      } catch (proxyErr: any) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ error: 'Proxy network exception' }));
      }
      return;
    }

    // 2. Open-Meteo Weather Proxy (current meteorological observation for target airspaces)
    if (req.url?.startsWith('/api/meteo/weather') && req.method === 'GET') {
      try {
        const urlObj = new URL(req.url, 'http://localhost:3000');
        const lat = urlObj.searchParams.get('lat') || '26.2891';
        const lon = urlObj.searchParams.get('lon') || '73.0234';

        const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,cloud_cover,visibility`;
        const meteoRes = await fetch(meteoUrl);
        if (!meteoRes.ok) {
          res.statusCode = meteoRes.status;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ error: 'Open-Meteo request failed' }));
          return;
        }

        const json = await meteoRes.json();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(json));
      } catch (meteoErr: any) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ error: 'Meteo proxy exception', message: meteoErr?.message }));
      }
      return;
    }

    if (req.url?.startsWith('/api/gemini/explain') && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const { planName, metrics, assignments, disruptionEvent } = parsed;

          // Check circuit breaker first
          if (Date.now() < quotaExceededUntil) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                explanation: generateFallbackExplanation(planName, metrics, disruptionEvent),
                source: 'FALLBACK_OFFLINE_RULES',
              })
            );
            return;
          }

          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                explanation: generateFallbackExplanation(planName, metrics, disruptionEvent),
                source: 'FALLBACK_OFFLINE_RULES',
              })
            );
            return;
          }

          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });

          const prompt = `
You are the AI Decision Support Advisor for the VAYU-OPS Air Tasking Command System (Indian Air Force synthetic scenario).
Explain the recommended Air Tasking plan to the Commander in 3-4 crisp, highly professional bullet points.
Guidelines:
1. State clearly why key assets (aircraft & crew) were chosen for primary P1 missions.
2. Note the operational trade-offs made (e.g. risk minimization vs endurance vs crew duty rest).
3. If a disruption event occurred (e.g., "${disruptionEvent || 'Routine planning'}"), highlight what changed from the previous plan and how disruption was mitigated.
4. Conclude with a clear reminder: "Recommendation submitted for Commander approval. Decision authority remains with the Human-in-the-Loop."

Plan Details:
- Plan Name: ${planName}
- P1 Coverage: ${metrics?.p1CoveragePercent}%
- Total Coverage: ${metrics?.totalCoveragePercent}%
- Average Risk Score: ${metrics?.averageRiskScore}/100
- Plan Changes: ${metrics?.planChangesVsPrior || 0}
- Disruption Event: ${disruptionEvent || 'None (baseline cycle)'}
- Key Assignments Summary: ${JSON.stringify(assignments?.slice(0, 4) || [])}
`;

          try {
            const response = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: prompt,
              config: {
                systemInstruction:
                  'You are the AI decision-support copilot for military air operations. Speak with precise, restrained, professional doctrine. You do not issue orders; you provide analytical recommendations to human commanders.',
                temperature: 0.25,
              },
            });

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                explanation: response.text || generateFallbackExplanation(planName, metrics, disruptionEvent),
                source: 'GEMINI_API',
              })
            );
          } catch (modelErr: any) {
            const errMsg = String(modelErr?.message || modelErr || '');
            const isQuotaExceeded =
              errMsg.includes('429') ||
              errMsg.includes('quota') ||
              errMsg.includes('RESOURCE_EXHAUSTED') ||
              modelErr?.status === 'RESOURCE_EXHAUSTED';

            if (isQuotaExceeded) {
              // Trip circuit breaker for 30 minutes to preserve free-tier limits without repeated fails
              quotaExceededUntil = Date.now() + 30 * 60 * 1000;
              console.warn('[VAYU-OPS] Gemini free-tier daily quota limit reached; activating high-assurance offline rule-based advisor.');
            } else {
              console.warn('[VAYU-OPS] Gemini model call deferred; using tactical rule-based fallback:', errMsg.slice(0, 80));
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                explanation: generateFallbackExplanation(planName, metrics, disruptionEvent),
                source: 'FALLBACK_ON_ERROR',
              })
            );
          }
        } catch (bodyErr: any) {
          console.warn('[VAYU-OPS] Request body parse issue; serving fallback explanation');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              explanation: generateFallbackExplanation('Air Tasking Plan', {}, 'Operational update'),
              source: 'FALLBACK_ON_ERROR',
            })
          );
        }
      });
      return;
    }

    next();
  };
}

