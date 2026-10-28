import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  DataMode,
  LiveAircraft,
  LiveFeedStatus,
  LiveFeedMeta,
  AltitudeBand,
  CivilConflict,
  LiveWeatherData,
} from '../types/liveTraffic';
import {
  OpenSkyLiveProvider,
  MockLiveProvider,
  LiveDataProvider,
  DEFAULT_OPERATIONAL_BBOX,
  detectCivilConflicts,
  geoToTacticalCoords,
} from './liveTrafficService';
import { Mission, MissionAssignment, Aircraft } from '../types/ops';

export function useLiveTraffic(
  assignments: MissionAssignment[],
  missions: Mission[],
  aircraftList: Aircraft[],
  getSimulatedState: (ac: Aircraft) => { x: number; y: number; altitudeFt: number }
) {
  // 1. Data Mode State: SIMULATED (default) | LIVE | HYBRID
  const [dataMode, setDataMode] = useState<DataMode>('SIMULATED');

  // 2. Active Provider: OpenSky with mock fallback
  const providerRef = useRef<LiveDataProvider>(new OpenSkyLiveProvider());

  // 3. Live Traffic State
  const [liveAircraft, setLiveAircraft] = useState<LiveAircraft[]>([]);
  const [feedStatus, setFeedStatus] = useState<LiveFeedStatus>('CONNECTED');
  const [lastPollTime, setLastPollTime] = useState<number>(Date.now());
  const [secondsAgo, setSecondsAgo] = useState<number>(0);
  const [feedMeta, setFeedMeta] = useState<LiveFeedMeta>({
    provider: 'The OpenSky Network',
    status: 'CONNECTED',
    lastPollTimestamp: Date.now(),
    secondsSinceLastUpdate: 0,
    pollIntervalSec: 15,
    creditBudgetStatus: 'OPTIMAL',
    totalPollsToday: 1,
    isStale: false,
    sourceDescription: 'The OpenSky Network (ADS-B Civil Airspace Feed)',
  });

  // 4. View Filters
  const [altitudeBand, setAltitudeBand] = useState<AltitudeBand>('ALL');
  const [hideOnGround, setHideOnGround] = useState<boolean>(true);
  const [selectedLiveAircraftId, setSelectedLiveAircraftId] = useState<string | null>(null);

  // 5. Weather Cache
  const [weatherMap, setWeatherMap] = useState<Record<string, LiveWeatherData>>({});

  // 6. Polling Loop with Visibility Safeguard & Credit Budgeting
  const isTabVisible = useRef(true);
  useEffect(() => {
    const handleVisChange = () => {
      isTabVisible.current = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisChange);
    return () => document.removeEventListener('visibilitychange', handleVisChange);
  }, []);

  // Timer for "N seconds ago" counter
  useEffect(() => {
    const timer = setInterval(() => {
      const sec = Math.floor((Date.now() - lastPollTime) / 1000);
      setSecondsAgo(sec);
      setFeedMeta((prev) => ({ ...prev, secondsSinceLastUpdate: sec }));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastPollTime]);

  const pollLiveTraffic = useCallback(async () => {
    if (dataMode === 'SIMULATED' || !isTabVisible.current) return;

    try {
      const res = await providerRef.current.getAircraftInBounds(DEFAULT_OPERATIONAL_BBOX);
      const now = Date.now();
      setLastPollTime(now);
      setFeedStatus(res.status);

      // Preserve existing trail histories when updating
      setLiveAircraft((prev) => {
        const prevMap = new Map(prev.map((a) => [a.icao24, a]));
        return res.aircraft.map((ac) => {
          const old = prevMap.get(ac.icao24);
          const newTrail = old ? [...old.trail] : [];
          if (newTrail.length === 0 || Math.hypot(newTrail[newTrail.length - 1].x - ac.x, newTrail[newTrail.length - 1].y - ac.y) > 2.0) {
            newTrail.push({ x: ac.x, y: ac.y, altitudeFt: ac.altitudeFt, timestamp: now });
            if (newTrail.length > 60) newTrail.shift();
          }
          return {
            ...ac,
            trail: newTrail,
          };
        });
      });

      setFeedMeta((prev) => ({
        ...prev,
        status: res.status,
        lastPollTimestamp: now,
        isStale: res.isStale,
        rateLimitRetryAfterSec: res.rateLimitedUntil ? Math.ceil((res.rateLimitedUntil - now) / 1000) : undefined,
        sourceDescription: res.sourceDescription,
        totalPollsToday: prev.totalPollsToday + 1,
        creditBudgetStatus: prev.totalPollsToday > 400 ? 'LOW' : prev.totalPollsToday > 200 ? 'MODERATE' : 'OPTIMAL',
      }));
    } catch (err) {
      console.warn('[VAYU-OPS] Live polling exception:', err);
      setFeedStatus('OFFLINE');
    }
  }, [dataMode]);

  // Dynamic poll interval: 15s anonymous mode, slower if rate-limited
  useEffect(() => {
    if (dataMode === 'SIMULATED') return;

    // Trigger initial poll immediately when switching to LIVE or HYBRID
    pollLiveTraffic();

    const intervalMs = feedStatus === 'RATE_LIMITED' ? 30000 : 15000;
    const interval = setInterval(pollLiveTraffic, intervalMs);
    return () => clearInterval(interval);
  }, [dataMode, feedStatus, pollLiveTraffic]);

  // 7. Smooth 60fps Dead-Reckoning Position Interpolation between 15s polls
  useEffect(() => {
    if (dataMode === 'SIMULATED' || liveAircraft.length === 0) return;

    let animId: number;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      setLiveAircraft((prev) => {
        return prev.map((ac) => {
          if (ac.onGround || ac.speedKnots <= 10) return ac;

          // Dead reckoning vector: speed in knots to tactical pixels per second
          // 1 px ≈ 0.67 nm -> 1 nm = 1.49 px. Speed in kts = nm / hr
          const pxPerSecond = (ac.speedKnots * 1.49) / 3600;
          const rad = (ac.heading * Math.PI) / 180;
          const deltaX = Math.sin(rad) * pxPerSecond * dt;
          const deltaY = -Math.cos(rad) * pxPerSecond * dt; // Inverted Y in SVG coordinate space

          const newX = ac.x + deltaX;
          const newY = ac.y + deltaY;

          return {
            ...ac,
            x: newX,
            y: newY,
          };
        });
      });

      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [dataMode, liveAircraft.length > 0]);

  // 8. Fetch Weather for key operational sector
  useEffect(() => {
    if (dataMode === 'SIMULATED') return;
    providerRef.current.getWeather(26.2891, 73.0234).then((w) => {
      if (w) {
        setWeatherMap((prev) => ({ ...prev, 'Jodhpur AFS': w }));
      }
    });
  }, [dataMode]);

  // 9. Filtered Live Aircraft List
  const filteredLiveAircraft = useMemo(() => {
    if (dataMode === 'SIMULATED') return [];

    return liveAircraft.filter((ac) => {
      if (hideOnGround && ac.onGround) return false;

      if (altitudeBand === 'LOW' && ac.altitudeFt >= 15000) return false;
      if (altitudeBand === 'MID' && (ac.altitudeFt < 15000 || ac.altitudeFt > 28000)) return false;
      if (altitudeBand === 'HIGH' && ac.altitudeFt <= 28000) return false;

      return true;
    });
  }, [liveAircraft, dataMode, hideOnGround, altitudeBand]);

  // 10. Selected Live Aircraft Entity
  const selectedLiveAircraft = useMemo(() => {
    if (!selectedLiveAircraftId) return null;
    return liveAircraft.find((a) => a.icao24 === selectedLiveAircraftId) || null;
  }, [selectedLiveAircraftId, liveAircraft]);

  // 11. Civil Traffic Deconfliction Conflicts
  const civilConflicts: CivilConflict[] = useMemo(() => {
    if (dataMode === 'SIMULATED') return [];
    return detectCivilConflicts(liveAircraft, assignments, missions, aircraftList, getSimulatedState);
  }, [dataMode, liveAircraft, assignments, missions, aircraftList, getSimulatedState]);

  return {
    dataMode,
    setDataMode,
    liveAircraft: filteredLiveAircraft,
    allLiveAircraftCount: liveAircraft.length,
    feedStatus,
    secondsAgo,
    feedMeta,
    altitudeBand,
    setAltitudeBand,
    hideOnGround,
    setHideOnGround,
    selectedLiveAircraftId,
    setSelectedLiveAircraftId,
    selectedLiveAircraft,
    civilConflicts,
    weatherMap,
    triggerManualRefresh: pollLiveTraffic,
  };
}
