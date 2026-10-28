import { Aircraft, Crew, Mission, LiveOperationalState } from '../types/ops';

export interface AircraftServiceabilityScore {
  aircraftId: string;
  probabilityPercent: number;
  rating: 'High' | 'Moderate' | 'Degraded' | 'Critical';
  formula: string;
  inputs: {
    airframeStatus: string;
    hoursToService: number;
    baseTurnaroundFactor: number;
    sensorAvionicsHealth: number;
  };
  explanation: string;
}

export interface WeatherImpactScore {
  missionId: string;
  impactScore: number; // 0 (Ideal) to 100 (Hazardous)
  flightCondition: 'Favorable' | 'Marginal' | 'Severe Risk';
  formula: string;
  inputs: {
    visibilityKm: number;
    cloudCoverPercent: number;
    windKnots: number;
    roleSensitivityFactor: number;
  };
  explanation: string;
}

export interface ThreatRiskScore {
  missionId: string;
  riskScore: number; // 0 (Benign) to 100 (Extreme Danger)
  threatCategory: 'Low' | 'Medium' | 'High' | 'Severe';
  formula: string;
  inputs: {
    closestThreatDistanceKm: number;
    highestThreatSeverity: string;
    ewJammingActive: boolean;
    samCoverageOverlap: boolean;
  };
  explanation: string;
}

export interface CrewFatigueScore {
  crewId: string;
  fatigueScore: number; // 0 to 100
  fitnessStatus: 'Combat Ready' | 'Mild Fatigue' | 'Rest Mandated';
  formula: string;
  inputs: {
    dutyHoursToday: number;
    maxDutyHours: number;
    circadianLoad: number;
    priorSortieHours: number;
  };
  explanation: string;
}

/**
 * 1. Serviceability forecast per aircraft
 * Calculates P(Available at mission window)
 */
export function calculateAircraftServiceability(aircraft: Aircraft): AircraftServiceabilityScore {
  if (aircraft.status === 'AOG') {
    return {
      aircraftId: aircraft.id,
      probabilityPercent: 4,
      rating: 'Critical',
      formula: 'P = 0.04 (Ground Stop / AOG Lockout)',
      inputs: {
        airframeStatus: 'AOG - Unserviceable',
        hoursToService: aircraft.flightHoursToService,
        baseTurnaroundFactor: 0.1,
        sensorAvionicsHealth: 15,
      },
      explanation: 'Airframe grounded due to critical avionics or structural snag. Requires depot-level clearance.',
    };
  }

  if (aircraft.status === 'Maintenance') {
    return {
      aircraftId: aircraft.id,
      probabilityPercent: 42,
      rating: 'Degraded',
      formula: 'P = BaseStatus(0.35) + (HoursToService / 100) * 0.15',
      inputs: {
        airframeStatus: 'Scheduled Maintenance',
        hoursToService: aircraft.flightHoursToService,
        baseTurnaroundFactor: 0.65,
        sensorAvionicsHealth: 60,
      },
      explanation: 'In 50-hour scheduled turnaround inspection. Turnaround turnaround time estimated 2.5 hrs.',
    };
  }

  // Serviceable
  const hoursFactor = Math.min(1.0, aircraft.flightHoursToService / 50);
  const prob = Math.min(0.98, Math.max(0.72, 0.78 + hoursFactor * 0.18));
  const percent = Math.round(prob * 100);

  return {
    aircraftId: aircraft.id,
    probabilityPercent: percent,
    rating: percent >= 88 ? 'High' : 'Moderate',
    formula: `P = 0.78 + (FlightHoursToService[${aircraft.flightHoursToService}] / 50) * 0.18`,
    inputs: {
      airframeStatus: 'Serviceable',
      hoursToService: aircraft.flightHoursToService,
      baseTurnaroundFactor: 0.95,
      sensorAvionicsHealth: 92,
    },
    explanation: `Airframe flight-ready. ${aircraft.flightHoursToService} hours remaining before mandatory phase maintenance.`,
  };
}

/**
 * 2. Weather Impact Score per mission
 * 0 (Optimal) to 100 (Unacceptable)
 */
export function calculateWeatherImpact(mission: Mission, state: LiveOperationalState): WeatherImpactScore {
  // Find weather in the zone matching mission sector
  const zone = state.airspaceZones.find((z) => mission.targetLocation.sector.includes(z.name.slice(0, 10)) || mission.targetLocation.sector.includes(z.id)) || state.airspaceZones[0];
  const w = state.weather.find((wth) => wth.zoneId === zone?.id) || state.weather[0] || {
    visibilityKm: 8,
    windKnots: 15,
    cloudCoverPercent: 30,
    severity: 'Clear',
  };

  // Role sensitivity factor: ISR and Strike are precision optical/sensor dependent
  const roleFactor = mission.requiredRole === 'ISR' ? 1.3 : mission.requiredRole === 'Strike' ? 1.15 : 0.85;

  const visibilityPenalty = Math.max(0, (10 - w.visibilityKm) * 5); // 0-50
  const windPenalty = Math.max(0, (w.windKnots - 15) * 1.8); // 0-35
  const cloudPenalty = (w.cloudCoverPercent / 100) * 20;

  const rawScore = (visibilityPenalty + windPenalty + cloudPenalty) * roleFactor;
  const score = Math.min(95, Math.max(8, Math.round(rawScore)));

  const condition: WeatherImpactScore['flightCondition'] =
    score > 55 ? 'Severe Risk' : score > 30 ? 'Marginal' : 'Favorable';

  return {
    missionId: mission.id,
    impactScore: score,
    flightCondition: condition,
    formula: `Score = (VisPenalty[${visibilityPenalty.toFixed(0)}] + WindPenalty[${windPenalty.toFixed(0)}] + Cloud[${cloudPenalty.toFixed(0)}]) × RoleSensitivity[${roleFactor}]`,
    inputs: {
      visibilityKm: w.visibilityKm,
      cloudCoverPercent: w.cloudCoverPercent,
      windKnots: w.windKnots,
      roleSensitivityFactor: roleFactor,
    },
    explanation: `${zone?.name || 'Sector'}: Visibility ${w.visibilityKm}km, Crosswinds ${w.windKnots}kt. Impact on ${mission.requiredRole} mission is ${condition.toLowerCase()}.`,
  };
}

/**
 * 3. Threat Risk Score per mission
 * 0 (Benign) to 100 (High Risk)
 */
export function calculateThreatRisk(
  mission: Mission,
  state: LiveOperationalState,
  assignedAircraft?: Aircraft | null
): ThreatRiskScore {
  // Find distance to closest threat
  let minDistanceKm = 999;
  let highestThreat = 'Low';
  let samOverlap = false;
  let jamming = false;

  state.threats.forEach((th) => {
    const dx = th.coords.x - mission.targetLocation.coords.x;
    const dy = th.coords.y - mission.targetLocation.coords.y;
    // Map units to approx km
    const dist = Math.sqrt(dx * dx + dy * dy) * 0.8;
    if (dist < minDistanceKm) {
      minDistanceKm = Math.round(dist);
    }
    if (dist <= th.rangeKm) {
      if (th.type === 'SAM-Radar') samOverlap = true;
      if (th.type === 'EW-Jamming') jamming = true;
    }
    if (th.severity === 'Severe') highestThreat = 'Severe';
    else if (th.severity === 'High' && highestThreat !== 'Severe') highestThreat = 'High';
  });

  // Base threat from mission priority & declared target threat
  const baseThreatMap: Record<Mission['threatLevel'], number> = {
    Low: 18,
    Medium: 42,
    High: 68,
    Severe: 88,
  };

  let score = baseThreatMap[mission.threatLevel] || 35;
  if (samOverlap) score += 12;
  if (jamming) score += 8;

  // Countermeasure discount if assigned aircraft has advanced suite
  if (assignedAircraft?.countermeasuresLevel === 'EW-Suite') {
    score -= 14;
  } else if (assignedAircraft?.countermeasuresLevel === 'Advanced') {
    score -= 7;
  }

  score = Math.min(98, Math.max(10, Math.round(score)));

  const category: ThreatRiskScore['threatCategory'] =
    score >= 75 ? 'Severe' : score >= 50 ? 'High' : score >= 30 ? 'Medium' : 'Low';

  return {
    missionId: mission.id,
    riskScore: score,
    threatCategory: category,
    formula: `Risk = BaseThreat[${baseThreatMap[mission.threatLevel]}] + SAM[${samOverlap ? 12 : 0}] + EW[${jamming ? 8 : 0}] - CM[${assignedAircraft ? (assignedAircraft.countermeasuresLevel === 'EW-Suite' ? 14 : 7) : 0}]`,
    inputs: {
      closestThreatDistanceKm: minDistanceKm,
      highestThreatSeverity: highestThreat,
      ewJammingActive: jamming,
      samCoverageOverlap: samOverlap,
    },
    explanation: `${mission.threatLevel} combat sector. Closest adversary contact ${minDistanceKm}km away. ${samOverlap ? 'Active radar tracking.' : 'Standoff envelope clear.'}`,
  };
}

/**
 * 4. Crew Fatigue and Availability score
 */
export function calculateCrewFatigue(crew: Crew): CrewFatigueScore {
  const dutyRatio = crew.dutyHoursToday / crew.maxDutyHours;
  const rawScore = Math.min(99, Math.round(dutyRatio * 75 + (crew.fatigueScore * 0.25)));

  const fitness: CrewFatigueScore['fitnessStatus'] =
    rawScore >= 75 ? 'Rest Mandated' : rawScore >= 45 ? 'Mild Fatigue' : 'Combat Ready';

  return {
    crewId: crew.id,
    fatigueScore: rawScore,
    fitnessStatus: fitness,
    formula: `Fatigue = (DutyHours[${crew.dutyHoursToday}] / MaxHours[${crew.maxDutyHours}]) × 75 + PriorLoad × 0.25`,
    inputs: {
      dutyHoursToday: crew.dutyHoursToday,
      maxDutyHours: crew.maxDutyHours,
      circadianLoad: Math.round(crew.fatigueScore * 0.25),
      priorSortieHours: crew.dutyHoursToday,
    },
    explanation: `${crew.rank} ${crew.name}: Logged ${crew.dutyHoursToday}h duty today. ${fitness === 'Rest Mandated' ? 'Mandatory rest prescribed by flight surgeon.' : 'Clear for tactical sortie.'}`,
  };
}
