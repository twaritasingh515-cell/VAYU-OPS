export type AircraftRole = 'ISR' | 'Strike' | 'CAP' | 'Transport';
export type AircraftStatus = 'Serviceable' | 'Maintenance' | 'AOG'; // AOG = Aircraft on Ground (unserviceable)
export type MissionPriority = 'P1' | 'P2' | 'P3';
export type FeedFreshness = 'FRESH' | 'STALE' | 'MISSING';
export type UserRole = 'Commander' | 'Planner' | 'Analyst';
export type OperatingMode = 'MODE_1_PLANNING' | 'MODE_2_DYNAMIC_REPLAN' | 'MODE_3_DEGRADED';
export type PlannerType = 'CP_SAT_SOLVER' | 'HEURISTIC_FALLBACK';

export interface Aircraft {
  id: string; // e.g. A1, A2...
  callsign: string; // e.g. "Garuda-1", "Vajra-3"
  model: string; // e.g. "Su-30MKI", "Rafale-DH", "Tejas Mk1A", "Netra AEW&C"
  role: AircraftRole;
  status: AircraftStatus;
  baseId: string;
  fuelKg: number;
  maxFuelKg: number;
  enduranceHours: number;
  flightHoursToService: number;
  serviceabilityProb: number; // 0.0 - 1.0
  countermeasuresLevel: 'Basic' | 'Advanced' | 'EW-Suite';
}

export interface Crew {
  id: string; // C1, C2...
  name: string;
  rank: string; // e.g. "Wg Cdr", "Sqn Ldr", "Flt Lt"
  qualifications: AircraftRole[];
  fatigueScore: number; // 0 - 100
  dutyHoursToday: number;
  maxDutyHours: number;
  availabilityStart: string; // "06:00"
  availabilityEnd: string; // "20:00"
  status: 'Ready' | 'On-Rest' | 'Assigned';
}

export interface WeaponInventory {
  id: string;
  name: string;
  type: string; // "BVR-AAM", "Precision-SDB", "Standoff-Cruise", "Cargo-Pod", "Recon-Pod"
  baseId: string;
  quantityAvailable: number;
  minReliability: number;
}

export interface Airbase {
  id: string;
  code: string;
  name: string;
  coordinates: { x: number; y: number }; // Tactical map grid (0-1000, 0-600)
  hasMunitionsDepot: boolean;
  runwayStatus: 'Active' | 'Restricted';
}

export interface Mission {
  id: string; // M-101...
  codeName: string; // e.g. "Operation Trishul Guard"
  priority: MissionPriority;
  requiredRole: AircraftRole;
  timeWindowStart: string; // "08:00"
  timeWindowEnd: string; // "11:00"
  durationHours: number;
  targetLocation: {
    name: string;
    sector: string;
    coords: { x: number; y: number };
  };
  requiredWeaponType: string;
  requiredWeaponQty: number;
  threatLevel: 'Low' | 'Medium' | 'High' | 'Severe';
  status: 'Unassigned' | 'Planned' | 'Approved' | 'Executed';
}

export interface AirspaceZone {
  id: string;
  name: string;
  corridorStatus: 'Open' | 'Restricted' | 'Contested';
  polygonCoords: Array<{ x: number; y: number }>;
}

export interface ZoneWeather {
  zoneId: string;
  timestamp: number;
  visibilityKm: number;
  windKnots: number;
  cloudCoverPercent: number;
  severity: 'Clear' | 'Moderate' | 'Severe';
  ceilingFeet: number;
}

export interface ThreatMarker {
  id: string;
  type: 'SAM-Radar' | 'Hostile-CAP' | 'EW-Jamming' | 'Unknown-Contact';
  label: string;
  severity: 'Low' | 'Medium' | 'High' | 'Severe';
  coords: { x: number; y: number };
  rangeKm: number;
  firstDetected: string;
  status: 'Active' | 'Intermittent' | 'Suppressed';
}

export interface FeedStatus {
  name: 'Fleet' | 'Crew' | 'Armament' | 'Airspace' | 'Weather' | 'Threat';
  freshness: FeedFreshness;
  lastUpdated: number; // Unix timestamp
  latencyMs: number;
  itemCount: number;
}

export interface LiveOperationalState {
  timestamp: number;
  scenarioSeed: number;
  scenarioName: string;
  bases: Airbase[];
  aircraft: Aircraft[];
  crews: Crew[];
  weapons: WeaponInventory[];
  missions: Mission[];
  airspaceZones: AirspaceZone[];
  weather: ZoneWeather[];
  threats: ThreatMarker[];
  feeds: Record<string, FeedStatus>;
  stalenessAlerts: string[];
}

export interface MissionAssignment {
  missionId: string;
  aircraftId: string | null;
  crewId: string | null;
  weaponTypeId: string | null;
  weaponQuantity: number;
  predictedRisk: number; // 0-100
  serviceabilityScore: number; // 0-100
  weatherImpactScore: number; // 0-100
  crewFatigueScore: number; // 0-100
  compositeScore: number;
  constraintViolations: string[];
}

export interface GeneratedPlan {
  planId: string;
  name: string;
  description: string;
  plannerType: PlannerType;
  generatedAt: number;
  assignments: MissionAssignment[];
  metrics: {
    p1CoveragePercent: number;
    totalCoveragePercent: number;
    averageRiskScore: number;
    totalFuelConsumptionKg: number;
    planChangesVsPrior: number;
    objectiveScore: number;
    solveTimeMs: number;
  };
  explanation?: string;
  isAiGeneratedExplanation?: boolean;
}

export interface AuditLogEntry {
  index: number;
  timestamp: string;
  actorRole: UserRole;
  action: string;
  details: string;
  previousHash: string;
  hash: string;
}

export interface PredictiveBreakdown {
  aircraftServiceability: {
    aircraftId: string;
    probability: number;
    formula: string;
    factors: { hoursRemaining: number; baseTurnaround: number; baseStatus: string };
  };
  weatherImpact: {
    missionId: string;
    impactScore: number;
    factors: { visibilityKm: number; cloudCover: number; windKnots: number; roleSensitivity: string };
  };
  threatRisk: {
    missionId: string;
    riskScore: number;
    factors: { samProximityKm: number; jammingActive: boolean; threatLevel: string; aircraftDefenses: string };
  };
  crewFatigue: {
    crewId: string;
    fatigueScore: number;
    factors: { dutyHours: number; priorSorties: number; circadianPenalty: number };
  };
}

export type AlertScenarioType =
  | 'ROUTE_DEVIATION'
  | 'LOW_FUEL'
  | 'TELEMETRY_INTERRUPT'
  | 'SCHEDULE_CONFLICT'
  | 'AVAILABILITY_CHANGE';

export interface OperationalAlert {
  id: string;
  type: AlertScenarioType;
  title: string;
  aircraftId: string;
  missionId?: string;
  severity: 'CRITICAL' | 'WARNING' | 'ADVISORY';
  reason: string;
  timestamp: string;
  suggestedResponse: string;
  actionLabel?: string;
  actionPlanType?: 'BALANCED' | 'LOW_RISK' | 'SURGE';
}

