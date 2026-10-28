import {
  Aircraft,
  Crew,
  WeaponInventory,
  Mission,
  AirspaceZone,
  ZoneWeather,
  ThreatMarker,
  Airbase,
  LiveOperationalState,
  FeedStatus,
} from '../types/ops';

/**
 * Deterministic pseudo-random number generator (Mulberry32)
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  pick<T>(array: T[]): T {
    return array[this.rangeInt(0, array.length - 1)];
  }

  sample<T>(array: T[], count: number): T[] {
    const copy = [...array];
    const result: T[] = [];
    for (let i = 0; i < count && copy.length > 0; i++) {
      const idx = this.rangeInt(0, copy.length - 1);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  }
}

export const SYNTHETIC_AIRBASES: Airbase[] = [
  {
    id: 'BASE-ALPHA',
    code: 'AFB-AMB',
    name: 'Tactical Wing Ambala-North',
    coordinates: { x: 180, y: 380 },
    hasMunitionsDepot: true,
    runwayStatus: 'Active',
  },
  {
    id: 'BASE-BRAVO',
    code: 'AFB-JDP',
    name: 'Sector Station Jodhpur-West',
    coordinates: { x: 310, y: 490 },
    hasMunitionsDepot: true,
    runwayStatus: 'Active',
  },
  {
    id: 'BASE-CHARLIE',
    code: 'AFB-HLW',
    name: 'Forward Airbase Halwara-Core',
    coordinates: { x: 250, y: 220 },
    hasMunitionsDepot: true,
    runwayStatus: 'Active',
  },
];

export const SYNTHETIC_AIRSPACE_ZONES: AirspaceZone[] = [
  {
    id: 'ZONE-NORTH',
    name: 'Sector Northern Ridge (Z-1)',
    corridorStatus: 'Contested',
    polygonCoords: [
      { x: 100, y: 60 },
      { x: 450, y: 70 },
      { x: 400, y: 240 },
      { x: 90, y: 210 },
    ],
  },
  {
    id: 'ZONE-CENTRAL',
    name: 'Sector Central Plains (Z-2)',
    corridorStatus: 'Open',
    polygonCoords: [
      { x: 120, y: 240 },
      { x: 500, y: 260 },
      { x: 480, y: 440 },
      { x: 110, y: 410 },
    ],
  },
  {
    id: 'ZONE-WEST',
    name: 'Sector Desert Corridor (Z-3)',
    corridorStatus: 'Restricted',
    polygonCoords: [
      { x: 140, y: 430 },
      { x: 550, y: 450 },
      { x: 510, y: 580 },
      { x: 130, y: 560 },
    ],
  },
];

export function generateScenario(seed: number = 101, scenarioName: string = 'Operation Trishul Sentinel'): LiveOperationalState {
  const rng = new SeededRNG(seed);

  // 1. Generate Aircraft (10 aircraft: A1 to A10)
  const aircraftModels: Array<{ model: string; role: Aircraft['role']; fuelKg: number; endurance: number }> = [
    { model: 'Netra Mk1 AEW&C', role: 'ISR', fuelKg: 9500, endurance: 6.5 },
    { model: 'Phalcon Airborne Sensor', role: 'ISR', fuelKg: 14000, endurance: 8.0 },
    { model: 'Su-30MKI Flanker-H', role: 'CAP', fuelKg: 9400, endurance: 4.5 },
    { model: 'Rafale-DH Omnirole', role: 'CAP', fuelKg: 6700, endurance: 4.0 },
    { model: 'Tejas Mk1A LCA', role: 'CAP', fuelKg: 3000, endurance: 2.8 },
    { model: 'Mirage-2000I Vajra', role: 'Strike', fuelKg: 5200, endurance: 3.5 },
    { model: 'Jaguar IS Deep Penetration', role: 'Strike', fuelKg: 4600, endurance: 3.2 },
    { model: 'Su-30MKI Strike-Bravo', role: 'Strike', fuelKg: 9400, endurance: 4.5 },
    { model: 'C-130J Super Hercules', role: 'Transport', fuelKg: 19000, endurance: 7.2 },
    { model: 'An-32 Tactical Lifter', role: 'Transport', fuelKg: 7800, endurance: 4.8 },
  ];

  const callsigns = [
    'Garuda-1', 'Netra-Sight', 'Trishul-Lead', 'Vajra-2', 'Tejas-Arrow',
    'Baaz-Falcon', 'Shamsher-4', 'Rudra-Lead', 'Gajraj-Lifter', 'Himmat-Air'
  ];

  const aircraftList: Aircraft[] = aircraftModels.map((spec, i) => {
    const id = `A${i + 1}`;
    // A3 starts as Serviceable by default in baseline scenario so Mode 2 can turn A3 into AOG!
    let status: Aircraft['status'] = 'Serviceable';
    if (i === 6 && rng.next() > 0.6) {
      status = 'Maintenance';
    }

    const hoursToService = rng.rangeInt(14, 85);
    const serviceabilityProb = (status as Aircraft['status']) === 'AOG' ? 0.05 : status === 'Maintenance' ? 0.45 : Number((0.82 + rng.next() * 0.17).toFixed(2));
    const assignedBase = SYNTHETIC_AIRBASES[i % SYNTHETIC_AIRBASES.length].id;

    return {
      id,
      callsign: callsigns[i] || `Asset-${id}`,
      model: spec.model,
      role: spec.role,
      status,
      baseId: assignedBase,
      fuelKg: Math.round(spec.fuelKg * (0.85 + rng.next() * 0.15)),
      maxFuelKg: spec.fuelKg,
      enduranceHours: spec.endurance,
      flightHoursToService: hoursToService,
      serviceabilityProb,
      countermeasuresLevel: i < 5 ? 'EW-Suite' : 'Advanced',
    };
  });

  // 2. Generate Crew (12 crew members: C1 to C12)
  const crewRanks = ['Wg Cdr', 'Sqn Ldr', 'Flt Lt', 'Wg Cdr', 'Sqn Ldr', 'Flt Lt'];
  const crewNames = [
    'Vikramaditya Rathore', 'Kabir Sharma', 'Aarav Nair', 'Devender Gill',
    'Rohan Deshmukh', 'Tarun Sen', 'Ananya Varma', 'Manish Chawla',
    'Prashant Rawat', 'Kunal Sengupta', 'Harsh Vardhan', 'Sameer Saxena'
  ];

  const crewList: Crew[] = crewNames.map((name, i) => {
    const id = `C${i + 1}`;
    // Assign qualifications based on index
    let qualifications: Aircraft['role'][];
    if (i <= 2) {
      qualifications = ['CAP', 'Strike'];
    } else if (i <= 5) {
      qualifications = ['Strike'];
    } else if (i <= 8) {
      qualifications = ['CAP'];
    } else if (i <= 9) {
      qualifications = ['ISR'];
    } else {
      qualifications = ['Transport'];
    }

    const dutyHours = Number((1.5 + rng.next() * 4.8).toFixed(1));
    const fatigueScore = Math.min(85, Math.round(dutyHours * 10 + rng.rangeInt(5, 20)));

    return {
      id,
      name,
      rank: crewRanks[i % crewRanks.length],
      qualifications,
      fatigueScore,
      dutyHoursToday: dutyHours,
      maxDutyHours: 8.0,
      availabilityStart: '06:00',
      availabilityEnd: '19:00',
      status: fatigueScore > 70 ? 'On-Rest' : 'Ready',
    };
  });

  // 3. Armament Inventory per base
  const weaponConfigs = [
    { type: 'BVR-AAM Astra-Mk1', name: 'Astra Mk-1 BVR-AAM', roles: ['CAP'] },
    { type: 'Precision-SDB Spice', name: 'Spice-2000 Precision Munition', roles: ['Strike'] },
    { type: 'Standoff-Cruise Rudram', name: 'Rudram-I Anti-Radiation Standoff', roles: ['Strike'] },
    { type: 'Recon-EW Pod Advanced', name: 'Synthetic Aperture Radar Pod', roles: ['ISR'] },
    { type: 'Rapid Cargo Pallet Airdrop', name: 'Airborne Relief / Supply Pallet', roles: ['Transport'] },
  ];

  const armamentInventory: WeaponInventory[] = [];
  SYNTHETIC_AIRBASES.forEach((base) => {
    weaponConfigs.forEach((w, wIdx) => {
      armamentInventory.push({
        id: `WPN-${base.id.slice(-3)}-${wIdx + 1}`,
        name: w.name,
        type: w.type,
        baseId: base.id,
        quantityAvailable: rng.rangeInt(8, 28),
        minReliability: Number((0.92 + rng.next() * 0.07).toFixed(2)),
      });
    });
  });

  // 4. Generate Missions (6 missions: M-101 to M-106)
  const missionSpecs: Array<{
    id: string;
    code: string;
    priority: Mission['priority'];
    role: Aircraft['role'];
    window: [string, string];
    duration: number;
    weaponType: string;
    qty: number;
    threat: Mission['threatLevel'];
    coords: { x: number; y: number };
    sector: string;
    targetName: string;
  }> = [
    {
      id: 'M-101',
      code: 'Operation Trishul Shield',
      priority: 'P1',
      role: 'CAP',
      window: ['07:00', '10:30'],
      duration: 3.5,
      weaponType: 'BVR-AAM Astra-Mk1',
      qty: 4,
      threat: 'High',
      coords: { x: 380, y: 150 },
      sector: 'Sector Northern Ridge (Z-1)',
      targetName: 'Border Air Corridor Bravo-9',
    },
    {
      id: 'M-102',
      code: 'Operation Garuda Eye',
      priority: 'P1',
      role: 'ISR',
      window: ['08:00', '12:30'],
      duration: 4.5,
      weaponType: 'Recon-EW Pod Advanced',
      qty: 1,
      threat: 'Medium',
      coords: { x: 420, y: 280 },
      sector: 'Sector Central Plains (Z-2)',
      targetName: 'Hostile Staging Area Delta',
    },
    {
      id: 'M-103',
      code: 'Operation Vajra Strike',
      priority: 'P1',
      role: 'Strike',
      window: ['09:30', '12:45'],
      duration: 3.2,
      weaponType: 'Precision-SDB Spice',
      qty: 2,
      threat: 'Severe',
      coords: { x: 490, y: 190 },
      sector: 'Sector Northern Ridge (Z-1)',
      targetName: 'Reinforced Munitions Depot Zulu',
    },
    {
      id: 'M-104',
      code: 'Operation Desert Falcon',
      priority: 'P2',
      role: 'CAP',
      window: ['11:00', '14:30'],
      duration: 3.5,
      weaponType: 'BVR-AAM Astra-Mk1',
      qty: 2,
      threat: 'Medium',
      coords: { x: 480, y: 480 },
      sector: 'Sector Desert Corridor (Z-3)',
      targetName: 'Southern Forward Patrol Line',
    },
    {
      id: 'M-105',
      code: 'Operation Shaktiman Airdrop',
      priority: 'P2',
      role: 'Transport',
      window: ['12:30', '16:00'],
      duration: 3.5,
      weaponType: 'Rapid Cargo Pallet Airdrop',
      qty: 6,
      threat: 'Low',
      coords: { x: 260, y: 110 },
      sector: 'Sector Northern Ridge (Z-1)',
      targetName: 'Forward High-Altitude Outpost Victor',
    },
    {
      id: 'M-106',
      code: 'Operation Standoff Hammer',
      priority: 'P3',
      role: 'Strike',
      window: ['14:00', '17:30'],
      duration: 3.5,
      weaponType: 'Standoff-Cruise Rudram',
      qty: 2,
      threat: 'High',
      coords: { x: 530, y: 350 },
      sector: 'Sector Central Plains (Z-2)',
      targetName: 'Hostile Early Warning Radar Station',
    },
  ];

  const missions: Mission[] = missionSpecs.map((m) => ({
    id: m.id,
    codeName: m.code,
    priority: m.priority,
    requiredRole: m.role,
    timeWindowStart: m.window[0],
    timeWindowEnd: m.window[1],
    durationHours: m.duration,
    targetLocation: {
      name: m.targetName,
      sector: m.sector,
      coords: m.coords,
    },
    requiredWeaponType: m.weaponType,
    requiredWeaponQty: m.qty,
    threatLevel: m.threat,
    status: 'Unassigned',
  }));

  // 5. Weather forecast per zone
  const weather: ZoneWeather[] = SYNTHETIC_AIRSPACE_ZONES.map((zone, zIdx) => {
    const visibilityKm = Number((6 + rng.next() * 6).toFixed(1));
    const windKnots = rng.rangeInt(10, 32);
    const cloudCover = rng.rangeInt(15, 65);
    const severity: ZoneWeather['severity'] = cloudCover > 55 || windKnots > 28 ? 'Moderate' : 'Clear';

    return {
      zoneId: zone.id,
      timestamp: Date.now() - rng.rangeInt(10, 45) * 1000,
      visibilityKm,
      windKnots,
      cloudCoverPercent: cloudCover,
      severity,
      ceilingFeet: rng.rangeInt(4000, 15000),
    };
  });

  // 6. Threat Picture
  const threatMarkers: ThreatMarker[] = [
    {
      id: 'THREAT-1',
      type: 'SAM-Radar',
      label: 'HQ-9 Equivalent SAM Battery Lock',
      severity: 'Severe',
      coords: { x: 505, y: 175 },
      rangeKm: 120,
      firstDetected: '05:42Z',
      status: 'Active',
    },
    {
      id: 'THREAT-2',
      type: 'EW-Jamming',
      label: 'High-Power GPS/Comms Denial Emitter',
      severity: 'High',
      coords: { x: 440, y: 260 },
      rangeKm: 85,
      firstDetected: '06:15Z',
      status: 'Active',
    },
    {
      id: 'THREAT-3',
      type: 'Hostile-CAP',
      label: '4x Hostile 4.5 Gen Fighter Sweep',
      severity: 'High',
      coords: { x: 520, y: 390 },
      rangeKm: 95,
      firstDetected: '06:50Z',
      status: 'Active',
    },
    {
      id: 'THREAT-4',
      type: 'SAM-Radar',
      label: 'Mobile SHORAD Air Defense Unit',
      severity: 'Medium',
      coords: { x: 460, y: 510 },
      rangeKm: 45,
      firstDetected: '07:05Z',
      status: 'Active',
    },
  ];

  // 7. Initial Feed Statuses
  const now = Date.now();
  const feeds: Record<string, FeedStatus> = {
    Fleet: { name: 'Fleet', freshness: 'FRESH', lastUpdated: now - 12000, latencyMs: 140, itemCount: aircraftList.length },
    Crew: { name: 'Crew', freshness: 'FRESH', lastUpdated: now - 24000, latencyMs: 180, itemCount: crewList.length },
    Armament: { name: 'Armament', freshness: 'FRESH', lastUpdated: now - 35000, latencyMs: 210, itemCount: armamentInventory.length },
    Airspace: { name: 'Airspace', freshness: 'FRESH', lastUpdated: now - 18000, latencyMs: 165, itemCount: SYNTHETIC_AIRSPACE_ZONES.length },
    Weather: { name: 'Weather', freshness: 'FRESH', lastUpdated: now - 45000, latencyMs: 290, itemCount: weather.length },
    Threat: { name: 'Threat', freshness: 'FRESH', lastUpdated: now - 8000, latencyMs: 110, itemCount: threatMarkers.length },
  };

  return {
    timestamp: now,
    scenarioSeed: seed,
    scenarioName,
    bases: SYNTHETIC_AIRBASES,
    aircraft: aircraftList,
    crews: crewList,
    weapons: armamentInventory,
    missions,
    airspaceZones: SYNTHETIC_AIRSPACE_ZONES,
    weather,
    threats: threatMarkers,
    feeds,
    stalenessAlerts: [],
  };
}
