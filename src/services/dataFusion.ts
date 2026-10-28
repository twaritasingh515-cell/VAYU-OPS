import { FeedFreshness, FeedStatus, LiveOperationalState } from '../types/ops';

export const FRESHNESS_THRESHOLDS = {
  STALE_MS: 120_000, // > 2 minutes is Stale
  MISSING_MS: 600_000, // > 10 minutes is Missing / Disconnected
};

export interface FusionValidationResult {
  state: LiveOperationalState;
  hasStaleFeeds: boolean;
  hasMissingFeeds: boolean;
  stalenessAlerts: string[];
  systemHealthScore: number; // 0 - 100
}

/**
 * Validates feed timestamps and updates freshness indicators.
 * Flags STALE or MISSING feeds, raising operational alerts.
 */
export function validateAndFuseState(state: LiveOperationalState, currentTimeMs: number = Date.now()): FusionValidationResult {
  const updatedFeeds: Record<string, FeedStatus> = {};
  const alerts: string[] = [];
  let healthyFeedCount = 0;
  const feedKeys = Object.keys(state.feeds);

  feedKeys.forEach((key) => {
    const feed = state.feeds[key];
    const ageMs = currentTimeMs - feed.lastUpdated;

    let freshness: FeedFreshness = 'FRESH';
    if (feed.freshness === 'MISSING' || ageMs >= FRESHNESS_THRESHOLDS.MISSING_MS) {
      freshness = 'MISSING';
      alerts.push(`FEED DISCONNECTED: ${feed.name} telemetry feed lost (>10m silence). Fallback protocols initiated.`);
    } else if (feed.freshness === 'STALE' || ageMs >= FRESHNESS_THRESHOLDS.STALE_MS) {
      freshness = 'STALE';
      alerts.push(`FEED STALE: ${feed.name} feed latency degraded (${Math.round(ageMs / 1000)}s old). Integrity flagged.`);
    } else {
      freshness = 'FRESH';
      healthyFeedCount++;
    }

    updatedFeeds[key] = {
      ...feed,
      freshness,
    };
  });

  const systemHealthScore = Math.round((healthyFeedCount / (feedKeys.length || 1)) * 100);

  const newState: LiveOperationalState = {
    ...state,
    timestamp: currentTimeMs,
    feeds: updatedFeeds,
    stalenessAlerts: alerts,
  };

  return {
    state: newState,
    hasStaleFeeds: alerts.some((a) => a.includes('STALE')),
    hasMissingFeeds: alerts.some((a) => a.includes('DISCONNECTED')),
    stalenessAlerts: alerts,
    systemHealthScore,
  };
}

/**
 * Injects degradation into specific feeds (for Mode 3 testing)
 */
export function setFeedDegradedState(
  state: LiveOperationalState,
  feedName: FeedStatus['name'],
  targetFreshness: FeedFreshness
): LiveOperationalState {
  const now = Date.now();
  let updatedTimestamp = now;

  if (targetFreshness === 'STALE') {
    updatedTimestamp = now - 180_000; // 3 minutes ago
  } else if (targetFreshness === 'MISSING') {
    updatedTimestamp = now - 900_000; // 15 minutes ago
  }

  const updatedFeeds = {
    ...state.feeds,
    [feedName]: {
      ...state.feeds[feedName],
      freshness: targetFreshness,
      lastUpdated: updatedTimestamp,
    },
  };

  return {
    ...state,
    feeds: updatedFeeds,
  };
}
