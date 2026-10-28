import React from 'react';
import {
  Target,
  ShieldAlert,
  CloudRain,
  Crosshair,
  User,
  Plane,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  Aircraft,
  Crew,
  LiveOperationalState,
  Mission,
  MissionAssignment,
} from '../types/ops';
import {
  calculateThreatRisk,
  calculateWeatherImpact,
} from '../services/predictiveAnalytics';

interface MissionsPanelProps {
  missions: Mission[];
  selectedMissionId: string | null;
  onSelectMission: (id: string) => void;
  assignments: MissionAssignment[];
  aircraftList: Aircraft[];
  crews: Crew[];
  operationalState: LiveOperationalState;
}

export const MissionsPanel: React.FC<MissionsPanelProps> = ({
  missions,
  selectedMissionId,
  onSelectMission,
  assignments,
  aircraftList,
  crews,
  operationalState,
}) => {
  const getPriorityBadge = (p: Mission['priority']) => {
    switch (p) {
      case 'P1':
        return 'bg-rose-950 text-rose-300 border-rose-600 font-bold';
      case 'P2':
        return 'bg-amber-950 text-amber-300 border-amber-600';
      case 'P3':
        return 'bg-cyan-950 text-cyan-300 border-cyan-700';
    }
  };

  const getRoleBadge = (role: Mission['requiredRole']) => {
    switch (role) {
      case 'CAP':
        return 'text-sky-400 bg-sky-950/80 border-sky-800';
      case 'Strike':
        return 'text-amber-400 bg-amber-950/80 border-amber-800';
      case 'ISR':
        return 'text-emerald-400 bg-emerald-950/80 border-emerald-800';
      case 'Transport':
        return 'text-purple-400 bg-purple-950/80 border-purple-800';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-100 select-none">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Target className="w-4 h-4 text-amber-400" />
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            Active Taskings ({missions.length})
          </h2>
        </div>
        <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>ATO Cycle #04</span>
        </div>
      </div>

      {/* Priority Ribbon Summary */}
      <div className="px-3 py-1.5 bg-slate-950/70 border-b border-slate-850 flex items-center justify-between text-[11px] font-mono">
        <span className="text-slate-400">Priority Breakdown:</span>
        <div className="flex items-center space-x-2">
          <span className="text-rose-400 font-bold">P1: {missions.filter((m) => m.priority === 'P1').length}</span>
          <span className="text-slate-600">•</span>
          <span className="text-amber-400">P2: {missions.filter((m) => m.priority === 'P2').length}</span>
          <span className="text-slate-600">•</span>
          <span className="text-cyan-400">P3: {missions.filter((m) => m.priority === 'P3').length}</span>
        </div>
      </div>

      {/* Mission List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 p-1.5 space-y-1">
        {missions.map((mission) => {
          const isSelected = selectedMissionId === mission.id;
          const assignment = assignments.find((a) => a.missionId === mission.id);
          const assignedAircraft = aircraftList.find((a) => a.id === assignment?.aircraftId);
          const assignedCrew = crews.find((c) => c.id === assignment?.crewId);

          const weather = calculateWeatherImpact(mission, operationalState);
          const threat = calculateThreatRisk(mission, operationalState, assignedAircraft);

          return (
            <div
              key={mission.id}
              onClick={() => onSelectMission(mission.id)}
              className={`p-2.5 rounded transition cursor-pointer text-xs ${
                isSelected
                  ? 'bg-slate-800 border border-amber-500/70 shadow-md'
                  : 'bg-slate-900/60 hover:bg-slate-850 border border-slate-800/50'
              }`}
            >
              {/* Mission Header */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-amber-300">{mission.id}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono border ${getPriorityBadge(
                      mission.priority
                    )}`}
                  >
                    {mission.priority}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono border ${getRoleBadge(
                      mission.requiredRole
                    )}`}
                  >
                    {mission.requiredRole}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  {mission.timeWindowStart}–{mission.timeWindowEnd}
                </span>
              </div>

              {/* Codename & Target */}
              <div className="mb-2">
                <div className="font-semibold text-slate-200 truncate">{mission.codeName}</div>
                <div className="text-[11px] text-slate-400 flex items-center space-x-1 truncate font-mono">
                  <Crosshair className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="truncate">{mission.targetLocation.name}</span>
                </div>
              </div>

              {/* Asset Assignment Pill */}
              <div className="bg-slate-950/80 rounded p-1.5 border border-slate-850 mb-2 font-mono text-[11px]">
                {assignedAircraft ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-cyan-300">
                      <Plane className="w-3 h-3 text-cyan-400" />
                      <span className="font-bold">{assignedAircraft.id}</span>
                      <span className="text-[10px] text-slate-400">({assignedAircraft.callsign})</span>
                    </div>
                    {assignedCrew && (
                      <div className="flex items-center space-x-1 text-slate-300">
                        <User className="w-3 h-3 text-slate-400" />
                        <span className="truncate max-w-[90px]">{assignedCrew.name.split(' ')[0]}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-rose-400 flex items-center justify-between">
                    <span>UNASSIGNED</span>
                    <span className="text-[10px] bg-rose-950 px-1 rounded border border-rose-800">Alert</span>
                  </div>
                )}
              </div>

              {/* Risk & Weather Badges */}
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800">
                <div className="flex items-center space-x-2">
                  <span
                    className={`flex items-center space-x-0.5 px-1 rounded ${
                      threat.riskScore > 65
                        ? 'text-rose-300 bg-rose-950/70 border border-rose-800'
                        : threat.riskScore > 35
                        ? 'text-amber-300 bg-amber-950/70 border border-amber-800'
                        : 'text-emerald-300 bg-emerald-950/70 border border-emerald-800'
                    }`}
                    title={threat.explanation}
                  >
                    <ShieldAlert className="w-3 h-3" />
                    <span>Threat: {threat.riskScore}%</span>
                  </span>

                  <span
                    className={`flex items-center space-x-0.5 px-1 rounded ${
                      weather.impactScore > 50
                        ? 'text-amber-300 bg-amber-950/70'
                        : 'text-cyan-300 bg-cyan-950/70'
                    }`}
                    title={weather.explanation}
                  >
                    <CloudRain className="w-3 h-3" />
                    <span>Wx: {weather.impactScore}%</span>
                  </span>
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
