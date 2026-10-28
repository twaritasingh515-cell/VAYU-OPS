import {
  LiveAircraft,
  CivilConflict,
  LiveFeedStatus,
  LiveFeedMeta,
  LiveWeatherData,
} from '../types/liveTraffic';
import { Mission, MissionAssignment, Aircraft } from '../types/ops';

export interface BoundingBox {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}

// Bounding box covering Rajasthan and Western Air Command sector (Jodhpur, Jaisalmer, Ambala, Delhi corridor)
export const DEFAULT_OPERATIONAL_BBOX: BoundingBox = {
  lamin: 24.0,
  lomin: 70.0,
  lamax: 31.0,
  lomax: 77.5,
};

// Coordinate projection helper from Lat/Lon to Tactical SVG coordinate space (650x550)
export function geoToTacticalCoords(
  lat: number,
  lon: number,
  bbox: BoundingBox = DEFAULT_OPERATIONAL_BBOX
): { x: number; y: number } {
  const normX = (lon - bbox.lomin) / (bbox.lomax - bbox.lomin);
  const normY = (bbox.lamax - lat) / (bbox.lamax - bbox.lamin);
  const x = Math.round(70 + Math.max(0, Math.min(1, normX)) * 510);
  const y = Math.round(50 + Math.max(0, Math.min(1, normY)) * 440);
  return { x, y };
}

// Reverse projection helper for bounds fitting
export function tacticalToGeoCoords(
  x: number,
  y: number,
  bbox: BoundingBox = DEFAULT_OPERATIONAL_BBOX
): { lat: number; lon: number } {
  const normX = Math.max(0, Math.min(1, (x - 70) / 510));
  const normY = Math.max(0, Math.min(1, (y - 50) / 440));
  const lon = +(bbox.lomin + normX * (bbox.lomax - bbox.lomin)).toFixed(4);
  const lat = +(bbox.lamax - normY * (bbox.lamax - bbox.lamin)).toFixed(4);
  return { lat, lon };
}

// Provider Interface
export interface LiveDataProvider {
  name: string;
  getAircraftInBounds(bbox: BoundingBox): Promise<{
    aircraft: LiveAircraft[];
    status: LiveFeedStatus;
    isStale: boolean;
    rateLimitedUntil?: number;
    sourceDescription: string;
  }>;
  getWeather(lat: number, lon: number): Promise<LiveWeatherData | null>;
}

// High-fidelity recorded backup dataset over Northern and Western India (DEL, JAI, JDH, BOM, DXB corridor)
const MOCK_CIVIL_TRAFFIC: Array<{
  icao24: string;
  callsign: string;
  originCountry: string;
  lat: number;
  lon: number;
  altitudeM: number;
  speedKts: number;
  heading: number;
  verticalRateFpm: number;
  squawk: string;
}> = [
  {
    icao24: '8004b2',
    callsign: 'AIC402',
    originCountry: 'India',
    lat: 28.15,
    lon: 74.82,
    altitudeM: 10972, // 36,000 ft (FL360)
    speedKts: 482,
    heading: 252,
    verticalRateFpm: 0,
    squawk: '2301',
  },
  {
    icao24: '80029a',
    callsign: 'IGO634',
    originCountry: 'India',
    lat: 27.42,
    lon: 73.65,
    altitudeM: 9448, // 31,000 ft (FL310)
    speedKts: 436,
    heading: 214,
    verticalRateFpm: -250,
    squawk: '1422',
  },
  {
    icao24: '80061e',
    callsign: 'SEJ811',
    originCountry: 'India',
    lat: 26.85,
    lon: 72.48,
    altitudeM: 6705, // 22,000 ft (FL220)
    speedKts: 395,
    heading: 270,
    verticalRateFpm: 0,
    squawk: '3104',
  },
  {
    icao24: '896431',
    callsign: 'UAE502',
    originCountry: 'United Arab Emirates',
    lat: 26.35,
    lon: 71.95,
    altitudeM: 11582, // 38,000 ft (FL380)
    speedKts: 512,
    heading: 76,
    verticalRateFpm: 0,
    squawk: '4210',
  },
  {
    icao24: '80055c',
    callsign: 'VTI772',
    originCountry: 'India',
    lat: 25.45,
    lon: 73.12,
    altitudeM: 10363, // 34,000 ft (FL340)
    speedKts: 460,
    heading: 14,
    verticalRateFpm: 150,
    squawk: '2105',
  },
  {
    icao24: '06a208',
    callsign: 'QTR831',
    originCountry: 'Qatar',
    lat: 27.92,
    lon: 71.35,
    altitudeM: 10668, // 35,000 ft (FL350)
    speedKts: 494,
    heading: 78,
    verticalRateFpm: 0,
    squawk: '5230',
  },
  {
    icao24: '8007cf',
    callsign: 'AXB194',
    originCountry: 'India',
    lat: 25.12,
    lon: 74.45,
    altitudeM: 11277, // 37,000 ft (FL370)
    speedKts: 475,
    heading: 84,
    verticalRateFpm: 0,
    squawk: '3318',
  },
  {
    icao24: '80011a',
    callsign: 'VT-RKL',
    originCountry: 'India',
    lat: 26.65,
    lon: 75.32,
    altitudeM: 3657, // 12,000 ft (FL120)
    speedKts: 228,
    heading: 142,
    verticalRateFpm: -500,
    squawk: '1200',
  },
  {
    // Emergency squawk 7700 flight for demonstration
    icao24: '80099e',
    callsign: 'VT-MED',
    originCountry: 'India',
    lat: 28.52,
    lon: 73.25,
    altitudeM: 5486, // 18,000 ft (FL180 descending)
    speedKts: 410,
    heading: 96,
    verticalRateFpm: -1800,
    squawk: '7700', // General emergency
  },
];

// Mock Provider: Deterministic playback with dead-reckoned trajectory updates
export class MockLiveProvider implements LiveDataProvider {
  public name = 'Mock Provider (Recorded Airspace Vectors)';
  private mockStartTime = Date.now();

  public async getAircraftInBounds(bbox: BoundingBox) {
    const elapsedSec = (Date.now() - this.mockStartTime) / 1000;

    const aircraft: LiveAircraft[] = MOCK_CIVIL_TRAFFIC.map((item, idx) => {
      // Advance position smoothly along heading
      const rad = (item.heading * Math.PI) / 180;
      const speedDegPerSec = (item.speedKts / 3600) / 60; // 1 nm ≈ 1/60 degree
      const lat = item.lat + Math.cos(rad) * speedDegPerSec * (elapsedSec % 7200);
      const lon = item.lon + (Math.sin(rad) * speedDegPerSec * (elapsedSec % 7200)) / Math.cos((item.lat * Math.PI) / 180);

      const altitudeFt = Math.round(item.altitudeM * 3.28084);
      const flightLevel = altitudeFt >= 10000 ? `FL${Math.round(altitudeFt / 100)}` : `${altitudeFt} ft`;
      const isEmergency = item.squawk === '7500' || item.squawk === '7600' || item.squawk === '7700';
      const emergencyType =
        item.squawk === '7500'
          ? ('HIJACK' as const)
          : item.squawk === '7600'
          ? ('RADIO_FAILURE' as const)
          : item.squawk === '7700'
          ? ('GENERAL_EMERGENCY' as const)
          : undefined;

      const coords = geoToTacticalCoords(lat, lon, bbox);

      return {
        icao24: item.icao24,
        callsign: item.callsign,
        originCountry: item.originCountry,
        latitude: +lat.toFixed(4),
        longitude: +lon.toFixed(4),
        altitudeM: item.altitudeM,
        altitudeFt,
        flightLevel,
        onGround: false,
        velocityMs: +(item.speedKts * 0.514444).toFixed(1),
        speedKnots: item.speedKts,
        heading: item.heading,
        verticalRateMs: +(item.verticalRateFpm * 0.00508).toFixed(1),
        verticalRateFpm: item.verticalRateFpm,
        geometricAltitudeM: item.altitudeM,
        squawk: item.squawk,
        lastContact: Math.floor(Date.now() / 1000),
        isEmergency,
        emergencyType,
        source: 'MOCK_FEED' as const,
        lastUpdatedMs: Date.now(),
        x: coords.x,
        y: coords.y,
        trail: [],
      };
    });

    return {
      aircraft,
      status: 'CONNECTED' as const,
      isStale: false,
      sourceDescription: 'High-Fidelity Civil Airspace Playback (9 Indian Air Corridor Flights)',
    };
  }

  public async getWeather(lat: number, lon: number): Promise<LiveWeatherData | null> {
    return {
      locationName: 'Jodhpur Airspace (SWAC)',
      latitude: lat,
      longitude: lon,
      temperatureC: 31.4,
      humidityPercent: 28,
      windSpeedKts: 14.5,
      windDirectionDeg: 245,
      visibilityKm: 10.0,
      cloudCoverPercent: 15,
      weatherDescription: 'Clear / Optimal VFR',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' UTC',
    };
  }
}

// OpenSky Live Provider with Proxy Support and Automatic Fallback
export class OpenSkyLiveProvider implements LiveDataProvider {
  public name = 'OpenSky Network Live Provider';
  private lastGoodData: LiveAircraft[] = [];
  private rateLimitedUntil = 0;
  private mockFallback = new MockLiveProvider();

  public async getAircraftInBounds(bbox: BoundingBox) {
    const now = Date.now();
    if (now < this.rateLimitedUntil) {
      const remainingSec = Math.ceil((this.rateLimitedUntil - now) / 1000);
      const fallback = await this.mockFallback.getAircraftInBounds(bbox);
      return {
        aircraft: this.lastGoodData.length > 0 ? this.lastGoodData : fallback.aircraft,
        status: 'RATE_LIMITED' as const,
        isStale: true,
        rateLimitedUntil: this.rateLimitedUntil,
        sourceDescription: `OpenSky rate-limited; retrying in ${remainingSec}s. Using cached airspace vectors.`,
      };
    }

    try {
      // First attempt: call local server proxy route which manages auth and CORS
      const proxyUrl = `/api/opensky/states?lamin=${bbox.lamin}&lomin=${bbox.lomin}&lamax=${bbox.lamax}&lomax=${bbox.lomax}`;
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (response.status === 429) {
        this.rateLimitedUntil = Date.now() + 60 * 1000;
        const fallback = await this.mockFallback.getAircraftInBounds(bbox);
        return {
          aircraft: this.lastGoodData.length > 0 ? this.lastGoodData : fallback.aircraft,
          status: 'RATE_LIMITED' as const,
          isStale: true,
          rateLimitedUntil: this.rateLimitedUntil,
          sourceDescription: 'OpenSky HTTP 429 rate limit received. Retrying in 60s.',
        };
      }

      if (!response.ok) {
        throw new Error(`Proxy returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const rawStates: any[][] = data.states || [];

      const parsedAircraft: LiveAircraft[] = [];

      for (const st of rawStates) {
        const icao24 = String(st[0] || '').toLowerCase();
        const rawCallsign = String(st[1] || '').trim();
        const callsign = rawCallsign || icao24.toUpperCase();
        const originCountry = String(st[2] || 'International');
        const lon = st[5];
        const lat = st[6];

        // Skip aircraft missing coordinates
        if (typeof lat !== 'number' || typeof lon !== 'number') continue;

        const baroAltM = typeof st[7] === 'number' ? st[7] : null;
        const altitudeFt = baroAltM !== null ? Math.round(baroAltM * 3.28084) : 0;
        const flightLevel = altitudeFt >= 10000 ? `FL${Math.round(altitudeFt / 100)}` : `${altitudeFt} ft`;
        const onGround = Boolean(st[8]);
        const velocityMs = typeof st[9] === 'number' ? st[9] : null;
        const speedKnots = velocityMs !== null ? Math.round(velocityMs * 1.94384) : 0;
        const heading = typeof st[10] === 'number' ? Math.round(st[10]) : 0;
        const verticalRateMs = typeof st[11] === 'number' ? st[11] : null;
        const verticalRateFpm = verticalRateMs !== null ? Math.round(verticalRateMs * 196.85) : 0;
        const geoAltM = typeof st[13] === 'number' ? st[13] : null;
        const squawk = st[14] ? String(st[14]) : null;
        const lastContact = typeof st[4] === 'number' ? st[4] : Math.floor(Date.now() / 1000);

        const isEmergency = squawk === '7500' || squawk === '7600' || squawk === '7700';
        const emergencyType =
          squawk === '7500'
            ? ('HIJACK' as const)
            : squawk === '7600'
            ? ('RADIO_FAILURE' as const)
            : squawk === '7700'
            ? ('GENERAL_EMERGENCY' as const)
            : undefined;

        const coords = geoToTacticalCoords(lat, lon, bbox);

        parsedAircraft.push({
          icao24,
          callsign,
          originCountry,
          latitude: +lat.toFixed(4),
          longitude: +lon.toFixed(4),
          altitudeM: baroAltM,
          altitudeFt,
          flightLevel,
          onGround,
          velocityMs,
          speedKnots,
          heading,
          verticalRateMs,
          verticalRateFpm,
          geometricAltitudeM: geoAltM,
          squawk,
          lastContact,
          isEmergency,
          emergencyType,
          source: 'OPENSKY_LIVE',
          lastUpdatedMs: Date.now(),
          x: coords.x,
          y: coords.y,
          trail: [],
        });
      }

      this.lastGoodData = parsedAircraft;
      return {
        aircraft: parsedAircraft,
        status: 'CONNECTED' as const,
        isStale: false,
        sourceDescription: `The OpenSky Network (${parsedAircraft.length} live civil flights in bounding corridor)`,
      };
    } catch (err) {
      console.warn('[VAYU-OPS] OpenSky live request failed, activating resilient mock fallback:', err);
      const fallback = await this.mockFallback.getAircraftInBounds(bbox);
      return {
        aircraft: this.lastGoodData.length > 0 ? this.lastGoodData : fallback.aircraft,
        status: this.lastGoodData.length > 0 ? ('DELAYED' as const) : ('OFFLINE' as const),
        isStale: true,
        sourceDescription: 'Live network interrupted; showing cached and backup Indian airspace traffic.',
      };
    }
  }

  public async getWeather(lat: number, lon: number): Promise<LiveWeatherData | null> {
    try {
      const res = await fetch(`/api/meteo/weather?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error('Weather proxy failure');
      const data = await res.json();
      const current = data.current;
      if (!current) throw new Error('No current weather');

      const windKts = +(current.wind_speed_10m * 0.539957).toFixed(1);
      const visKm = +(current.visibility / 1000).toFixed(1);

      return {
        locationName: `Lat ${lat.toFixed(2)}, Lon ${lon.toFixed(2)}`,
        latitude: lat,
        longitude: lon,
        temperatureC: Math.round(current.temperature_2m),
        humidityPercent: Math.round(current.relative_humidity_2m),
        windSpeedKts: windKts,
        windDirectionDeg: Math.round(current.wind_direction_10m),
        visibilityKm: visKm,
        cloudCoverPercent: Math.round(current.cloud_cover),
        weatherDescription: current.cloud_cover > 75 ? 'Overcast / IMC' : current.cloud_cover > 30 ? 'Scattered' : 'Clear / VMC',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' UTC',
      };
    } catch {
      return this.mockFallback.getWeather(lat, lon);
    }
  }
}

// -------------------------------------------------------------
// OPERATIONAL DECONFLICTION ENGINE
// -------------------------------------------------------------
// Checks civil traffic against active military sortie routes (10 nm lateral, 2,000 ft vertical)
export function detectCivilConflicts(
  liveAircraft: LiveAircraft[],
  assignments: MissionAssignment[],
  missions: Mission[],
  aircraftList: Aircraft[],
  getSimulatedState: (ac: Aircraft) => { x: number; y: number; altitudeFt: number }
): CivilConflict[] {
  const conflicts: CivilConflict[] = [];

  missions.forEach((m) => {
    const asgn = assignments.find((a) => a.missionId === m.id);
    if (!asgn?.aircraftId) return;
    const milAc = aircraftList.find((a) => a.id === asgn.aircraftId);
    if (!milAc || milAc.status !== 'Serviceable') return;

    const milSim = getSimulatedState(milAc);
    if (!milSim || milSim.altitudeFt <= 500) return; // Ignore on ground

    liveAircraft.forEach((civ) => {
      if (civ.onGround) return;

      // 1 tactical pixel ≈ 0.67 nautical miles in this operational sector
      const pxDist = Math.hypot(civ.x - milSim.x, civ.y - milSim.y);
      const lateralNm = +(pxDist * 0.67).toFixed(1);
      const altDiffFt = Math.abs(civ.altitudeFt - milSim.altitudeFt);

      // Conflict Envelope: <= 10 nm lateral AND <= 2,000 ft vertical separation
      if (lateralNm <= 10.0 && altDiffFt <= 2000) {
        const isCritical = lateralNm <= 4.0 && altDiffFt <= 1000;
        conflicts.push({
          id: `CONF-${civ.icao24}-${m.id}`,
          civilIcao24: civ.icao24,
          civilCallsign: civ.callsign,
          militaryMissionId: m.id,
          militaryAircraftId: milAc.id,
          lateralDistanceNm: lateralNm,
          altitudeDiffFt: altDiffFt,
          severity: isCritical ? 'CRITICAL' : 'WARNING',
          description: `Civil traffic conflict: Flight ${civ.callsign} (${civ.flightLevel}) encroaching ${m.id} corridor (${lateralNm} nm, ${altDiffFt} ft separation from ${milAc.id}).`,
          timestamp: 'Just now',
          civilX: civ.x,
          civilY: civ.y,
        });
      }
    });
  });

  return conflicts;
}
