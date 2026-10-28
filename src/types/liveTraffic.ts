export type DataMode = 'SIMULATED' | 'LIVE' | 'HYBRID';

export type LiveFeedStatus = 'CONNECTED' | 'DELAYED' | 'RATE_LIMITED' | 'OFFLINE';

export type AltitudeBand = 'ALL' | 'LOW' | 'MID' | 'HIGH'; // Low: <15000ft, Mid: 15000-28000ft, High: >28000ft

export interface LiveAircraft {
  icao24: string;
  callsign: string;
  originCountry: string;
  latitude: number;
  longitude: number;
  altitudeM: number | null;
  altitudeFt: number;
  flightLevel: string; // e.g. "FL340"
  onGround: boolean;
  velocityMs: number | null;
  speedKnots: number;
  heading: number; // true track 0-360
  verticalRateMs: number | null;
  verticalRateFpm: number;
  geometricAltitudeM: number | null;
  squawk: string | null;
  lastContact: number; // epoch seconds
  isEmergency: boolean;
  emergencyType?: 'HIJACK' | 'RADIO_FAILURE' | 'GENERAL_EMERGENCY';
  source: 'OPENSKY_LIVE' | 'OPENSKY_CACHED' | 'MOCK_FEED';
  lastUpdatedMs: number;
  // Coordinates mapped into tactical bounding space
  x: number;
  y: number;
  // Short history for 2D/3D breadcrumb trails
  trail: Array<{ x: number; y: number; altitudeFt: number; timestamp: number }>;
}

export interface CivilConflict {
  id: string;
  civilIcao24: string;
  civilCallsign: string;
  militaryMissionId: string;
  militaryAircraftId: string;
  lateralDistanceNm: number;
  altitudeDiffFt: number;
  severity: 'CRITICAL' | 'WARNING' | 'ADVISORY';
  description: string;
  timestamp: string;
  civilX: number;
  civilY: number;
}

export interface LiveWeatherData {
  locationName: string;
  latitude: number;
  longitude: number;
  temperatureC: number;
  humidityPercent: number;
  windSpeedKts: number;
  windDirectionDeg: number;
  visibilityKm: number;
  cloudCoverPercent: number;
  weatherDescription: string;
  timestamp: string;
}

export interface LiveFeedMeta {
  provider: string;
  status: LiveFeedStatus;
  lastPollTimestamp: number;
  secondsSinceLastUpdate: number;
  pollIntervalSec: number;
  creditBudgetStatus: 'OPTIMAL' | 'MODERATE' | 'LOW' | 'EXHAUSTED';
  totalPollsToday: number;
  rateLimitRetryAfterSec?: number;
  isStale: boolean;
  sourceDescription: string;
}
