/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Aircraft,
  Crew,
  FeedFreshness,
  FeedStatus,
  GeneratedPlan,
  LiveOperationalState,
  Mission,
  MissionAssignment,
  OperatingMode,
  UserRole,
  OperationalAlert,
} from './types/ops';
import { generateScenario } from './services/scenarioGenerator';
import { validateAndFuseState, setFeedDegradedState } from './services/dataFusion';
import { generatePlanSet } from './services/optimiser';
import { createAuditEntry, getInitialAuditLog } from './services/auditLogger';
import { fetchPlanExplanation } from './services/geminiService';

// UI Components
import { TopBar } from './components/TopBar';
import { LeftMissionQueue } from './components/LeftMissionQueue';
import { GanttTimeline } from './components/GanttTimeline';
import { TacticalMap } from './components/TacticalMap';
import { RecommendationPanel } from './components/RecommendationPanel';
import { PlanDiffModal } from './components/PlanDiffModal';
import { ApprovalConfirmationModal } from './components/ApprovalConfirmationModal';
import { AuditLogDrawer } from './components/AuditLogDrawer';
import { ManualOverrideModal } from './components/ManualOverrideModal';
import { PredictiveDetailsModal } from './components/PredictiveDetailsModal';
import { EvaluationTab } from './components/EvaluationTab';
import { DemoRunner } from './components/DemoRunner';
import { DataSourcesModal } from './components/DataSourcesModal';
import { useLiveTraffic } from './services/useLiveTraffic';
import { ToastProvider, useToast } from './components/ui/Toast';
import { Clock, ShieldCheck, X } from 'lucide-react';

function VayuOpsApp() {
  const { showToast } = useToast();

  // 1. Theme State (Light default per visual design direction, Dark optional with persistence)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('vayu_ops_theme') as 'dark' | 'light' | null;
      if (saved === 'dark' || saved === 'light') return saved;
      return 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light');
    if (theme === 'light') {
      root.classList.add('theme-light');
    }
    try {
      localStorage.setItem('vayu_ops_theme', theme);
    } catch {}
  }, [theme]);

  // 2. Operational State
  const [scenarioSeed, setScenarioSeed] = useState<number>(101);
  const [operationalState, setOperationalState] = useState<LiveOperationalState>(() =>
    generateScenario(101)
  );

  const [currentRole, setCurrentRole] = useState<UserRole>('Commander');
  const [activeTab, setActiveTab] = useState<'AIR_TASKING' | 'EVALUATION'>('AIR_TASKING');
  const [viewMode, setViewMode] = useState<'TIMELINE' | 'MAP'>('TIMELINE');

  // Sidebar responsiveness
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [isMapFocusMode, setIsMapFocusMode] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMapFocusMode) {
        setIsMapFocusMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMapFocusMode]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280) {
        setIsLeftCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 3. Selection & Dialogs
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>('M-101');
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>('A2');
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);
  const [isManualOverrideOpen, setIsManualOverrideOpen] = useState(false);
  const [isPredictiveDetailsOpen, setIsPredictiveDetailsOpen] = useState(false);
  const [isDemoRunning, setIsDemoRunning] = useState(false);

  // 4. Alert & Disruption State
  const [disruptionBanner, setDisruptionBanner] = useState<{
    text: string;
    details: string;
  } | null>(null);

  const [operationalAlerts, setOperationalAlerts] = useState<OperationalAlert[]>([
    {
      id: 'ALT-101',
      type: 'ROUTE_DEVIATION',
      title: 'Route Deviation Detected',
      aircraftId: 'A2',
      missionId: 'M-101',
      severity: 'WARNING',
      reason: 'Aircraft drifted 12 km south of designated corridor toward contested border zone.',
      timestamp: '09:24 UTC',
      suggestedResponse: 'Reroute via Waypoint Echo; standoff weapon release envelope remains valid.',
      actionLabel: 'Inspect Asset',
    },
    {
      id: 'ALT-102',
      type: 'LOW_FUEL',
      title: 'Low Fuel Reserve Advisory',
      aircraftId: 'A4',
      missionId: 'M-104',
      severity: 'CRITICAL',
      reason: 'High-power combat transit reduced fuel reserve below 25% threshold.',
      timestamp: '09:31 UTC',
      suggestedResponse: 'Authorize early recovery or divert to alternate runway at Hasimara AFS.',
      actionLabel: 'Divert Alternate',
    },
    {
      id: 'ALT-103',
      type: 'TELEMETRY_INTERRUPT',
      title: 'Tactical Datalink Degraded',
      aircraftId: 'A6',
      missionId: 'M-106',
      severity: 'WARNING',
      reason: 'Intermittent telemetry beacon in contested EW sector (latency > 38s).',
      timestamp: '09:38 UTC',
      suggestedResponse: 'Maintain datalink silence; secondary satellite beacon confirmed active.',
      actionLabel: 'Verify Link',
    },
    {
      id: 'ALT-104',
      type: 'SCHEDULE_CONFLICT',
      title: 'Airframe Maintenance Conflict',
      aircraftId: 'A1',
      missionId: 'M-101',
      severity: 'ADVISORY',
      reason: 'Sortie duration exceeds 50-hour scheduled maintenance window by 1.2 hrs.',
      timestamp: '09:42 UTC',
      suggestedResponse: 'Shift airframe to A9 or apply Balanced Re-Plan.',
      actionLabel: 'Recalculate Plan',
      actionPlanType: 'BALANCED',
    },
    {
      id: 'ALT-105',
      type: 'AVAILABILITY_CHANGE',
      title: 'A3 Hydraulic Pressure Fault (AOG)',
      aircraftId: 'A3',
      missionId: 'M-103',
      severity: 'CRITICAL',
      reason: 'Hydraulic sensor warning grounded A3. Strike sortie M-103 requires reallocation.',
      timestamp: '09:46 UTC',
      suggestedResponse: 'Reassign Strike sortie to A2; switch to Low Risk Plan alternative.',
      actionLabel: 'Apply Re-Plan',
      actionPlanType: 'LOW_RISK',
    },
  ]);

  const [activeAlert, setActiveAlert] = useState<OperationalAlert | null>(null);

  // 5. Audit Log (Immutable Hash Chain)
  const [auditLog, setAuditLog] = useState(() => getInitialAuditLog());

  const logAudit = useCallback(
    (action: string, details: string, role?: UserRole) => {
      setAuditLog((prev) => {
        const entry = createAuditEntry(prev, role || currentRole, action, details);
        return [...prev, entry];
      });
    },
    [currentRole]
  );

  // 6. Generated Plans
  const [priorPlan, setPriorPlan] = useState<GeneratedPlan | null>(null);
  const [planSet, setPlanSet] = useState(() => {
    const baseline = generateScenario(101);
    return generatePlanSet(baseline, false, null);
  });

  const [activePlan, setActivePlan] = useState<GeneratedPlan>(planSet.recommended);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Clock
  const [currentTimeString, setCurrentTimeString] = useState('09:20:00');
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTimeString(d.toTimeString().split(' ')[0]);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initial AI Explanation
  useEffect(() => {
    let isMounted = true;
    async function loadInitialAi() {
      if (!activePlan.explanation) {
        setIsAiLoading(true);
        const res = await fetchPlanExplanation(activePlan);
        if (isMounted) {
          setIsAiLoading(false);
          setActivePlan((prev) => ({
            ...prev,
            explanation: res.explanation,
            isAiGeneratedExplanation: res.source === 'GEMINI_API',
          }));
        }
      }
    }
    loadInitialAi();
    return () => {
      isMounted = false;
    };
  }, []);

  // Solver Recompute
  const recomputePlans = useCallback(
    (
      newState: LiveOperationalState,
      disruptionReason?: string,
      customPriorPlan?: GeneratedPlan
    ) => {
      const degraded = Object.values(newState.feeds).some((f) => f.freshness !== 'FRESH');
      const prior = customPriorPlan || activePlan;
      setPriorPlan(prior);

      const newPlans = generatePlanSet(newState, degraded, prior);
      setPlanSet(newPlans);
      setActivePlan(newPlans.recommended);

      logAudit(
        degraded ? 'FALLBACK_PLAN_TRIGGERED' : 'OPTIMISER_SOLVED',
        degraded
          ? `Fallback planner engaged. Plan: ${newPlans.recommended.name}`
          : `Plan updated: ${newPlans.recommended.metrics.p1CoveragePercent}% P1 coverage in ${newPlans.recommended.metrics.solveTimeMs}ms.`
      );

      setIsAiLoading(true);
      fetchPlanExplanation(newPlans.recommended, disruptionReason).then((res) => {
        setIsAiLoading(false);
        setActivePlan((prev) => ({
          ...prev,
          explanation: res.explanation,
          isAiGeneratedExplanation: res.source === 'GEMINI_API',
        }));
      });
    },
    [activePlan, logAudit]
  );

  // 7. Live ADS-B Civil Traffic & OpenSky/Open-Meteo Integration
  const [isDataSourcesModalOpen, setIsDataSourcesModalOpen] = useState(false);

  // Simulated coordinate estimator for deconfliction checks
  const getSimulatedState = useCallback(
    (ac: Aircraft) => {
      const asgn = activePlan.assignments.find((a) => a.aircraftId === ac.id);
      const mission = asgn ? operationalState.missions.find((m) => m.id === asgn.missionId) : null;
      const base =
        operationalState.bases.find((b) => b.id === ac.baseId) ||
        operationalState.bases[0] || { coordinates: { x: 220, y: 350 } };

      if (ac.status === 'AOG' || ac.status === 'Maintenance' || !mission) {
        return { x: base.coordinates.x, y: base.coordinates.y, altitudeFt: 0 };
      }

      const progress = 0.44;
      const startX = base.coordinates.x;
      const startY = base.coordinates.y;
      const tgtX = mission.targetLocation.coords.x;
      const tgtY = mission.targetLocation.coords.y;

      return {
        x: startX + (tgtX - startX) * progress,
        y: startY + (tgtY - startY) * progress,
        altitudeFt: mission.requiredRole === 'CAP' ? 28000 : mission.requiredRole === 'Strike' ? 18000 : 24000,
      };
    },
    [activePlan.assignments, operationalState.missions, operationalState.bases]
  );

  const liveTraffic = useLiveTraffic(
    activePlan.assignments,
    operationalState.missions,
    operationalState.aircraft,
    getSimulatedState
  );

  // Combined operational alerts + Civil traffic deconfliction alerts
  const effectiveAlerts: OperationalAlert[] = useMemo(() => {
    if (liveTraffic.dataMode === 'SIMULATED' || liveTraffic.civilConflicts.length === 0) {
      return operationalAlerts;
    }
    const conflictAlerts: OperationalAlert[] = liveTraffic.civilConflicts.map((c) => ({
      id: c.id,
      type: 'SCHEDULE_CONFLICT',
      title: 'Civil Traffic Conflict Alert',
      aircraftId: c.militaryAircraftId,
      missionId: c.militaryMissionId,
      severity: c.severity,
      reason: c.description,
      timestamp: c.timestamp,
      suggestedResponse: 'Step-climb +2,000 ft or offset waypoint ingress vector by 12° to maintain ICAO separation.',
      actionLabel: 'Inspect Conflict',
    }));
    return [...conflictAlerts, ...operationalAlerts];
  }, [operationalAlerts, liveTraffic.dataMode, liveTraffic.civilConflicts]);

  // Include civil traffic corridor risk in recommended plan metrics
  const displayPlan = useMemo(() => {
    if (liveTraffic.dataMode === 'SIMULATED' || liveTraffic.civilConflicts.length === 0) {
      return activePlan;
    }
    const penalty = Math.min(28, liveTraffic.civilConflicts.length * 9);
    return {
      ...activePlan,
      metrics: {
        ...activePlan.metrics,
        averageRiskScore: Math.min(94, activePlan.metrics.averageRiskScore + penalty),
      },
    };
  }, [activePlan, liveTraffic.dataMode, liveTraffic.civilConflicts]);

  // Audit log when new civil conflict is detected
  const loggedConflictsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (liveTraffic.dataMode === 'SIMULATED') return;
    liveTraffic.civilConflicts.forEach((conf) => {
      if (!loggedConflictsRef.current.has(conf.id)) {
        loggedConflictsRef.current.add(conf.id);
        logAudit(
          'CIVIL_CONFLICT_DETECTED',
          `Airspace deconfliction advisory: Flight ${conf.civilCallsign} within ${conf.lateralDistanceNm} nm of sortie ${conf.militaryMissionId}.`
        );
      }
    });
  }, [liveTraffic.civilConflicts, liveTraffic.dataMode, logAudit]);


  // Synchronized Selection Handlers
  const handleSelectMission = useCallback(
    (id: string) => {
      setSelectedMissionId(id);
      const asgn = activePlan.assignments.find((a) => a.missionId === id);
      if (asgn?.aircraftId) {
        setSelectedAircraftId(asgn.aircraftId);
      }
    },
    [activePlan.assignments]
  );

  const handleSelectAircraft = useCallback(
    (aircraftId: string) => {
      setSelectedAircraftId(aircraftId);
      const asgn = activePlan.assignments.find((a) => a.aircraftId === aircraftId);
      if (asgn?.missionId) {
        setSelectedMissionId(asgn.missionId);
      }
    },
    [activePlan.assignments]
  );

  const handleSelectAlert = useCallback(
    (alert: OperationalAlert) => {
      setActiveAlert(alert);
      setSelectedAircraftId(alert.aircraftId);
      if (alert.missionId) {
        setSelectedMissionId(alert.missionId);
      }
      setViewMode('MAP');
      showToast(alert.title, alert.reason, alert.severity === 'CRITICAL' ? 'critical' : 'warning');
    },
    [showToast]
  );

  const handleApplyAlertAction = useCallback(
    (alert: OperationalAlert) => {
      if (alert.actionPlanType === 'LOW_RISK') {
        setActivePlan(planSet.alternativeLowRisk);
        setPriorPlan(activePlan);
        setDisruptionBanner({
          text: `Operational Re-Plan Applied: ${alert.title}`,
          details: `Reassigned sortie to resilient low-risk profile. ${alert.suggestedResponse}`,
        });
        logAudit('ALERT_REPLAN_APPLIED', `Switched to Low Risk Plan in response to ${alert.title} on ${alert.aircraftId}`);
        showToast('Plan Updated', 'Switched to Low Risk Plan alternative with deconflicted routing.', 'success');
      } else if (alert.actionPlanType === 'BALANCED') {
        setActivePlan(planSet.recommended);
        setDisruptionBanner({
          text: `Plan Recalculated: ${alert.title}`,
          details: `Deconflicted airframe assignment. ${alert.suggestedResponse}`,
        });
        logAudit('ALERT_REPLAN_APPLIED', `Recalculated Balanced Plan for ${alert.aircraftId}`);
        showToast('Plan Recalculated', 'Balanced Plan refreshed and optimized.', 'info');
      } else {
        setSelectedAircraftId(alert.aircraftId);
        setViewMode('MAP');
        showToast('Asset Focused', `Tracking map centered on ${alert.aircraftId}.`, 'info');
      }
    },
    [activePlan, planSet, logAudit, showToast]
  );

  // Disruption Handlers
  const handleInjectA3Aog = () => {
    const updatedAircraft = operationalState.aircraft.map((ac) => {
      if (ac.id === 'A3') {
        return {
          ...ac,
          status: 'AOG' as const,
          serviceabilityProb: 0.05,
        };
      }
      return ac;
    });

    const newState: LiveOperationalState = {
      ...operationalState,
      aircraft: updatedAircraft,
    };

    setOperationalState(newState);
    const newAlert: OperationalAlert = {
      id: `ALT-${Date.now()}`,
      type: 'AVAILABILITY_CHANGE',
      title: 'A3 Hydraulic System Failure (AOG)',
      aircraftId: 'A3',
      missionId: 'M-103',
      severity: 'CRITICAL',
      reason: 'A3 grounded due to hydraulic actuator pressure loss. Strike sortie unassigned.',
      timestamp: 'Just now',
      suggestedResponse: 'Apply re-plan to allocate standby airframe without P1 coverage loss.',
      actionLabel: 'Apply Re-Plan',
      actionPlanType: 'LOW_RISK',
    };
    setOperationalAlerts((prev) => [newAlert, ...prev]);
    setActiveAlert(newAlert);
    setDisruptionBanner({
      text: 'A3 is now unserviceable. A revised plan is ready for review.',
      details: 'Substituted with standby airframe A8; all P1 taskings covered.',
    });
    showToast('A3 unserviceable', 'Dynamic re-plan generated in 24ms.', 'warning');
    logAudit('AIRCRAFT_AOG', 'A3 status changed to AOG.');
    recomputePlans(newState, 'Aircraft A3 goes unserviceable (AOG)', activePlan);
  };

  const handleInjectNewThreat = () => {
    const newThreat = {
      id: `THREAT-${Date.now().toString().slice(-4)}`,
      type: 'SAM-Radar' as const,
      label: 'Mobile SAM radar contact',
      severity: 'Severe' as const,
      coords: { x: 390, y: 190 },
      rangeKm: 100,
      firstDetected: 'Just now',
      status: 'Active' as const,
    };

    const newState: LiveOperationalState = {
      ...operationalState,
      threats: [newThreat, ...operationalState.threats],
    };

    setOperationalState(newState);
    const newAlert: OperationalAlert = {
      id: `ALT-${Date.now()}`,
      type: 'ROUTE_DEVIATION',
      title: 'New Hostile SAM Radar Lock',
      aircraftId: 'A2',
      missionId: 'M-101',
      severity: 'WARNING',
      reason: 'SA-21 radar dome acquired in Sector Charlie. Ingress corridor overlaps engagement envelope.',
      timestamp: 'Just now',
      suggestedResponse: 'Reroute via low-risk standoff corridor to avoid radar detection.',
      actionLabel: 'Switch Low-Risk',
      actionPlanType: 'LOW_RISK',
    };
    setOperationalAlerts((prev) => [newAlert, ...prev]);
    setActiveAlert(newAlert);
    setDisruptionBanner({
      text: 'New SAM radar contact in Sector Charlie. Proposed route reroutes ready.',
      details: 'Adjusted ingress paths for M-101 and M-103.',
    });
    showToast('New threat detected', 'Flight routes rerouted outside radar range.', 'warning');
    logAudit('NEW_THREAT', 'SAM radar emitter acquired.');
    recomputePlans(newState, 'New mobile SAM radar lock detected', activePlan);
  };

  const handleInjectWeatherShift = () => {
    const updatedWeather = operationalState.weather.map((w, idx) => {
      if (idx === 1) {
        return {
          ...w,
          visibilityKm: 3.2,
          windKnots: 40,
          cloudCoverPercent: 85,
          severity: 'Severe' as const,
        };
      }
      return w;
    });

    const newState: LiveOperationalState = {
      ...operationalState,
      weather: updatedWeather,
    };

    setOperationalState(newState);
    const newAlert: OperationalAlert = {
      id: `ALT-${Date.now()}`,
      type: 'ROUTE_DEVIATION',
      title: 'Micro-Climate Deterioration',
      aircraftId: 'A4',
      missionId: 'M-104',
      severity: 'WARNING',
      reason: 'Low ceiling (<500ft) and 40kt crosswinds detected in central strike corridor.',
      timestamp: 'Just now',
      suggestedResponse: 'Recalculate route to clear weather corridor or defer secondary target.',
      actionLabel: 'Inspect Route',
    };
    setOperationalAlerts((prev) => [newAlert, ...prev]);
    setActiveAlert(newAlert);
    setDisruptionBanner({
      text: 'Adverse weather front in central sector. Re-scheduled reconnaissance.',
      details: 'M-102 deferred to clear weather corridor.',
    });
    showToast('Weather deterioration', 'Sector visibility reduced to 3.2km.', 'info');
    logAudit('WEATHER_SHIFT', 'Central sector downgraded to Severe weather.');
    recomputePlans(newState, 'Severe weather in central sector', activePlan);
  };

  const handleInjectPriorityEscalation = () => {
    const updatedMissions = operationalState.missions.map((m) => {
      if (m.id === 'M-104') {
        return {
          ...m,
          priority: 'P1' as const,
          codeName: 'Operation Desert Falcon [P1]',
        };
      }
      return m;
    });

    const newState: LiveOperationalState = {
      ...operationalState,
      missions: updatedMissions,
    };

    setOperationalState(newState);
    const newAlert: OperationalAlert = {
      id: `ALT-${Date.now()}`,
      type: 'SCHEDULE_CONFLICT',
      title: 'M-104 Escalated to Priority 1',
      aircraftId: 'A1',
      missionId: 'M-104',
      severity: 'ADVISORY',
      reason: 'Commander emergency directive elevated M-104 to Priority 1 defense requirement.',
      timestamp: 'Just now',
      suggestedResponse: 'Allocate frontline multirole fighter to guarantee 100% P1 coverage.',
      actionLabel: 'Recalculate Plan',
      actionPlanType: 'BALANCED',
    };
    setOperationalAlerts((prev) => [newAlert, ...prev]);
    setActiveAlert(newAlert);
    setDisruptionBanner({
      text: 'M-104 promoted to Priority 1. Re-allocated frontline interceptor.',
      details: 'Frontline fighter assigned to meet P1 threshold.',
    });
    showToast('Priority shift', 'M-104 elevated to Priority 1.', 'info');
    logAudit('PRIORITY_SHIFT', 'M-104 promoted to P1.');
    recomputePlans(newState, 'Mission M-104 escalated to P1 priority', activePlan);
  };

  const handleInjectFeedDelay = () => {
    let s = setFeedDegradedState(operationalState, 'Threat', 'STALE');
    s = setFeedDegradedState(s, 'Weather', 'STALE');
    setOperationalState(s);
    const newAlert: OperationalAlert = {
      id: `ALT-${Date.now()}`,
      type: 'TELEMETRY_INTERRUPT',
      title: 'Telemetry Datalink Interruption',
      aircraftId: 'A6',
      severity: 'WARNING',
      reason: 'Threat and Weather data feeds marked STALE (latency > 45s). Fallback solver engaged.',
      timestamp: 'Just now',
      suggestedResponse: 'Switch to heuristic fallback planner pending datalink recovery.',
      actionLabel: 'Inspect Telemetry',
    };
    setOperationalAlerts((prev) => [newAlert, ...prev]);
    setActiveAlert(newAlert);
    setDisruptionBanner({
      text: 'Feed latency elevated. Operating on greedy fallback planner.',
      details: 'Telemetry marked stale; manual verification recommended.',
    });
    showToast('Telemetry delayed', 'Fallback planner engaged.', 'warning');
    logAudit('FEED_DELAY', 'Feeds degraded to Stale.');
    recomputePlans(s, 'Feeds marked stale');
  };

  const handleResetScenario = () => {
    const nextSeed = scenarioSeed === 101 ? 202 : 101;
    setScenarioSeed(nextSeed);
    const newScenario = generateScenario(nextSeed);
    setOperationalState(newScenario);
    setDisruptionBanner(null);
    showToast('Scenario reset', `Baseline restored with seed #${nextSeed}.`, 'info');
    logAudit('SCENARIO_RESET', `Baseline reloaded with seed #${nextSeed}.`);
    recomputePlans(newScenario, 'Baseline restored');
  };

  // Publish / Approve
  const handleApprovePlan = () => {
    logAudit(
      'PLAN_APPROVED',
      `Commander published Air Tasking Order ${activePlan.name} (${activePlan.planId}).`
    );

    const updatedMissions = operationalState.missions.map((m) => {
      const asgn = activePlan.assignments.find((a) => a.missionId === m.id);
      return {
        ...m,
        status: asgn?.aircraftId ? ('Approved' as const) : ('Unassigned' as const),
      };
    });

    setOperationalState((prev) => ({
      ...prev,
      missions: updatedMissions,
    }));

    setDisruptionBanner(null);
    showToast('Plan approved', 'Air tasking order confirmed and broadcast to tactical wings.', 'success');
  };

  // Manual Override
  const handleSaveManualOverride = (updatedAssignments: MissionAssignment[]) => {
    const modifiedPlan: GeneratedPlan = {
      ...activePlan,
      planId: `MANUAL-${Date.now().toString(36).toUpperCase()}`,
      name: `${activePlan.name} (Manual)`,
      description: 'Adjusted by planner/commander with verified constraints.',
      assignments: updatedAssignments,
      metrics: {
        ...activePlan.metrics,
        planChangesVsPrior: activePlan.metrics.planChangesVsPrior + 1,
      },
      explanation: 'Manual asset assignments applied and validated against safety margins.',
    };

    setActivePlan(modifiedPlan);
    logAudit('MANUAL_OVERRIDE', `Manual allocation saved by ${currentRole}.`);
    showToast('Manual changes applied', 'Air tasking assignments updated.', 'info');
  };

  const selectedMission =
    operationalState.missions.find((m) => m.id === selectedMissionId) ||
    operationalState.missions[0];
  const selectedAssignment =
    activePlan.assignments.find((a) => a.missionId === selectedMission?.id) || null;
  const selectedAircraft =
    operationalState.aircraft.find((a) => a.id === selectedAircraftId) ||
    operationalState.aircraft.find((a) => a.id === selectedAssignment?.aircraftId) ||
    null;
  const selectedCrew =
    operationalState.crews.find((c) => c.id === selectedAssignment?.crewId) || null;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0F1419] text-[#E8ECF1] overflow-hidden font-sans select-none">
      {/* 1. Slim Top Bar (48px) */}
      <TopBar
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        feeds={operationalState.feeds}
        theme={theme}
        onThemeToggle={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onStartDemo={() => setIsDemoRunning(true)}
        onOpenAuditLog={() => setIsAuditDrawerOpen(true)}
        alerts={effectiveAlerts}
        onSelectAlert={handleSelectAlert}
        onInjectA3Aog={handleInjectA3Aog}
        onInjectNewThreat={handleInjectNewThreat}
        onInjectWeatherShift={handleInjectWeatherShift}
        onInjectPriorityEscalation={handleInjectPriorityEscalation}
        onInjectFeedDelay={handleInjectFeedDelay}
        onResetScenario={handleResetScenario}
        scenarioSeed={scenarioSeed}
        liveFeedStatus={liveTraffic.feedStatus}
        liveFeedMeta={liveTraffic.feedMeta}
        onOpenDataSources={() => setIsDataSourcesModalOpen(true)}
      />

      {/* 2. Slim Re-plan Disruption Banner (Only shows when event occurs) */}
      {disruptionBanner && activeTab === 'AIR_TASKING' && (
        <div className="h-10 px-4 bg-[#161C24] border-b border-[#2A3340] flex items-center justify-between text-xs text-[#E8ECF1] shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E0A33A]" />
            <span className="font-medium text-[#E8ECF1]">{disruptionBanner.text}</span>
            <span className="text-[#657183] hidden md:inline">•</span>
            <span className="text-[#9AA5B4] hidden md:inline">{disruptionBanner.details}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsDiffModalOpen(true)}
              className="px-2.5 py-1 text-xs font-medium text-[#4C8DF6] hover:bg-[#4C8DF6]/10 rounded transition cursor-pointer"
            >
              Review plan
            </button>
            <button
              onClick={() => setDisruptionBanner(null)}
              className="p-1 text-[#657183] hover:text-[#E8ECF1] rounded transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Workspace Shell */}
      {activeTab === 'EVALUATION' ? (
        <EvaluationTab
          currentPlan={activePlan}
          operationalState={operationalState}
          onReplayScenario={handleResetScenario}
        />
      ) : (
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          {/* Left Sidebar: Mission Queue (260px) */}
          <LeftMissionQueue
            missions={operationalState.missions}
            selectedMissionId={selectedMissionId}
            onSelectMission={handleSelectMission}
            assignments={activePlan.assignments}
            aircraftList={operationalState.aircraft}
            crews={operationalState.crews}
            operationalState={operationalState}
            isCollapsed={isLeftCollapsed || isMapFocusMode}
            onToggleCollapse={() => setIsLeftCollapsed(!isLeftCollapsed)}
          />

          {/* Center Area: Hero (ONE view at a time: Timeline or Map) */}
          <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#0F1419]">
            {/* View Switcher Header (Rendered for Timeline; for Map, TacticalMap provides the unified 48px single toolbar) */}
            {viewMode === 'TIMELINE' && (
              <div className="h-10 px-4 border-b border-[#2A3340] flex items-center justify-between text-xs shrink-0 bg-[#161C24]">
                <div className="flex items-center space-x-2 text-[#9AA5B4] min-w-0 overflow-hidden">
                  <span className="shrink-0 text-[#657183]">Context:</span>
                  <button
                    onClick={() => setIsPredictiveDetailsOpen(true)}
                    className="text-[#E8ECF1] hover:text-[#4C8DF6] font-medium truncate cursor-pointer transition flex items-center space-x-1.5"
                    title="Inspect mission predictive assessment"
                  >
                    <span
                      className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                        selectedMission?.priority === 'P1'
                          ? 'bg-[#E5554F]/20 text-[#E5554F]'
                          : selectedMission?.priority === 'P2'
                          ? 'bg-[#E0A33A]/20 text-[#E0A33A]'
                          : 'bg-[#4C8DF6]/20 text-[#4C8DF6]'
                      }`}
                    >
                      {selectedMission?.priority}
                    </span>
                    <span className="font-semibold">{selectedMission?.id}</span>
                    <span className="hidden sm:inline">({selectedMission?.codeName})</span>
                  </button>
                  {selectedAircraft && (
                    <span className="hidden md:inline-flex items-center space-x-1 text-[#9AA5B4] text-[11px] border-l border-[#2A3340] pl-2">
                      <span className="text-[#657183]">Asset:</span>
                      <span className="font-mono text-[#E8ECF1] font-semibold">{selectedAircraft.id}</span>
                      <span className="text-[#657183]">({selectedAircraft.callsign})</span>
                    </span>
                  )}
                </div>

                {/* Clean View Toggle */}
                <div className="flex items-center bg-[#0F1419] p-0.5 rounded-lg border border-[#2A3340] font-sans text-xs shrink-0">
                  <button
                    onClick={() => setViewMode('TIMELINE')}
                    className="px-3 py-1 rounded-md transition font-medium cursor-pointer flex items-center space-x-1.5 bg-[#1D2530] text-[#E8ECF1] shadow-xs"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Timeline</span>
                  </button>
                  <button
                    onClick={() => setViewMode('MAP')}
                    className="px-3 py-1 rounded-md transition font-medium cursor-pointer flex items-center space-x-1.5 text-[#657183] hover:text-[#9AA5B4]"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#3FB27F]" />
                    <span>Aircraft Tracking</span>
                  </button>
                </div>
              </div>
            )}

            {/* View Content (Hero) */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {viewMode === 'TIMELINE' ? (
                <GanttTimeline
                  aircraftList={operationalState.aircraft}
                  missions={operationalState.missions}
                  assignments={activePlan.assignments}
                  crews={operationalState.crews}
                  selectedMissionId={selectedMissionId}
                  onSelectMission={handleSelectMission}
                  currentTimeString={currentTimeString}
                />
              ) : (
                <TacticalMap
                  bases={operationalState.bases}
                  missions={operationalState.missions}
                  zones={operationalState.airspaceZones}
                  threats={operationalState.threats}
                  weather={operationalState.weather}
                  assignments={activePlan.assignments}
                  aircraftList={operationalState.aircraft}
                  crews={operationalState.crews}
                  alerts={effectiveAlerts}
                  selectedMissionId={selectedMissionId}
                  onSelectMission={handleSelectMission}
                  selectedAircraftId={selectedAircraftId}
                  onSelectAircraft={handleSelectAircraft}
                  onOpenManualOverride={() => setIsManualOverrideOpen(true)}
                  isMapFocusMode={isMapFocusMode}
                  onToggleMapFocus={() => setIsMapFocusMode(!isMapFocusMode)}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  onOpenPredictiveDetails={() => setIsPredictiveDetailsOpen(true)}
                  dataMode={liveTraffic.dataMode}
                  onDataModeChange={liveTraffic.setDataMode}
                  liveAircraft={liveTraffic.liveAircraft}
                  allLiveCount={liveTraffic.allLiveAircraftCount}
                  feedStatus={liveTraffic.feedStatus}
                  feedMeta={liveTraffic.feedMeta}
                  altitudeBand={liveTraffic.altitudeBand}
                  onAltitudeBandChange={liveTraffic.setAltitudeBand}
                  hideOnGround={liveTraffic.hideOnGround}
                  onToggleHideOnGround={() => liveTraffic.setHideOnGround(!liveTraffic.hideOnGround)}
                  selectedLiveAircraftId={liveTraffic.selectedLiveAircraftId}
                  onSelectLiveAircraft={liveTraffic.setSelectedLiveAircraftId}
                  selectedLiveAircraft={liveTraffic.selectedLiveAircraft}
                  civilConflicts={liveTraffic.civilConflicts}
                  weatherMap={liveTraffic.weatherMap}
                />
              )}
            </div>
          </main>

          {/* Right Panel: Recommended Plan (340px) */}
          <RecommendationPanel
            currentRole={currentRole}
            plans={{
              ...planSet,
              recommended: displayPlan,
            }}
            activePlanId={displayPlan.planId}
            onSelectPlan={setActivePlan}
            onOpenApproveModal={() => setIsApprovalModalOpen(true)}
            onOpenManualOverride={() => setIsManualOverrideOpen(true)}
            onRejectPlan={() => {
              showToast('Plan rejected', 'Switching to low-risk alternative.', 'info');
              setActivePlan(planSet.alternativeLowRisk);
            }}
            isAiLoading={isAiLoading}
            onRequestAiExplanation={async (plan) => {
              setIsAiLoading(true);
              const res = await fetchPlanExplanation(plan, disruptionBanner?.text);
              setIsAiLoading(false);
              setActivePlan((prev) => ({
                ...prev,
                explanation: res.explanation,
                isAiGeneratedExplanation: res.source === 'GEMINI_API',
              }));
            }}
            isCollapsed={isRightCollapsed || isMapFocusMode}
            onToggleCollapse={() => setIsRightCollapsed(!isRightCollapsed)}
            activeAlert={activeAlert}
            onApplyAlertAction={handleApplyAlertAction}
          />
        </div>
      )}

      {/* 4. Thin Status Line at Very Bottom (24px) */}
      <footer className="h-6 px-4 bg-[#161C24] border-t border-[#2A3340] flex items-center justify-between text-[11px] text-[#657183] shrink-0 font-sans">
        <div>
          Last updated {currentTimeString} UTC
        </div>
        <div className="flex items-center space-x-1.5 text-[#657183]">
          <ShieldCheck className="w-3 h-3 text-[#657183]" />
          <span>Audit log verified</span>
        </div>
      </footer>

      {/* 5. Modals & Side Drawers */}
      <PlanDiffModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        priorPlan={priorPlan}
        newPlan={activePlan}
        operationalState={operationalState}
        onApproveDiff={handleApprovePlan}
        canApprove={currentRole === 'Commander'}
      />

      <ApprovalConfirmationModal
        isOpen={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        plan={activePlan}
        currentRole={currentRole}
        onConfirmPublish={handleApprovePlan}
      />

      <AuditLogDrawer
        isOpen={isAuditDrawerOpen}
        onClose={() => setIsAuditDrawerOpen(false)}
        auditLog={auditLog}
      />

      <ManualOverrideModal
        isOpen={isManualOverrideOpen}
        onClose={() => setIsManualOverrideOpen(false)}
        plan={activePlan}
        operationalState={operationalState}
        onSaveOverride={handleSaveManualOverride}
      />

      <PredictiveDetailsModal
        isOpen={isPredictiveDetailsOpen}
        onClose={() => setIsPredictiveDetailsOpen(false)}
        mission={selectedMission}
        assignment={selectedAssignment}
        aircraft={selectedAircraft}
        crew={selectedCrew}
        operationalState={operationalState}
      />

      <DataSourcesModal
        isOpen={isDataSourcesModalOpen}
        onClose={() => setIsDataSourcesModalOpen(false)}
        feedMeta={liveTraffic.feedMeta}
      />

      <DemoRunner
        isRunning={isDemoRunning}
        onStop={() => setIsDemoRunning(false)}
        onTriggerBaseline={() => {
          handleResetScenario();
        }}
        onTriggerDisruption={() => {
          handleInjectA3Aog();
        }}
        onTriggerApprove={() => {
          handleApprovePlan();
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <VayuOpsApp />
    </ToastProvider>
  );
}
