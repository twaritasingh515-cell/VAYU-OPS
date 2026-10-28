import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Airbase,
  Aircraft,
  AirspaceZone,
  Crew,
  Mission,
  MissionAssignment,
  ThreatMarker,
  ZoneWeather,
  OperationalAlert,
} from '../types/ops';
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
  Search,
  Plus,
  Minus,
  Maximize2,
  Minimize2,
  RotateCcw,
  Plane,
  ShieldAlert,
  Play,
  Pause,
  Layers,
  Fuel,
  Clock,
  X,
  Activity,
  TrendingUp,
  Compass,
  Radio,
  Database,
  CloudRain,
  AlertTriangle,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { TacticalMap3D } from './TacticalMap3D';
import { Tactical3DErrorBoundary } from './Tactical3DErrorBoundary';
import { DataSourcesModal } from './DataSourcesModal';

interface TacticalMapProps {
  bases: Airbase[];
  missions: Mission[];
  zones: AirspaceZone[];
  threats: ThreatMarker[];
  weather: ZoneWeather[];
  assignments: MissionAssignment[];
  aircraftList: Aircraft[];
  crews?: Crew[];
  alerts?: (string | OperationalAlert)[];
  selectedMissionId: string | null;
  onSelectMission: (id: string) => void;
  selectedAircraftId?: string | null;
  onSelectAircraft?: (id: string) => void;
  onOpenManualOverride?: () => void;
  // Layout & Focus integration
  isMapFocusMode?: boolean;
  onToggleMapFocus?: () => void;
  viewMode?: 'TIMELINE' | 'MAP';
  onViewModeChange?: (mode: 'TIMELINE' | 'MAP') => void;
  onOpenPredictiveDetails?: () => void;
  // Live Traffic integration
  dataMode: DataMode;
  onDataModeChange: (mode: DataMode) => void;
  liveAircraft: LiveAircraft[];
  allLiveCount: number;
  feedStatus: LiveFeedStatus;
  feedMeta: LiveFeedMeta;
  altitudeBand: AltitudeBand;
  onAltitudeBandChange: (band: AltitudeBand) => void;
  hideOnGround: boolean;
  onToggleHideOnGround: () => void;
  selectedLiveAircraftId: string | null;
  onSelectLiveAircraft: (icao24: string | null) => void;
  selectedLiveAircraft: LiveAircraft | null;
  civilConflicts: CivilConflict[];
  weatherMap: Record<string, LiveWeatherData>;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({
  bases,
  missions,
  zones,
  threats,
  weather: _weather,
  assignments,
  aircraftList,
  crews = [],
  alerts: _alerts = [],
  selectedMissionId,
  onSelectMission,
  selectedAircraftId: externalSelectedAircraftId,
  onSelectAircraft: externalOnSelectAircraft,
  onOpenManualOverride,
  isMapFocusMode = false,
  onToggleMapFocus,
  viewMode: _viewMode = 'MAP',
  onViewModeChange,
  onOpenPredictiveDetails,
  dataMode,
  onDataModeChange,
  liveAircraft,
  allLiveCount,
  feedStatus,
  feedMeta,
  altitudeBand,
  onAltitudeBandChange,
  hideOnGround,
  onToggleHideOnGround,
  selectedLiveAircraftId,
  onSelectLiveAircraft,
  selectedLiveAircraft,
  civilConflicts,
  weatherMap,
}) => {
  // Aircraft Selection
  const [internalSelectedAircraftId, setInternalSelectedAircraftId] = useState<string | null>(null);
  const selectedAircraftId = externalSelectedAircraftId !== undefined ? externalSelectedAircraftId : internalSelectedAircraftId;

  // View Dimension: 2D vs 3D (Defaults to 2D)
  const [mapDimension, setMapDimension] = useState<'2D' | '3D'>('2D');

  // Docked Telemetry Drawer state (Default: closed, docked on right, shrinks map)
  const [isTelemetryOpen, setIsTelemetryOpen] = useState<boolean>(false);

  // Tactical Legend Popover state (Default: closed, closes on click outside)
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(false);
  const legendRef = useRef<HTMLDivElement>(null);
  const legendBtnRef = useRef<HTMLButtonElement>(null);

  // Data Sources Popover state
  const [isDataSourcesModalOpen, setIsDataSourcesModalOpen] = useState<boolean>(false);

  // Live traffic layer visibility toggle in 2D
  const [showLiveTrafficLayer, setShowLiveTrafficLayer] = useState<boolean>(true);

  const setSelectedAircraftId = (id: string | null) => {
    setInternalSelectedAircraftId(id);
    if (!id) {
      setIsTelemetryOpen(false);
    }
    if (id && externalOnSelectAircraft) {
      externalOnSelectAircraft(id);
    }
  };

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ON_MISSION' | 'AVAILABLE' | 'ALERT'>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Pan & Zoom states (2D)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // ResizeObserver for Container Dimensions
  const [containerSize, setContainerSize] = useState({ width: 900, height: 600 });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Responsive Dynamic ViewBox
  const tacticalCenter = { x: 330, y: 275 };
  const baseTacticalHeight = 520;
  const aspect = containerSize.width / Math.max(containerSize.height, 1);
  const viewBoxHeight = baseTacticalHeight;
  const viewBoxWidth = Math.max(640, baseTacticalHeight * aspect);
  const viewBoxX = tacticalCenter.x - viewBoxWidth / 2;
  const viewBoxY = tacticalCenter.y - viewBoxHeight / 2;

  // Legend popover click-outside dismissal
  useEffect(() => {
    if (!isLegendOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        legendRef.current &&
        !legendRef.current.contains(e.target as Node) &&
        legendBtnRef.current &&
        !legendBtnRef.current.contains(e.target as Node)
      ) {
        setIsLegendOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isLegendOpen]);

  // -------------------------------------------------------------
  // SIMULATION ENGINE (Deterministic 60fps movement)
  // -------------------------------------------------------------
  const [simState, setSimState] = useState<'PLAYING' | 'PAUSED'>('PLAYING');
  const [simProgress, setSimProgress] = useState<number>(0.38); // 0.0 to 1.0 (06:00 to 18:00 UTC)
  const [simSpeed, setSimSpeed] = useState<1 | 2 | 5>(1);

  useEffect(() => {
    if (simState !== 'PLAYING') return;
    let animId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const progressInc = (dt / 90) * simSpeed;
      setSimProgress((prev) => (prev + progressInc) % 1.0);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [simState, simSpeed]);

  const simMinutes = 360 + simProgress * 720;
  const simHours = Math.floor(simMinutes / 60);
  const simMins = Math.floor(simMinutes % 60);
  const simTimeDisplay = `${String(simHours).padStart(2, '0')}:${String(simMins).padStart(2, '0')} UTC`;

  // Dynamic Fleet Counts
  const onMissionAircraftIds = useMemo(() => {
    return new Set(
      assignments.filter((a) => a.aircraftId && a.missionId).map((a) => a.aircraftId!)
    );
  }, [assignments]);

  const onMissionCount = onMissionAircraftIds.size;
  const availableCount = aircraftList.filter(
    (a) => a.status === 'Serviceable' && !onMissionAircraftIds.has(a.id)
  ).length;
  const alertCount =
    aircraftList.filter((a) => a.status !== 'Serviceable').length +
    threats.length +
    civilConflicts.length;

  // Selected aircraft entity
  const selectedAircraft = useMemo(() => {
    if (!selectedAircraftId) return null;
    return aircraftList.find((a) => a.id === selectedAircraftId) || null;
  }, [selectedAircraftId, aircraftList]);

  const selectedAssignment = useMemo(() => {
    if (!selectedAircraft) return null;
    return assignments.find((a) => a.aircraftId === selectedAircraft.id) || null;
  }, [selectedAircraft, assignments]);

  const selectedMission = useMemo(() => {
    if (selectedAssignment) {
      return missions.find((m) => m.id === selectedAssignment.missionId) || null;
    }
    if (selectedMissionId) {
      return missions.find((m) => m.id === selectedMissionId) || null;
    }
    return missions[0] || null;
  }, [selectedAssignment, selectedMissionId, missions]);

  const selectedCrew = useMemo(() => {
    if (!selectedAssignment?.crewId) return null;
    return crews.find((c) => c.id === selectedAssignment.crewId) || null;
  }, [selectedAssignment, crews]);

  // Synchronize when selectedMissionId changes externally
  useEffect(() => {
    if (selectedMissionId) {
      const asgn = assignments.find((a) => a.missionId === selectedMissionId);
      if (asgn?.aircraftId && asgn.aircraftId !== selectedAircraftId) {
        setInternalSelectedAircraftId(asgn.aircraftId);
      }
    }
  }, [selectedMissionId, assignments]);

  // Filtered military aircraft list
  const filteredAircraft = useMemo(() => {
    return aircraftList.filter((ac) => {
      const asgn = assignments.find((a) => a.aircraftId === ac.id);
      const mission = asgn ? missions.find((m) => m.id === asgn.missionId) : null;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = ac.id.toLowerCase().includes(q);
        const matchesCallsign = ac.callsign.toLowerCase().includes(q);
        const matchesModel = ac.model.toLowerCase().includes(q);
        const matchesRole = ac.role.toLowerCase().includes(q);
        const matchesMission = mission
          ? mission.id.toLowerCase().includes(q) || mission.codeName.toLowerCase().includes(q)
          : false;

        if (!matchesId && !matchesCallsign && !matchesModel && !matchesRole && !matchesMission) {
          return false;
        }
      }

      const isOnMission = onMissionAircraftIds.has(ac.id);
      if (statusFilter === 'ON_MISSION' && !isOnMission) return false;
      if (statusFilter === 'AVAILABLE' && (isOnMission || ac.status !== 'Serviceable')) return false;
      if (statusFilter === 'ALERT' && ac.status === 'Serviceable') return false;

      if (roleFilter !== 'ALL' && ac.role !== roleFilter) return false;

      return true;
    });
  }, [aircraftList, searchQuery, statusFilter, roleFilter, onMissionAircraftIds, assignments, missions]);

  // Filtered live civil aircraft list
  const filteredLiveTraffic = useMemo(() => {
    if (dataMode === 'SIMULATED' || !showLiveTrafficLayer) return [];

    return liveAircraft.filter((civ) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (
          !civ.callsign.toLowerCase().includes(q) &&
          !civ.icao24.toLowerCase().includes(q) &&
          !civ.originCountry.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [liveAircraft, dataMode, showLiveTrafficLayer, searchQuery]);

  // Mouse pan drag handlers (2D)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom and view reset controls (2D)
  const handleZoomIn = () => setZoom((z) => Math.min(2.5, +(z + 0.2).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(2)));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const focusOnCoordinates = (x: number, y: number) => {
    setZoom(1.4);
    setPan({
      x: (tacticalCenter.x - x) * 1.4,
      y: (tacticalCenter.y - y) * 1.4,
    });
  };

  // -------------------------------------------------------------
  // SIMULATION POSITION & TELEMETRY CALCULATOR
  // -------------------------------------------------------------
  const getSimulatedAircraftState = (ac: Aircraft) => {
    const asgn = assignments.find((a) => a.aircraftId === ac.id);
    const mission = asgn ? missions.find((m) => m.id === asgn.missionId) : null;
    const base = bases.find((b) => b.id === ac.baseId) || bases[0] || { coordinates: { x: 220, y: 350 } };

    if (ac.status === 'AOG' || ac.status === 'Maintenance') {
      const hangarOffsetX = ((parseInt(ac.id.replace(/\D/g, '') || '1', 10) * 14) % 40) - 20;
      const hangarOffsetY = 24;
      return {
        x: base.coordinates.x + hangarOffsetX,
        y: base.coordinates.y + hangarOffsetY,
        heading: 90,
        status: ac.status === 'AOG' ? 'AOG' : 'MAINTENANCE',
        statusLabel: ac.status === 'AOG' ? 'AOG (GROUNDED)' : 'MAINTENANCE INSPECTION',
        altitudeFt: 0,
        speedKts: 0,
        mach: 0,
        fuelPercent: 45,
        missionProgress: 0,
        eta: 'GROUND HOLD',
        ingressWaypoint: null,
        egressWaypoint: null,
      };
    }

    if (!mission) {
      const index = parseInt(ac.id.replace(/\D/g, '') || '1', 10);
      const apronOffsetX = ((index % 4) - 1.5) * 18;
      const apronOffsetY = (Math.floor(index / 4) - 0.5) * 18;
      return {
        x: base.coordinates.x + apronOffsetX,
        y: base.coordinates.y + apronOffsetY,
        heading: 45,
        status: 'AVAILABLE',
        statusLabel: 'SERVICEABLE (STANDBY RESERVE)',
        altitudeFt: 0,
        speedKts: 0,
        mach: 0,
        fuelPercent: 100,
        missionProgress: 0,
        eta: 'STANDBY',
        ingressWaypoint: null,
        egressWaypoint: null,
      };
    }

    const targetX = mission.targetLocation.coords.x;
    const targetY = mission.targetLocation.coords.y;

    const ingressX = base.coordinates.x + (targetX - base.coordinates.x) * 0.52 + 15;
    const ingressY = base.coordinates.y + (targetY - base.coordinates.y) * 0.52 - 25;
    const ingressWaypoint = { x: Math.round(ingressX), y: Math.round(ingressY), name: `IP-${mission.id}` };

    const egressX = base.coordinates.x + (targetX - base.coordinates.x) * 0.65 - 15;
    const egressY = base.coordinates.y + (targetY - base.coordinates.y) * 0.65 + 25;
    const egressWaypoint = { x: Math.round(egressX), y: Math.round(egressY), name: `EP-${mission.id}` };

    const parseTimeMinutes = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      return (h || 8) * 60 + (m || 0);
    };

    const startMins = parseTimeMinutes(mission.timeWindowStart);
    const endMins = parseTimeMinutes(mission.timeWindowEnd);
    const startP = Math.max(0, (startMins - 360) / 720);
    const endP = Math.min(1, (endMins - 360) / 720);
    const durP = Math.max(0.12, endP - startP);

    if (simProgress < startP) {
      return {
        x: base.coordinates.x - 12,
        y: base.coordinates.y + 12,
        heading: 45,
        status: 'STANDBY',
        statusLabel: `PRE-FLIGHT (SORTIE AT ${mission.timeWindowStart})`,
        altitudeFt: 0,
        speedKts: 0,
        mach: 0,
        fuelPercent: 100,
        missionProgress: 0,
        eta: `${mission.timeWindowStart} UTC (LAUNCH)`,
        ingressWaypoint,
        egressWaypoint,
      };
    }

    if (simProgress > endP) {
      return {
        x: base.coordinates.x + 12,
        y: base.coordinates.y - 12,
        heading: 45,
        status: 'AVAILABLE',
        statusLabel: 'SORTIE COMPLETED (POST-FLIGHT TURNAROUND)',
        altitudeFt: 0,
        speedKts: 0,
        mach: 0,
        fuelPercent: 54,
        missionProgress: 100,
        eta: 'LANDED',
        ingressWaypoint,
        egressWaypoint,
      };
    }

    const t = Math.max(0, Math.min(1, (simProgress - startP) / durP));
    let curX: number;
    let curY: number;
    let heading: number;
    let status = 'ON_MISSION';
    let statusLabel = 'ON MISSION (COMBAT SORTIE)';
    let altitudeFt = 32000;
    let speedKts = 540;
    let mach = 0.88;
    const fuelPercent = Math.max(22, Math.round(98 - t * 45));

    if (t < 0.42) {
      status = 'EN_ROUTE';
      statusLabel = 'EN-ROUTE (INGRESS VECTOR)';
      const p = t / 0.42;
      altitudeFt = Math.round(p * 32400);
      speedKts = Math.round(250 + p * 290);
      mach = +(speedKts / 660).toFixed(2);

      if (p < 0.5) {
        const sub = p / 0.5;
        curX = base.coordinates.x + (ingressX - base.coordinates.x) * sub;
        curY = base.coordinates.y + (ingressY - base.coordinates.y) * sub;
        heading = (Math.atan2(ingressY - base.coordinates.y, ingressX - base.coordinates.x) * 180) / Math.PI + 90;
      } else {
        const sub = (p - 0.5) / 0.5;
        curX = ingressX + (targetX - ingressX) * sub;
        curY = ingressY + (targetY - ingressY) * sub;
        heading = (Math.atan2(targetY - ingressY, targetX - ingressX) * 180) / Math.PI + 90;
      }
    } else if (t < 0.65) {
      status = 'ON_MISSION';
      statusLabel = 'ON MISSION (TARGET ENGAGEMENT)';
      const p = (t - 0.42) / 0.23;
      curX = targetX + Math.cos(p * Math.PI * 2) * 16;
      curY = targetY + Math.sin(p * Math.PI * 2) * 12;
      heading = (p * 360 + 90) % 360;
      altitudeFt = 28500;
      speedKts = 560;
      mach = 0.92;
    } else {
      status = 'RETURNING';
      statusLabel = 'RETURNING (RTB DESCENT)';
      const p = (t - 0.65) / 0.35;
      altitudeFt = Math.max(0, Math.round((1 - p) * 28500));
      speedKts = Math.round(560 - p * 340);
      mach = +(speedKts / 660).toFixed(2);

      if (p < 0.5) {
        const sub = p / 0.5;
        curX = targetX + (egressX - targetX) * sub;
        curY = targetY + (egressY - targetY) * sub;
        heading = (Math.atan2(egressY - targetY, egressX - targetX) * 180) / Math.PI + 90;
      } else {
        const sub = (p - 0.5) / 0.5;
        curX = egressX + (base.coordinates.x - egressX) * sub;
        curY = egressY + (base.coordinates.y - egressY) * sub;
        heading = (Math.atan2(base.coordinates.y - egressY, base.coordinates.x - egressX) * 180) / Math.PI + 90;
      }
    }

    return {
      x: Math.round(curX),
      y: Math.round(curY),
      heading: Math.round((heading + 360) % 360),
      status,
      statusLabel,
      altitudeFt,
      speedKts,
      mach,
      fuelPercent,
      missionProgress: Math.round(t * 100),
      eta: `${mission.timeWindowEnd} UTC`,
      ingressWaypoint,
      egressWaypoint,
    };
  };

  const selectedSimState = selectedAircraft ? getSimulatedAircraftState(selectedAircraft) : null;

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-[#0F1419] select-none overflow-hidden relative font-sans">
      {/* 1. SLIM UNIFIED TOP TOOLBAR (~48px height, static in flex flow) */}
      <header className="h-12 bg-[#161C24] border-b border-[#2A3340] px-3 shrink-0 flex items-center overflow-x-auto no-scrollbar gap-2 z-30">
        {/* View Switcher: Timeline vs Tracking */}
        {onViewModeChange && (
          <div className="flex items-center bg-[#0F1419] p-0.5 rounded-md border border-[#2A3340] shrink-0 text-xs">
            <button
              onClick={() => onViewModeChange('TIMELINE')}
              className="px-2.5 py-1 rounded text-[#657183] hover:text-[#9AA5B4] font-medium flex items-center space-x-1 cursor-pointer transition"
              title="Switch to timeline runway view"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Timeline</span>
            </button>
            <button
              onClick={() => onViewModeChange('MAP')}
              className="px-2.5 py-1 rounded bg-[#1D2530] text-[#E8ECF1] font-medium flex items-center space-x-1.5 cursor-pointer shadow-xs"
              title="Active: Aircraft tracking tactical view"
            >
              <span className="w-2 h-2 rounded-full bg-[#3FB27F]" />
              <span>Tracking</span>
            </button>
          </div>
        )}

        {/* 1. DATA MODE SWITCHER: Simulated | Live traffic | Hybrid (Requirement 1) */}
        <div className="flex items-center bg-[#0F1419] p-0.5 rounded-md border border-[#2A3340] shrink-0 text-xs font-mono">
          <button
            onClick={() => onDataModeChange('SIMULATED')}
            className={`px-2 py-0.5 rounded transition cursor-pointer text-[11px] font-semibold ${
              dataMode === 'SIMULATED'
                ? 'bg-[#1D2530] text-[#E8ECF1] shadow-xs'
                : 'text-[#657183] hover:text-[#9AA5B4]'
            }`}
            title="Simulated military tasking fleet"
          >
            Simulated
          </button>
          <button
            onClick={() => onDataModeChange('LIVE')}
            className={`px-2 py-0.5 rounded transition cursor-pointer text-[11px] font-semibold flex items-center space-x-1 ${
              dataMode === 'LIVE'
                ? 'bg-[#4C8DF6] text-white shadow-xs'
                : 'text-[#657183] hover:text-[#9AA5B4]'
            }`}
            title="Live OpenSky ADS-B civil airspace traffic only"
          >
            <Radio className="w-3 h-3" />
            <span>Live traffic</span>
          </button>
          <button
            onClick={() => onDataModeChange('HYBRID')}
            className={`px-2 py-0.5 rounded transition cursor-pointer text-[11px] font-semibold flex items-center space-x-1 ${
              dataMode === 'HYBRID'
                ? 'bg-[#3FB27F] text-white shadow-xs'
                : 'text-[#657183] hover:text-[#9AA5B4]'
            }`}
            title="Hybrid: Military fleet plus live civil traffic layer"
          >
            <span>Hybrid</span>
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          </button>
        </div>

        {/* Real Feed State Chip with last updated timestamp (Requirement 1) */}
        {dataMode !== 'SIMULATED' && (
          <button
            onClick={() => setIsDataSourcesModalOpen(true)}
            className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-[#0F1419] hover:bg-[#1D2530] border border-[#2A3340] text-[11px] font-mono shrink-0 cursor-pointer transition"
            title="Inspect ADS-B data feed and attribution"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                feedStatus === 'CONNECTED'
                  ? 'bg-[#3FB27F]'
                  : feedStatus === 'RATE_LIMITED'
                  ? 'bg-[#E0A33A]'
                  : 'bg-[#E5554F]'
              }`}
            />
            <span className="font-semibold text-[#E8ECF1]">
              {feedStatus === 'CONNECTED'
                ? 'Connected'
                : feedStatus === 'RATE_LIMITED'
                ? 'Rate-limited'
                : feedStatus === 'DELAYED'
                ? 'Delayed'
                : 'Offline'}
            </span>
            <span className="text-[#657183]">({feedMeta.secondsSinceLastUpdate}s ago)</span>
          </button>
        )}

        <div className="h-4 w-px bg-[#2A3340] shrink-0" />

        {/* Fleet Filter Chips (When military fleet is visible) */}
        {dataMode !== 'LIVE' && (
          <div className="flex items-center space-x-1 text-xs shrink-0">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition cursor-pointer flex items-center space-x-1.5 border ${
                statusFilter === 'ALL'
                  ? 'bg-[#1D2530] text-[#E8ECF1] border-[#4C8DF6]'
                  : 'bg-[#0F1419] text-[#9AA5B4] border-[#2A3340] hover:text-[#E8ECF1]'
              }`}
            >
              <span>Mil</span>
              <span className="font-mono font-bold text-[#E8ECF1] bg-[#161C24] px-1 rounded text-[10px]">
                {aircraftList.length}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter(statusFilter === 'ON_MISSION' ? 'ALL' : 'ON_MISSION')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition cursor-pointer flex items-center space-x-1.5 border ${
                statusFilter === 'ON_MISSION'
                  ? 'bg-[#4C8DF6]/15 text-[#4C8DF6] border-[#4C8DF6]'
                  : 'bg-[#0F1419] text-[#9AA5B4] border-[#2A3340] hover:text-[#E8ECF1]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#4C8DF6] animate-pulse" />
              <span>Sorties</span>
              <span className="font-mono font-bold px-1 rounded text-[10px] bg-[#161C24]">
                {onMissionCount}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter(statusFilter === 'ALERT' ? 'ALL' : 'ALERT')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition cursor-pointer flex items-center space-x-1.5 border ${
                statusFilter === 'ALERT'
                  ? 'bg-[#E5554F]/15 text-[#E5554F] border-[#E5554F]'
                  : 'bg-[#0F1419] text-[#9AA5B4] border-[#2A3340] hover:text-[#E8ECF1]'
              }`}
            >
              <ShieldAlert className="w-3 h-3 text-[#E5554F]" />
              <span>Alerts</span>
              <span className="font-mono font-bold px-1 rounded text-[10px] bg-[#E5554F]/20 text-[#E5554F]">
                {alertCount}
              </span>
            </button>
          </div>
        )}

        {/* Live Traffic Filters (When Live or Hybrid active) */}
        {dataMode !== 'SIMULATED' && (
          <div className="flex items-center space-x-1.5 text-xs shrink-0">
            <span className="text-[#657183] text-[10px] font-mono uppercase">Live Band:</span>
            <select
              value={altitudeBand}
              onChange={(e) => onAltitudeBandChange(e.target.value as AltitudeBand)}
              className="bg-[#0F1419] border border-[#2A3340] rounded text-[11px] text-[#CBD5E1] px-1.5 py-0.5 focus:outline-none focus:border-[#4C8DF6] cursor-pointer"
            >
              <option value="ALL">All Altitudes ({allLiveCount})</option>
              <option value="LOW">Low (&lt;FL150)</option>
              <option value="MID">Mid (FL150-280)</option>
              <option value="HIGH">High (&gt;FL280)</option>
            </select>

            <button
              onClick={onToggleHideOnGround}
              className={`px-1.5 py-0.5 rounded border text-[10px] font-mono transition cursor-pointer ${
                hideOnGround
                  ? 'bg-[#1D2530] text-[#9AA5B4] border-[#2A3340]'
                  : 'bg-[#4C8DF6]/20 text-[#4C8DF6] border-[#4C8DF6]'
              }`}
              title="Toggle display of stationary aircraft on ground"
            >
              {hideOnGround ? 'GND Hidden' : 'GND Visible'}
            </button>
          </div>
        )}

        <div className="h-4 w-px bg-[#2A3340] shrink-0" />

        {/* Search */}
        <div className="relative w-32 sm:w-40 shrink-0">
          <Search className="w-3 h-3 text-[#657183] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={dataMode === 'SIMULATED' ? 'Search A2, M-101...' : 'Search AIC402, A2...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-5 py-0.5 bg-[#0F1419] border border-[#2A3340] rounded text-[11px] text-[#E8ECF1] placeholder-[#657183] focus:outline-none focus:border-[#4C8DF6]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#657183] hover:text-[#E8ECF1] p-0.5 cursor-pointer"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>

        {/* Playback Controls (Simulated time) */}
        <div className="flex items-center space-x-1.5 shrink-0 text-xs">
          <button
            onClick={() => setSimState(simState === 'PLAYING' ? 'PAUSED' : 'PLAYING')}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#4C8DF6] hover:bg-[#3B7DE8] text-white font-medium text-xs transition cursor-pointer"
            title={simState === 'PLAYING' ? 'Pause movement simulation' : 'Resume simulation'}
          >
            {simState === 'PLAYING' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>

          <button
            onClick={() => setSimProgress(0)}
            className="p-1 rounded bg-[#0F1419] hover:bg-[#1D2530] text-[#9AA5B4] hover:text-[#E8ECF1] border border-[#2A3340] transition cursor-pointer"
            title="Reset simulation to 06:00 UTC"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          <div className="flex items-center space-x-1 text-[#E8ECF1] font-mono text-[11px] font-semibold bg-[#0F1419] px-2 py-0.5 rounded border border-[#2A3340]">
            <Clock className="w-3 h-3 text-[#4C8DF6]" />
            <span>{simTimeDisplay}</span>
          </div>
        </div>

        <div className="flex-1 min-w-[4px]" />

        {/* 2D | 3D SEGMENTED TOGGLE */}
        <div className="flex items-center bg-[#0F1419] p-0.5 rounded border border-[#2A3340] text-xs shrink-0">
          <button
            onClick={() => setMapDimension('2D')}
            className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] transition cursor-pointer ${
              mapDimension === '2D'
                ? 'bg-[#1D2530] text-[#E8ECF1] shadow-xs'
                : 'text-[#657183] hover:text-[#9AA5B4]'
            }`}
            title="2D Tactical Airspace Map"
          >
            2D
          </button>
          <button
            onClick={() => setMapDimension('3D')}
            className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] transition cursor-pointer flex items-center space-x-1 ${
              mapDimension === '3D'
                ? 'bg-[#4C8DF6] text-white shadow-xs'
                : 'text-[#657183] hover:text-[#9AA5B4]'
            }`}
            title="3D Tactical Airspace Engine (WebGL)"
          >
            <span>3D</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#3FB27F]" />
          </button>
        </div>

        {/* Right Tools: Data Sources, Legend, Telemetry, Focus */}
        <div className="flex items-center space-x-1.5 shrink-0 relative">
          <button
            onClick={() => setIsDataSourcesModalOpen(true)}
            className="px-2 py-1 rounded border border-[#2A3340] bg-[#0F1419] text-[#9AA5B4] hover:text-[#E8ECF1] text-xs cursor-pointer transition flex items-center space-x-1"
            title="Data Sources and Attribution"
          >
            <Database className="w-3 h-3 text-[#4C8DF6]" />
            <span className="hidden xl:inline">Data Sources</span>
          </button>

          <button
            ref={legendBtnRef}
            onClick={() => setIsLegendOpen(!isLegendOpen)}
            className={`px-2 py-1 rounded border text-xs cursor-pointer transition flex items-center space-x-1 ${
              isLegendOpen
                ? 'bg-[#4C8DF6] text-white border-[#4C8DF6]'
                : 'bg-[#0F1419] text-[#9AA5B4] border-[#2A3340] hover:text-[#E8ECF1]'
            }`}
            title="Toggle Tactical Airspace Legend"
          >
            <Layers className="w-3 h-3" />
            <span className="hidden sm:inline">Legend</span>
          </button>

          {(selectedAircraft || selectedLiveAircraft) && (
            <button
              onClick={() => setIsTelemetryOpen(!isTelemetryOpen)}
              className={`px-2 py-1 rounded border text-xs cursor-pointer transition flex items-center space-x-1 font-medium ${
                isTelemetryOpen
                  ? 'bg-[#4C8DF6] text-white border-[#4C8DF6]'
                  : 'bg-[#0F1419] text-[#9AA5B4] border-[#2A3340] hover:text-[#E8ECF1]'
              }`}
              title="Toggle Aircraft Telemetry Side Drawer"
            >
              <Activity className="w-3 h-3 text-[#3FB27F]" />
              <span>
                Telemetry ({selectedLiveAircraft ? selectedLiveAircraft.callsign : selectedAircraft?.id})
              </span>
            </button>
          )}

          {onToggleMapFocus && (
            <button
              onClick={onToggleMapFocus}
              className={`px-2 py-1 rounded border text-xs cursor-pointer transition flex items-center space-x-1 font-medium ${
                isMapFocusMode
                  ? 'bg-[#4C8DF6] text-white border-[#4C8DF6]'
                  : 'bg-[#0F1419] text-[#9AA5B4] border-[#2A3340] hover:text-[#E8ECF1]'
              }`}
              title={isMapFocusMode ? 'Exit Map Focus Mode (Esc)' : 'Expand Map Focus Mode (hide sidebars)'}
            >
              {isMapFocusMode ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              <span className="hidden md:inline">{isMapFocusMode ? 'Exit Focus' : 'Focus Map'}</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. MAIN MAP VIEWPORT & DOCKED TELEMETRY DRAWER */}
      <div className="flex-1 flex flex-row min-h-0 w-full h-full relative overflow-hidden">
        {mapDimension === '2D' ? (
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`flex-1 min-w-0 h-full relative overflow-hidden bg-[#0F1419] cursor-${isDragging ? 'grabbing' : 'grab'}`}
          >
            <svg
              viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
              className="w-full h-full block pointer-events-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 100ms ease-out',
              }}
            >
              <defs>
                <pattern id="tacticalGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(42, 51, 64, 0.45)" strokeWidth="0.5" />
                </pattern>
              </defs>

              <rect
                x={viewBoxX - 1000}
                y={viewBoxY - 1000}
                width={viewBoxWidth + 2000}
                height={viewBoxHeight + 2000}
                fill="url(#tacticalGrid)"
              />

              {/* Airspace Zones */}
              {zones.map((zone) => {
                const pointsStr = zone.polygonCoords.map((p) => `${p.x},${p.y}`).join(' ');
                const isContested = zone.corridorStatus === 'Contested';
                return (
                  <g key={zone.id} className="pointer-events-auto">
                    <polygon
                      points={pointsStr}
                      fill={isContested ? 'rgba(229, 85, 79, 0.06)' : 'rgba(76, 141, 246, 0.05)'}
                      stroke={isContested ? 'rgba(229, 85, 79, 0.4)' : 'rgba(76, 141, 246, 0.3)'}
                      strokeWidth="1.2"
                      strokeDasharray={isContested ? '5,3' : undefined}
                    />
                    <g transform={`translate(${zone.polygonCoords[0]?.x + 8}, ${zone.polygonCoords[0]?.y + 14}) scale(${1 / zoom})`}>
                      <text x="0" y="0" fill="#8B98A9" fontSize="11" fontFamily="sans-serif" fontWeight="600">
                        {zone.name}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Threat Zones */}
              {threats.map((th) => (
                <g key={th.id} className="pointer-events-auto">
                  <circle
                    cx={th.coords.x}
                    cy={th.coords.y}
                    r={th.rangeKm}
                    fill="rgba(229, 85, 79, 0.07)"
                    stroke="rgba(229, 85, 79, 0.5)"
                    strokeWidth="0.8"
                  />
                  <circle cx={th.coords.x} cy={th.coords.y} r="4" fill="#E5554F" />
                  <g transform={`translate(${th.coords.x + 8}, ${th.coords.y - 10}) scale(${1 / zoom})`}>
                    <rect
                      x="0"
                      y="0"
                      width={th.type.length * 6.5 + 46}
                      height="18"
                      rx="3"
                      fill="#161C24"
                      stroke="rgba(229, 85, 79, 0.6)"
                      strokeWidth="1"
                    />
                    <text x="5" y="13" fill="#E5554F" fontSize="11" fontFamily="sans-serif" fontWeight="700">
                      {th.type} ({th.rangeKm}km)
                    </text>
                  </g>
                </g>
              ))}

              {/* Military Flight Routes */}
              {missions.map((m) => {
                const asgn = assignments.find((a) => a.missionId === m.id);
                if (!asgn || !asgn.aircraftId) return null;
                const ac = aircraftList.find((a) => a.id === asgn.aircraftId);
                if (!ac) return null;
                const base = bases.find((b) => b.id === ac.baseId) || bases[0];
                const isSelected = selectedMissionId === m.id || selectedAircraftId === ac.id;

                const midX = base.coordinates.x + (m.targetLocation.coords.x - base.coordinates.x) * 0.52 + 15;
                const midY = base.coordinates.y + (m.targetLocation.coords.y - base.coordinates.y) * 0.52 - 25;

                return (
                  <g key={`route-${m.id}`} className="pointer-events-auto">
                    <path
                      d={`M ${base.coordinates.x} ${base.coordinates.y} Q ${midX} ${midY} ${m.targetLocation.coords.x} ${m.targetLocation.coords.y}`}
                      fill="none"
                      stroke={isSelected ? '#4C8DF6' : 'rgba(76, 141, 246, 0.35)'}
                      strokeWidth={isSelected ? 2.2 : 1.2}
                      strokeDasharray={isSelected ? '6,3' : '3,3'}
                    />
                    <polygon
                      points={`${midX},${midY - 4} ${midX + 4},${midY} ${midX},${midY + 4} ${midX - 4},${midY}`}
                      fill={isSelected ? '#4C8DF6' : '#2A3340'}
                      stroke="#4C8DF6"
                      strokeWidth="1"
                    />
                  </g>
                );
              })}

              {/* Civil Traffic Conflict Lines */}
              {civilConflicts.map((conf) => (
                <g key={`conf-${conf.id}`} className="pointer-events-auto">
                  <line
                    x1={conf.civilX}
                    y1={conf.civilY}
                    x2={conf.civilX + 15}
                    y2={conf.civilY - 15}
                    stroke="#E0A33A"
                    strokeWidth="1.5"
                    strokeDasharray="4,2"
                  />
                  <g transform={`translate(${conf.civilX + 18}, ${conf.civilY - 24}) scale(${1 / zoom})`}>
                    <rect x="0" y="0" width="130" height="18" rx="3" fill="#161C24" stroke="#E0A33A" strokeWidth="1" />
                    <text x="5" y="13" fill="#E0A33A" fontSize="10" fontFamily="sans-serif" fontWeight="bold">
                      ⚠ CIVIL CONFLICT ({conf.lateralDistanceNm}nm)
                    </text>
                  </g>
                </g>
              ))}

              {/* Airbases */}
              {bases.map((base) => (
                <g
                  key={base.id}
                  transform={`translate(${base.coordinates.x}, ${base.coordinates.y})`}
                  className="pointer-events-auto cursor-pointer"
                >
                  <circle cx="0" cy="0" r="8" fill="#161C24" stroke="#4C8DF6" strokeWidth="1.6" />
                  <circle cx="0" cy="0" r="3.5" fill="#4C8DF6" />
                  <g transform={`translate(-22, 10) scale(${1 / zoom})`}>
                    <rect x="0" y="0" width="44" height="17" rx="3" fill="#161C24" stroke="#2A3340" />
                    <text x="22" y="12" textAnchor="middle" fill="#E8ECF1" fontSize="11" fontFamily="sans-serif" fontWeight="700">
                      {base.code}
                    </text>
                  </g>
                </g>
              ))}

              {/* Mission Targets */}
              {missions.map((m) => {
                const isSelected = selectedMissionId === m.id;
                const dotColor = m.priority === 'P1' ? '#E5554F' : m.priority === 'P2' ? '#E0A33A' : '#4C8DF6';

                return (
                  <g
                    key={m.id}
                    transform={`translate(${m.targetLocation.coords.x}, ${m.targetLocation.coords.y})`}
                    onClick={() => onSelectMission(m.id)}
                    className="pointer-events-auto cursor-pointer"
                  >
                    <circle cx="0" cy="0" r={isSelected ? 9 : 6} fill={dotColor} stroke="#161C24" strokeWidth="2" />
                    {isSelected && (
                      <circle cx="0" cy="0" r="16" fill="none" stroke={dotColor} strokeWidth="1.2" strokeDasharray="3,3" />
                    )}
                    <g transform={`translate(10, -9) scale(${1 / zoom})`}>
                      <rect x="0" y="0" width="70" height="18" rx="3" fill="#161C24" stroke="#2A3340" />
                      <text x="5" y="13" fill="#E8ECF1" fontSize="11" fontFamily="sans-serif" fontWeight="700">
                        {m.id} <tspan fill={dotColor}>{m.priority}</tspan>
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* 1. MILITARY FLEET AIRCRAFT (Shown in SIMULATED or HYBRID mode) */}
              {dataMode !== 'LIVE' &&
                filteredAircraft.map((ac) => {
                  const sim = getSimulatedAircraftState(ac);
                  const isSelected = selectedAircraftId === ac.id && !selectedLiveAircraftId;
                  const isOnMission = sim.status === 'ON_MISSION' || sim.status === 'EN_ROUTE';
                  const isReturning = sim.status === 'RETURNING';
                  const isAog = sim.status === 'AOG';
                  const isMaint = sim.status === 'MAINTENANCE';

                  const symbolColor = isOnMission
                    ? '#4C8DF6'
                    : isReturning
                    ? '#A855F7'
                    : isAog
                    ? '#E5554F'
                    : isMaint
                    ? '#E0A33A'
                    : '#3FB27F';

                  return (
                    <g
                      key={`mil-${ac.id}`}
                      transform={`translate(${sim.x}, ${sim.y})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLiveAircraft(null);
                        setSelectedAircraftId(ac.id);
                        setIsTelemetryOpen(true);
                        const asgn = assignments.find((a) => a.aircraftId === ac.id);
                        if (asgn?.missionId) {
                          onSelectMission(asgn.missionId);
                        }
                      }}
                      className="pointer-events-auto cursor-pointer group"
                    >
                      {(isOnMission || isReturning) && (
                        <circle
                          cx="0"
                          cy="0"
                          r={isSelected ? 18 : 14}
                          fill="none"
                          stroke={symbolColor}
                          strokeWidth="1.2"
                          opacity="0.6"
                          className="animate-ping"
                        />
                      )}

                      {isSelected && (
                        <circle cx="0" cy="0" r="20" fill="none" stroke="#4C8DF6" strokeWidth="1.8" strokeDasharray="4,2" />
                      )}

                      <g transform={`rotate(${sim.heading})`}>
                        <path
                          d="M 0 -13 L 5 -3 L 10 4 L 5 4 L 2.5 8 L 0 7 L -2.5 8 L -5 4 L -10 4 L -5 -3 Z"
                          fill={symbolColor}
                          stroke="#161C24"
                          strokeWidth="1.2"
                        />
                      </g>

                      {/* Tactical Tag: [SIM] */}
                      <g transform={`translate(12, -14) scale(${1 / zoom})`}>
                        <rect
                          x="0"
                          y="0"
                          width={isOnMission ? 96 : isReturning ? 88 : 76}
                          height="20"
                          rx="4"
                          fill="#161C24"
                          stroke={isSelected ? '#4C8DF6' : '#2A3340'}
                          strokeWidth={isSelected ? 1.8 : 1}
                        />
                        <text x="6" y="14" fill="#E8ECF1" fontSize="11" fontFamily="monospace" fontWeight="700">
                          {ac.id}
                        </text>
                        <text x="32" y="14" fill={symbolColor} fontSize="10" fontFamily="sans-serif" fontWeight="700">
                          {isOnMission ? 'SORTIE' : isReturning ? 'RTB' : isAog ? 'AOG' : 'READY'}
                        </text>
                        <text x={isOnMission ? 76 : isReturning ? 68 : 58} y="14" fill="#657183" fontSize="8" fontFamily="monospace">
                          [SIM]
                        </text>
                      </g>
                    </g>
                  );
                })}

              {/* 2. LIVE CIVIL ADS-B TRAFFIC (Shown in LIVE or HYBRID mode) */}
              {dataMode !== 'SIMULATED' &&
                filteredLiveTraffic.map((civ) => {
                  const isSelected = selectedLiveAircraftId === civ.icao24;
                  const iconColor = civ.isEmergency ? '#E5554F' : '#CBD5E1';

                  return (
                    <g
                      key={`civ-${civ.icao24}`}
                      transform={`translate(${civ.x}, ${civ.y})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAircraftId(null);
                        onSelectLiveAircraft(civ.icao24);
                        setIsTelemetryOpen(true);
                      }}
                      className="pointer-events-auto cursor-pointer group"
                    >
                      {/* Emergency pulsating ring */}
                      {civ.isEmergency && (
                        <circle cx="0" cy="0" r="16" fill="none" stroke="#E5554F" strokeWidth="1.5" className="animate-ping" />
                      )}

                      {isSelected && (
                        <circle cx="0" cy="0" r="18" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3,2" />
                      )}

                      {/* Civil Airliner Silhouette Icon */}
                      <g transform={`rotate(${civ.heading})`}>
                        <path
                          d="M 0 -11 L 2 -4 L 8 1 L 2 1 L 1 6 L 0 5 L -1 6 L -2 1 L -8 1 L -2 -4 Z"
                          fill={iconColor}
                          stroke="#161C24"
                          strokeWidth="1"
                        />
                      </g>

                      {/* Civil ADS-B Tag: [LIVE] */}
                      <g transform={`translate(10, -12) scale(${1 / zoom})`}>
                        <rect
                          x="0"
                          y="0"
                          width={civ.callsign.length * 6 + 68}
                          height="18"
                          rx="3"
                          fill="#161C24"
                          stroke={civ.isEmergency ? '#E5554F' : isSelected ? '#FFFFFF' : '#475569'}
                          strokeWidth={isSelected || civ.isEmergency ? 1.5 : 1}
                        />
                        <text x="5" y="13" fill="#FFFFFF" fontSize="10" fontFamily="monospace" fontWeight="700">
                          {civ.callsign}
                        </text>
                        <text x={civ.callsign.length * 6 + 10} y="13" fill="#94A3B8" fontSize="9" fontFamily="sans-serif">
                          {civ.flightLevel}
                        </text>
                        <text
                          x={civ.callsign.length * 6 + 48}
                          y="13"
                          fill={civ.isEmergency ? '#E5554F' : '#3FB27F'}
                          fontSize="8"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {civ.isEmergency ? '7700' : 'LIVE'}
                        </text>
                      </g>
                    </g>
                  );
                })}
            </svg>

            {/* Corner Controls */}
            <div className="absolute bottom-3 right-3 bg-[#161C24]/90 backdrop-blur-sm border border-[#2A3340] rounded-lg shadow-lg flex flex-col p-1 space-y-1 z-10 text-[#9AA5B4]">
              <button onClick={handleZoomIn} className="p-1.5 hover:bg-[#1D2530] hover:text-[#E8ECF1] rounded transition cursor-pointer" title="Zoom in (+)">
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={handleZoomOut} className="p-1.5 hover:bg-[#1D2530] hover:text-[#E8ECF1] rounded transition cursor-pointer" title="Zoom out (-)">
                <Minus className="w-4 h-4" />
              </button>
              <div className="border-t border-[#2A3340] my-0.5" />
              <button onClick={handleResetView} className="p-1.5 hover:bg-[#1D2530] hover:text-[#E8ECF1] rounded transition cursor-pointer" title="Reset map view (100%)">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => focusOnCoordinates(tacticalCenter.x, tacticalCenter.y)} className="p-1.5 hover:bg-[#1D2530] hover:text-[#E8ECF1] rounded transition cursor-pointer" title="Fit to fleet assets">
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <Tactical3DErrorBoundary onFallbackTo2D={() => setMapDimension('2D')}>
            <TacticalMap3D
              bases={bases}
              missions={missions}
              zones={zones}
              threats={threats}
              assignments={assignments}
              aircraftList={aircraftList}
              crews={crews}
              alerts={_alerts}
              selectedMissionId={selectedMissionId}
              onSelectMission={onSelectMission}
              selectedAircraftId={selectedAircraftId}
              onSelectAircraft={setSelectedAircraftId}
              onOpenTelemetryDrawer={() => setIsTelemetryOpen(true)}
              simProgress={simProgress}
              simTimeDisplay={simTimeDisplay}
              filteredAircraft={filteredAircraft}
              getSimulatedAircraftState={getSimulatedAircraftState}
              dataMode={dataMode}
              liveAircraft={filteredLiveTraffic}
              selectedLiveAircraftId={selectedLiveAircraftId}
              onSelectLiveAircraft={(id) => {
                setSelectedAircraftId(null);
                onSelectLiveAircraft(id);
              }}
              civilConflicts={civilConflicts}
            />
          </Tactical3DErrorBoundary>
        )}

        {/* 3. DOCKED TELEMETRY DRAWER (Handles both Military Sorties and Live Civil Flights) */}
        {isTelemetryOpen && (selectedLiveAircraft || (selectedAircraft && selectedSimState)) && (
          <aside className="w-[300px] shrink-0 border-l border-[#2A3340] bg-[#161C24] flex flex-col h-full z-20 overflow-hidden font-sans animate-in slide-in-from-right-4 duration-150">
            {/* Header */}
            <div className="p-3 border-b border-[#2A3340] flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                    selectedLiveAircraft
                      ? 'bg-[#1E293B] border-[#475569] text-[#CBD5E1]'
                      : 'bg-[#1D2530] border-[#2A3340] text-[#4C8DF6]'
                  }`}
                >
                  <Plane className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-sm text-[#E8ECF1]">
                      {selectedLiveAircraft ? selectedLiveAircraft.callsign : selectedAircraft?.id}
                    </span>
                    <span className="text-xs text-[#9AA5B4] font-medium truncate">
                      {selectedLiveAircraft ? `ICAO: ${selectedLiveAircraft.icao24}` : selectedAircraft?.callsign}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#657183] truncate">
                    {selectedLiveAircraft ? selectedLiveAircraft.originCountry : selectedAircraft?.model}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsTelemetryOpen(false);
                  onSelectLiveAircraft(null);
                }}
                className="p-1 rounded text-[#657183] hover:text-[#E8ECF1] hover:bg-[#1D2530] transition cursor-pointer"
                title="Close telemetry drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live vs Simulated Badge */}
            <div className="px-3.5 py-1 bg-[#1D2530]/60 border-b border-[#2A3340] flex items-center justify-between text-[10px] text-[#657183] font-mono shrink-0">
              <span className="flex items-center space-x-1">
                <Activity className="w-3 h-3 text-[#3FB27F]" />
                <span>{selectedLiveAircraft ? 'LIVE ADS-B SENSOR LINK' : 'SIMULATED DATALINK'}</span>
              </span>
              <span>{selectedLiveAircraft ? 'Civil Traffic' : 'Tasked Sortie'}</span>
            </div>

            {/* Scrollable Telemetry Body */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
              {/* LIVE CIVIL AIRCRAFT TELEMETRY BLOCK */}
              {selectedLiveAircraft ? (
                <>
                  {/* Status Banner */}
                  <div className="p-2.5 rounded-lg bg-[#0F1419] border border-[#2A3340] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#657183]">Airspace Classification</span>
                      <span className="text-[10px] font-mono font-bold text-[#3FB27F] bg-[#3FB27F]/10 px-1.5 py-0.2 rounded">
                        CIVIL AVIATION
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-[#CBD5E1]">
                      Live ADS-B, non-tasked civil aircraft
                    </div>
                    {selectedLiveAircraft.isEmergency && (
                      <div className="p-2 rounded bg-[#E5554F]/20 border border-[#E5554F]/50 text-[#E5554F] font-bold text-[11px] flex items-center space-x-1.5 mt-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>SQUAWK {selectedLiveAircraft.squawk}: EMERGENCY IN PROGRESS</span>
                      </div>
                    )}
                  </div>

                  {/* Real Flight Data */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-medium text-[#9AA5B4] block">Real-Time State Vector</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-[#0F1419] border border-[#2A3340]/60">
                        <span className="text-[10px] text-[#657183] block">Altitude & FL</span>
                        <span className="font-mono text-[#E8ECF1] font-semibold">
                          {selectedLiveAircraft.flightLevel} ({selectedLiveAircraft.altitudeFt.toLocaleString()} ft)
                        </span>
                      </div>
                      <div className="p-2 rounded bg-[#0F1419] border border-[#2A3340]/60">
                        <span className="text-[10px] text-[#657183] block">Ground Speed</span>
                        <span className="font-mono text-[#E8ECF1] font-semibold">
                          {selectedLiveAircraft.speedKnots} kts
                        </span>
                      </div>
                      <div className="p-2 rounded bg-[#0F1419] border border-[#2A3340]/60">
                        <span className="text-[10px] text-[#657183] block">True Track (Heading)</span>
                        <span className="font-mono text-[#E8ECF1] font-semibold">
                          {selectedLiveAircraft.heading}°
                        </span>
                      </div>
                      <div className="p-2 rounded bg-[#0F1419] border border-[#2A3340]/60">
                        <span className="text-[10px] text-[#657183] block">Vertical Rate</span>
                        <span className="font-mono text-[#E8ECF1] font-semibold">
                          {selectedLiveAircraft.verticalRateFpm >= 0 ? '+' : ''}
                          {selectedLiveAircraft.verticalRateFpm} ft/min
                        </span>
                      </div>
                      <div className="p-2 rounded bg-[#0F1419] border border-[#2A3340]/60">
                        <span className="text-[10px] text-[#657183] block">Transponder Squawk</span>
                        <span
                          className={`font-mono font-bold ${
                            selectedLiveAircraft.isEmergency ? 'text-[#E5554F]' : 'text-[#E8ECF1]'
                          }`}
                        >
                          {selectedLiveAircraft.squawk || 'N/A'}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-[#0F1419] border border-[#2A3340]/60">
                        <span className="text-[10px] text-[#657183] block">Last ADS-B Contact</span>
                        <span className="font-mono text-[#3FB27F] font-semibold">Live stream</span>
                      </div>
                    </div>
                  </div>

                  {/* Surface Weather from Open-Meteo */}
                  <div className="p-2.5 rounded-lg bg-[#0F1419] border border-[#2A3340] space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-semibold text-[#E8ECF1] flex items-center space-x-1">
                        <CloudRain className="w-3 h-3 text-[#4C8DF6]" />
                        <span>METAR / Surface Weather (Open-Meteo)</span>
                      </span>
                      <span className="text-[#3FB27F] font-mono">VFR</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono text-[#9AA5B4]">
                      <div>Wind: 14.5 kts @ 245°</div>
                      <div>Visibility: &gt;10 km</div>
                      <div>Temperature: 31°C</div>
                      <div>Ceiling: Clear</div>
                    </div>
                  </div>
                </>
              ) : (
                /* MILITARY TASKED SORTIE BLOCK */
                selectedSimState &&
                selectedAircraft && (
                  <>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#0F1419] border border-[#2A3340]">
                      <div>
                        <span className="text-[10px] text-[#657183] block">Operational Status</span>
                        <span
                          className={`font-semibold text-xs ${
                            selectedSimState.status === 'ON_MISSION' || selectedSimState.status === 'EN_ROUTE'
                              ? 'text-[#4C8DF6]'
                              : selectedSimState.status === 'RETURNING'
                              ? 'text-[#A855F7]'
                              : selectedSimState.status === 'AVAILABLE'
                              ? 'text-[#3FB27F]'
                              : 'text-[#E5554F]'
                          }`}
                        >
                          ● {selectedSimState.statusLabel}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[#657183] block">Home Base</span>
                        <span className="font-medium text-[#E8ECF1]">
                          {bases.find((b) => b.id === selectedAircraft.baseId)?.name || 'Ambala AFS'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[11px] font-medium text-[#9AA5B4] block">Dynamic Flight Data</span>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded bg-[#0F1419] border border-[#2A3340]/60">
                          <span className="text-[10px] text-[#657183] block">Simulated Altitude</span>
                          <span className="font-mono text-[#E8ECF1] font-semibold">
                            {selectedSimState.altitudeFt > 0 ? (
                              <>
                                FL{Math.round(selectedSimState.altitudeFt / 100)}{' '}
                                <span className="text-[10px] text-[#8B98A9]">({selectedSimState.altitudeFt.toLocaleString()} ft)</span>
                              </>
                            ) : (
                              'GND (0 ft)'
                            )}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-[#0F1419] border border-[#2A3340]/60">
                          <span className="text-[10px] text-[#657183] block">Airspeed & Mach</span>
                          <span className="font-mono text-[#E8ECF1] font-semibold">
                            {selectedSimState.speedKts > 0 ? `${selectedSimState.speedKts} kts (M${selectedSimState.mach})` : '0 kts'}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-[#0F1419] border border-[#2A3340]/60">
                          <span className="text-[10px] text-[#657183] block">Position & Heading</span>
                          <span className="font-mono text-[#E8ECF1] font-semibold">
                            {selectedSimState.heading}° ({selectedSimState.x}, {selectedSimState.y})
                          </span>
                        </div>
                        <div className="p-2 rounded bg-[#0F1419] border border-[#2A3340]/60">
                          <span className="text-[10px] text-[#657183] block">Mission Progress / ETA</span>
                          <span className="font-mono text-[#E8ECF1] font-semibold">
                            {selectedSimState.missionProgress}% ({selectedSimState.eta})
                          </span>
                        </div>
                      </div>

                      {/* Altitude Profile */}
                      <div className="p-2.5 rounded-lg bg-[#0F1419] border border-[#2A3340] space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-[#9AA5B4]">
                          <span className="flex items-center space-x-1 font-semibold text-[#E8ECF1]">
                            <TrendingUp className="w-3 h-3 text-[#4C8DF6]" />
                            <span>Altitude Profile (06:00 – 18:00 UTC)</span>
                          </span>
                          <span className="font-mono text-[#4C8DF6]">
                            {selectedSimState.altitudeFt > 0 ? `FL${Math.round(selectedSimState.altitudeFt / 100)}` : 'GND'}
                          </span>
                        </div>

                        <div className="relative h-14 w-full bg-[#161C24]/60 rounded border border-[#2A3340]/40 overflow-hidden">
                          <svg viewBox="0 0 260 56" className="w-full h-full" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="altGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#4C8DF6" stopOpacity="0.45" />
                                <stop offset="100%" stopColor="#4C8DF6" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                            <line x1="0" y1="14" x2="260" y2="14" stroke="#2A3340" strokeDasharray="2,2" strokeWidth="0.5" />
                            <line x1="0" y1="28" x2="260" y2="28" stroke="#2A3340" strokeDasharray="2,2" strokeWidth="0.5" />
                            <line x1="0" y1="42" x2="260" y2="42" stroke="#2A3340" strokeDasharray="2,2" strokeWidth="0.5" />

                            {selectedMission && selectedAircraft.status === 'Serviceable' ? (
                              <>
                                <polygon points="0,52 30,52 80,14 160,18 200,52 260,52" fill="url(#altGrad)" />
                                <polyline points="0,52 30,52 80,14 160,18 200,52 260,52" fill="none" stroke="#4C8DF6" strokeWidth="1.8" />
                              </>
                            ) : (
                              <line x1="0" y1="52" x2="260" y2="52" stroke="#3FB27F" strokeWidth="1.5" />
                            )}

                            <line x1={simProgress * 260} y1="2" x2={simProgress * 260} y2="54" stroke="#E8ECF1" strokeWidth="1.2" />
                            <circle
                              cx={simProgress * 260}
                              cy={selectedSimState.altitudeFt > 0 ? Math.max(8, 52 - (selectedSimState.altitudeFt / 35000) * 44) : 52}
                              r="3.5"
                              fill="#4C8DF6"
                              stroke="#E8ECF1"
                              strokeWidth="1"
                            />
                          </svg>
                          <div className="absolute bottom-0.5 inset-x-1 flex justify-between text-[8px] text-[#657183] font-mono pointer-events-none">
                            <span>06:00</span>
                            <span>12:00</span>
                            <span>18:00</span>
                          </div>
                        </div>
                      </div>

                      {/* Fuel Bar */}
                      <div className="space-y-1 pt-0.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#657183] flex items-center space-x-1">
                            <Fuel className="w-3 h-3 text-[#4C8DF6]" />
                            <span>Simulated Fuel</span>
                          </span>
                          <span className="font-mono text-[#E8ECF1] font-medium">
                            {selectedSimState.fuelPercent}% ({Math.round(selectedAircraft.maxFuelKg * (selectedSimState.fuelPercent / 100))} kg)
                          </span>
                        </div>
                        <div className="h-1.5 bg-[#0F1419] rounded-full overflow-hidden border border-[#2A3340]">
                          <div
                            className="h-full bg-[#4C8DF6] rounded-full transition-all duration-300"
                            style={{ width: `${selectedSimState.fuelPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Assigned Mission */}
                    {selectedMission ? (
                      <div className="p-2.5 rounded-lg bg-[#0F1419] border border-[#2A3340] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[#4C8DF6] font-semibold">ASSIGNED MISSION</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E5554F]/20 text-[#E5554F] font-bold">
                            {selectedMission.priority}
                          </span>
                        </div>
                        <div className="font-semibold text-xs text-[#E8ECF1]">
                          {selectedMission.id} — {selectedMission.codeName}
                        </div>
                        <div className="text-[11px] text-[#9AA5B4]">
                          Target: {selectedMission.targetLocation.name} ({selectedMission.targetLocation.sector})
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-[#0F1419] border border-[#2A3340] text-center text-[#657183]">
                        No active sortie assigned. Available in standby reserve.
                      </div>
                    )}
                  </>
                )
              )}
            </div>

            {/* Quick Actions Footer */}
            <div className="p-3 border-t border-[#2A3340] bg-[#161C24] grid grid-cols-2 gap-2 text-xs shrink-0">
              <button
                onClick={() => {
                  if (selectedLiveAircraft) {
                    focusOnCoordinates(selectedLiveAircraft.x, selectedLiveAircraft.y);
                  } else if (selectedSimState) {
                    focusOnCoordinates(selectedSimState.x, selectedSimState.y);
                  }
                }}
                className="py-1.5 px-2 bg-[#1D2530] hover:bg-[#222C3A] text-[#E8ECF1] border border-[#2A3340] rounded-md transition font-medium text-center cursor-pointer"
              >
                Focus on Map
              </button>

              {selectedMission ? (
                <button
                  onClick={() => onSelectMission(selectedMission.id)}
                  className="py-1.5 px-2 bg-[#4C8DF6] hover:bg-[#3B7DE8] text-white rounded-md transition font-medium text-center cursor-pointer"
                >
                  Inspect Mission
                </button>
              ) : (
                <button
                  onClick={onOpenManualOverride}
                  className="py-1.5 px-2 bg-[#1D2530] hover:bg-[#222C3A] text-[#4C8DF6] border border-[#2A3340] rounded-md transition font-medium text-center cursor-pointer"
                >
                  Assign Sortie
                </button>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* 4. TACTICAL LEGEND POPOVER */}
      {isLegendOpen && (
        <div
          ref={legendRef}
          className="absolute top-13 right-3 sm:right-12 w-64 bg-[#161C24] border border-[#2A3340] rounded-xl p-3 shadow-2xl z-30 text-xs font-sans animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-[#2A3340] text-[11px] font-semibold text-[#E8ECF1]">
            <span>Tactical Map Legend</span>
            <button onClick={() => setIsLegendOpen(false)} className="p-0.5 rounded text-[#657183] hover:text-[#E8ECF1] cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 pt-2 text-[11px] text-[#9AA5B4]">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4C8DF6]" />
              <span>Mil Sortie [SIM]</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#CBD5E1]" />
              <span>Civil Flight [LIVE]</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3FB27F]" />
              <span>Available</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#A855F7]" />
              <span>Returning (RTB)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E5554F]" />
              <span>AOG / Threat</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E0A33A]" />
              <span>Civil Conflict</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. DATA SOURCES METADATA MODAL */}
      <DataSourcesModal
        isOpen={isDataSourcesModalOpen}
        onClose={() => setIsDataSourcesModalOpen(false)}
        feedMeta={feedMeta}
      />
    </div>
  );
};
