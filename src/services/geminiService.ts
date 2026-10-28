import { GeneratedPlan } from '../types/ops';
import { generateFallbackExplanation } from './fallbackExplanation';

export interface PlanExplanationResponse {
  explanation: string;
  source: 'GEMINI_API' | 'FALLBACK_OFFLINE_RULES' | 'FALLBACK_ON_ERROR';
  error?: string;
}

const explanationCache = new Map<string, PlanExplanationResponse>();

export async function fetchPlanExplanation(
  plan: GeneratedPlan,
  disruptionEvent?: string
): Promise<PlanExplanationResponse> {
  const cacheKey = `${plan.name}_${disruptionEvent || 'none'}`;
  if (explanationCache.has(cacheKey)) {
    return explanationCache.get(cacheKey)!;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch('/api/gemini/explain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        planName: plan.name,
        metrics: plan.metrics,
        assignments: plan.assignments,
        disruptionEvent,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const result: PlanExplanationResponse = {
      explanation: data.explanation || generateFallbackExplanation(plan.name, plan.metrics, disruptionEvent),
      source: data.source || 'GEMINI_API',
      error: data.error,
    };
    explanationCache.set(cacheKey, result);
    return result;
  } catch (err: any) {
    const fallbackResult: PlanExplanationResponse = {
      explanation: generateFallbackExplanation(plan.name, plan.metrics, disruptionEvent),
      source: 'FALLBACK_ON_ERROR',
      error: err?.message,
    };
    explanationCache.set(cacheKey, fallbackResult);
    return fallbackResult;
  }
}
