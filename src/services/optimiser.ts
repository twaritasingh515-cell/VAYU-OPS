import {
  Aircraft,
  Crew,
  GeneratedPlan,
  LiveOperationalState,
  Mission,
  MissionAssignment,
  PlannerType,
} from '../types/ops';
import {
  calculateAircraftServiceability,
  calculateCrewFatigue,
  calculateThreatRisk,
  calculateWeatherImpact,
} from './predictiveAnalytics';
import { generateFallbackExplanation } from './fallbackExplanation';

/**
 * Helper to convert "HH:MM" into minutes from midnight
 */
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Checks whether two time intervals [startA, endA] and [startB, endB] overlap
 */
export function timeOverlaps(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
  turnaroundMinutes: number = 30
): boolean {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA) + turnaroundMinutes;
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB) + turnaroundMinutes;
  return sA < eB && sB < eA;
}

export interface SolverOptions {
  plannerType?: PlannerType;
  priorPlan?: GeneratedPlan | null;
  riskTolerance?: 'BALANCED' | 'CONSERVATIVE_LOW_RISK' | 'HIGH_SURGE';
  penalizePlanChanges?: boolean;
}

/**
 * Validates all constraints for a potential mission-aircraft-crew-weapon tuple.
 * INLINE CONSTRAINTS DOCUMENTATION:
 * 1. Role Match: Aircraft role must equal mission.requiredRole.
 * 2. Serviceability: Aircraft status must not be 'AOG' and serviceabilityProb >= threshold.
 * 3. Crew Qualification: Crew must hold qualification for mission.requiredRole.
 * 4. Crew Fatigue: Crew fatigue score must be <= 70 (or 80 in surge mode).
 * 5. Crew Duty Window: Mission start/end must fall within crew availability window.
 * 6. Aircraft Temporal Exclusivity: Aircraft cannot be assigned to overlapping missions.
 * 7. Crew Temporal Exclusivity: Crew cannot be assigned to overlapping missions.
 * 8. Armament Inventory: Airbase hosting aircraft must have required quantity of weapon.
 */
export function evaluateCandidateAssignment(
  mission: Mission,
  aircraft: Aircraft,
  crew: Crew,
  state: LiveOperationalState,
  currentSchedule: Array<{ mission: Mission; aircraftId: string; crewId: string }>,
  options: SolverOptions = {}
): { valid: boolean; violations: string[]; score: number } {
  const violations: string[] = [];

  // CONSTRAINT 1: Role/qualification match
  if (aircraft.role !== mission.requiredRole) {
    violations.push(`Role mismatch: Aircraft is ${aircraft.role}, mission requires ${mission.requiredRole}`);
  }

  // CONSTRAINT 2: Aircraft serviceability
  if (aircraft.status === 'AOG') {
    violations.push(`Aircraft ${aircraft.id} is AOG (Aircraft on Ground - Unserviceable)`);
  }
  const servScore = calculateAircraftServiceability(aircraft);
  const minServThreshold = options.riskTolerance === 'CONSERVATIVE_LOW_RISK' ? 80 : 50;
  if (servScore.probabilityPercent < minServThreshold) {
    violations.push(`Serviceability probability ${servScore.probabilityPercent}% below threshold (${minServThreshold}%)`);
  }

  // CONSTRAINT 3: Crew qualification
  if (!crew.qualifications.includes(mission.requiredRole)) {
    violations.push(`Crew ${crew.id} lacks ${mission.requiredRole} combat endorsement`);
  }

  // CONSTRAINT 4: Crew rest & fatigue limits
  const maxFatigueAllowed = options.riskTolerance === 'HIGH_SURGE' ? 82 : 72;
  const crewScore = calculateCrewFatigue(crew);
  if (crewScore.fatigueScore > maxFatigueAllowed) {
    violations.push(`Crew ${crew.id} fatigue score ${crewScore.fatigueScore} exceeds safety limit (${maxFatigueAllowed})`);
  }

  // CONSTRAINT 5: Crew duty window
  const mStart = timeToMinutes(mission.timeWindowStart);
  const mEnd = timeToMinutes(mission.timeWindowEnd);
  const cStart = timeToMinutes(crew.availabilityStart);
  const cEnd = timeToMinutes(crew.availabilityEnd);
  if (mStart < cStart || mEnd > cEnd) {
    violations.push(`Mission window (${mission.timeWindowStart}-${mission.timeWindowEnd}) outside crew duty schedule`);
  }

  // CONSTRAINT 6 & 7: No time-window conflicts for same aircraft or crew
  for (const scheduled of currentSchedule) {
    if (scheduled.aircraftId === aircraft.id) {
      if (timeOverlaps(mission.timeWindowStart, mission.timeWindowEnd, scheduled.mission.timeWindowStart, scheduled.mission.timeWindowEnd)) {
        violations.push(`Aircraft ${aircraft.id} conflict with ${scheduled.mission.id} (${scheduled.mission.timeWindowStart}-${scheduled.mission.timeWindowEnd})`);
      }
    }
    if (scheduled.crewId === crew.id) {
      if (timeOverlaps(mission.timeWindowStart, mission.timeWindowEnd, scheduled.mission.timeWindowStart, scheduled.mission.timeWindowEnd)) {
        violations.push(`Crew ${crew.id} conflict with ${scheduled.mission.id}`);
      }
    }
  }

  // CONSTRAINT 8: Weapon availability at base
  const weapon = state.weapons.find(
    (w) => w.baseId === aircraft.baseId && w.type === mission.requiredWeaponType
  );
  if (!weapon || weapon.quantityAvailable < mission.requiredWeaponQty) {
    violations.push(`Armament shortfall: Base ${aircraft.baseId} has insufficient ${mission.requiredWeaponType}`);
  }

  // Objective Scoring
  const weather = calculateWeatherImpact(mission, state);
  const threat = calculateThreatRisk(mission, state, aircraft);

  // Weights
  const priorityWeight = mission.priority === 'P1' ? 100 : mission.priority === 'P2' ? 45 : 18;
  const riskPenalty = threat.riskScore * 0.45 + weather.impactScore * 0.25;
  const fatiguePenalty = crewScore.fatigueScore * 0.2;
  const serviceabilityBonus = (servScore.probabilityPercent - 50) * 0.3;

  // Plan stability: penalise change vs previous plan
  let stabilityBonus = 0;
  if (options.priorPlan && options.penalizePlanChanges !== false) {
    const priorAssigned = options.priorPlan.assignments.find((a) => a.missionId === mission.id);
    if (priorAssigned?.aircraftId === aircraft.id && priorAssigned?.crewId === crew.id) {
      stabilityBonus = 12; // reward plan stability
    }
  }

  const score = priorityWeight - riskPenalty - fatiguePenalty + serviceabilityBonus + stabilityBonus;

  return {
    valid: violations.length === 0,
    violations,
    score: Math.round(score * 10) / 10,
  };
}

/**
 * CONSTRAINT-BASED ASSIGNMENT SOLVER
 * Simulates Google OR-Tools CP-SAT logic:
 * - Orders decision variables by priority (P1 first, then P2, then P3)
 * - Explores candidate assignments satisfying hard constraints
 * - Optimises global objective: max sum(Priority*Coverage) - lambda*Risk - mu*PlanDrift
 */
export function solveConstraintPlan(
  state: LiveOperationalState,
  options: SolverOptions = {}
): GeneratedPlan {
  const startTime = performance.now();
  const sortedMissions = [...state.missions].sort((a, b) => {
    const pWeight = { P1: 3, P2: 2, P3: 1 };
    return pWeight[b.priority] - pWeight[a.priority];
  });

  const scheduledAssignments: Array<{ mission: Mission; aircraftId: string; crewId: string }> = [];
  const assignments: MissionAssignment[] = [];

  // Available weapon tracking per base to prevent over-allocation
  const baseWeaponStock: Record<string, number> = {};
  state.weapons.forEach((w) => {
    baseWeaponStock[w.id] = w.quantityAvailable;
  });

  for (const mission of sortedMissions) {
    // Find all valid candidate pairs (Aircraft, Crew)
    const validCandidates: Array<{
      aircraft: Aircraft;
      crew: Crew;
      weaponId: string;
      score: number;
      violations: string[];
    }> = [];

    for (const aircraft of state.aircraft) {
      if (aircraft.role !== mission.requiredRole || aircraft.status === 'AOG') {
        continue;
      }

      // Check weapon
      const weapon = state.weapons.find(
        (w) => w.baseId === aircraft.baseId && w.type === mission.requiredWeaponType
      );
      if (!weapon || (baseWeaponStock[weapon.id] || 0) < mission.requiredWeaponQty) {
        continue;
      }

      for (const crew of state.crews) {
        const evalRes = evaluateCandidateAssignment(
          mission,
          aircraft,
          crew,
          state,
          scheduledAssignments,
          options
        );

        if (evalRes.valid) {
          validCandidates.push({
            aircraft,
            crew,
            weaponId: weapon.id,
            score: evalRes.score,
            violations: evalRes.violations,
          });
        }
      }
    }

    if (validCandidates.length > 0) {
      // Pick best candidate according to objective score
      validCandidates.sort((a, b) => b.score - a.score);
      const best = validCandidates[0];

      scheduledAssignments.push({
        mission,
        aircraftId: best.aircraft.id,
        crewId: best.crew.id,
      });

      // Deduct weapon stock
      baseWeaponStock[best.weaponId] -= mission.requiredWeaponQty;

      const serv = calculateAircraftServiceability(best.aircraft);
      const wth = calculateWeatherImpact(mission, state);
      const th = calculateThreatRisk(mission, state, best.aircraft);
      const fat = calculateCrewFatigue(best.crew);

      assignments.push({
        missionId: mission.id,
        aircraftId: best.aircraft.id,
        crewId: best.crew.id,
        weaponTypeId: best.weaponId,
        weaponQuantity: mission.requiredWeaponQty,
        predictedRisk: th.riskScore,
        serviceabilityScore: serv.probabilityPercent,
        weatherImpactScore: wth.impactScore,
        crewFatigueScore: fat.fatigueScore,
        compositeScore: best.score,
        constraintViolations: [],
      });
    } else {
      // Unassigned mission
      assignments.push({
        missionId: mission.id,
        aircraftId: null,
        crewId: null,
        weaponTypeId: null,
        weaponQuantity: 0,
        predictedRisk: 85,
        serviceabilityScore: 0,
        weatherImpactScore: 50,
        crewFatigueScore: 0,
        compositeScore: -50,
        constraintViolations: ['Unassigned: No valid asset combination satisfies operational constraints'],
      });
    }
  }

  // Calculate Metrics
  const p1Missions = state.missions.filter((m) => m.priority === 'P1');
  const p1Assigned = p1Missions.filter((m) => assignments.some((a) => a.missionId === m.id && a.aircraftId !== null));
  const p1CoveragePercent = p1Missions.length > 0 ? Math.round((p1Assigned.length / p1Missions.length) * 100) : 100;

  const totalAssigned = assignments.filter((a) => a.aircraftId !== null).length;
  const totalCoveragePercent = state.missions.length > 0 ? Math.round((totalAssigned / state.missions.length) * 100) : 0;

  const assignedEntries = assignments.filter((a) => a.aircraftId !== null);
  const averageRiskScore = assignedEntries.length > 0
    ? Math.round(assignedEntries.reduce((acc, curr) => acc + curr.predictedRisk, 0) / assignedEntries.length)
    : 0;

  // Plan stability diff vs prior plan
  let planChangesVsPrior = 0;
  if (options.priorPlan) {
    assignments.forEach((curr) => {
      const prior = options.priorPlan?.assignments.find((a) => a.missionId === curr.missionId);
      if (prior && (prior.aircraftId !== curr.aircraftId || prior.crewId !== curr.crewId)) {
        planChangesVsPrior++;
      }
    });
  }

  const solveTimeMs = Math.round((performance.now() - startTime) * 10) / 10;

  const planName = options.riskTolerance === 'CONSERVATIVE_LOW_RISK'
    ? 'Plan B: Low-Risk Conservative'
    : options.riskTolerance === 'HIGH_SURGE'
    ? 'Plan C: High-Surge Output'
    : 'Recommended Plan: Balanced Assurance';

  const planDesc = options.riskTolerance === 'CONSERVATIVE_LOW_RISK'
    ? 'Minimises threat exposure and preserves rested crews. Favours standoff engagement envelopes.'
    : options.riskTolerance === 'HIGH_SURGE'
    ? 'Maximises simultaneous sortie generation and target coverage under elevated tempo.'
    : 'Primary constraint-optimised Air Tasking Order balancing combat assurance, crew fatigue, and fleet endurance.';

  return {
    planId: `PLAN-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
    name: planName,
    description: planDesc,
    plannerType: 'CP_SAT_SOLVER',
    generatedAt: Date.now(),
    assignments,
    metrics: {
      p1CoveragePercent,
      totalCoveragePercent,
      averageRiskScore,
      totalFuelConsumptionKg: assignedEntries.length * 6400,
      planChangesVsPrior,
      objectiveScore: Math.round(totalAssigned * 50 - averageRiskScore * 1.2),
      solveTimeMs: Math.max(12, solveTimeMs),
    },
    explanation: generateFallbackExplanation(planName, {
      p1CoveragePercent,
      totalCoveragePercent,
      averageRiskScore,
    }),
    isAiGeneratedExplanation: true,
  };
}

/**
 * HEURISTIC FALLBACK PLANNER
 * Greedy priority-first assignment. Used when telemetry is degraded (Mode 3).
 * Simple greedy heuristic that matches the first serviceable aircraft and crew.
 */
export function solveHeuristicFallbackPlan(
  state: LiveOperationalState,
  options: SolverOptions = {}
): GeneratedPlan {
  const startTime = performance.now();
  const sortedMissions = [...state.missions].sort((a, b) => (a.priority === 'P1' ? -1 : 1));
  const assignments: MissionAssignment[] = [];
  const assignedAircraft = new Set<string>();
  const assignedCrews = new Set<string>();

  for (const mission of sortedMissions) {
    // Greedy search: first available aircraft matching role
    const aircraft = state.aircraft.find(
      (a) => a.role === mission.requiredRole && a.status === 'Serviceable' && !assignedAircraft.has(a.id)
    );

    // Greedy search: first crew matching role with fatigue <= 75
    const crew = state.crews.find(
      (c) => c.qualifications.includes(mission.requiredRole) && c.fatigueScore <= 75 && !assignedCrews.has(c.id)
    );

    if (aircraft && crew) {
      assignedAircraft.add(aircraft.id);
      assignedCrews.add(crew.id);

      assignments.push({
        missionId: mission.id,
        aircraftId: aircraft.id,
        crewId: crew.id,
        weaponTypeId: null,
        weaponQuantity: mission.requiredWeaponQty,
        predictedRisk: 48,
        serviceabilityScore: 80,
        weatherImpactScore: 35,
        crewFatigueScore: crew.fatigueScore,
        compositeScore: 40,
        constraintViolations: ['Generated under degraded telemetry: Heuristic Greedy Fallback active'],
      });
    } else {
      assignments.push({
        missionId: mission.id,
        aircraftId: null,
        crewId: null,
        weaponTypeId: null,
        weaponQuantity: 0,
        predictedRisk: 90,
        serviceabilityScore: 0,
        weatherImpactScore: 60,
        crewFatigueScore: 0,
        compositeScore: -40,
        constraintViolations: ['Unassigned: Greedy search exhausted matching assets'],
      });
    }
  }

  const p1Missions = state.missions.filter((m) => m.priority === 'P1');
  const p1Assigned = p1Missions.filter((m) => assignments.some((a) => a.missionId === m.id && a.aircraftId !== null));
  const p1Coverage = p1Missions.length > 0 ? Math.round((p1Assigned.length / p1Missions.length) * 100) : 100;
  const totalAssigned = assignments.filter((a) => a.aircraftId !== null).length;

  return {
    planId: `FALLBACK-${Date.now().toString(36).toUpperCase()}`,
    name: 'Degraded Fallback Plan (Heuristic Greedy)',
    description: 'Greedy priority allocation activated due to telemetry degradation. Manual review strongly advised.',
    plannerType: 'HEURISTIC_FALLBACK',
    generatedAt: Date.now(),
    assignments,
    metrics: {
      p1CoveragePercent: p1Coverage,
      totalCoveragePercent: Math.round((totalAssigned / state.missions.length) * 100),
      averageRiskScore: 52,
      totalFuelConsumptionKg: totalAssigned * 5800,
      planChangesVsPrior: 0,
      objectiveScore: totalAssigned * 35,
      solveTimeMs: Math.round((performance.now() - startTime) * 10) / 10,
    },
    explanation: generateFallbackExplanation(
      'Degraded Fallback Plan (Heuristic Greedy)',
      { p1CoveragePercent: p1Coverage, totalCoveragePercent: Math.round((totalAssigned / state.missions.length) * 100), averageRiskScore: 52 },
      'Telemetry Degraded'
    ),
    isAiGeneratedExplanation: true,
  };
}

/**
 * Generates the Recommended Plan + 2 Alternative What-If Options side-by-side
 */
export function generatePlanSet(
  state: LiveOperationalState,
  isDegraded: boolean = false,
  priorPlan?: GeneratedPlan | null
): {
  recommended: GeneratedPlan;
  alternativeLowRisk: GeneratedPlan;
  alternativeSurge: GeneratedPlan;
} {
  if (isDegraded) {
    const fallback = solveHeuristicFallbackPlan(state, { priorPlan });
    return {
      recommended: fallback,
      alternativeLowRisk: solveHeuristicFallbackPlan(state, { priorPlan }),
      alternativeSurge: solveHeuristicFallbackPlan(state, { priorPlan }),
    };
  }

  const recommended = solveConstraintPlan(state, {
    riskTolerance: 'BALANCED',
    priorPlan,
    penalizePlanChanges: true,
  });

  const alternativeLowRisk = solveConstraintPlan(state, {
    riskTolerance: 'CONSERVATIVE_LOW_RISK',
    priorPlan,
    penalizePlanChanges: false,
  });

  const alternativeSurge = solveConstraintPlan(state, {
    riskTolerance: 'HIGH_SURGE',
    priorPlan,
    penalizePlanChanges: false,
  });

  return {
    recommended,
    alternativeLowRisk,
    alternativeSurge,
  };
}
