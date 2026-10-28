import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plane } from 'lucide-react';
import { Aircraft, Crew, Mission, MissionAssignment } from '../types/ops';
import { timeToMinutes } from '../services/optimiser';

interface GanttTimelineProps {
  aircraftList: Aircraft[];
  missions: Mission[];
  assignments: MissionAssignment[];
  crews: Crew[];
  selectedMissionId: string | null;
  onSelectMission: (id: string) => void;
  currentTimeString?: string;
}

export const GanttTimeline: React.FC<GanttTimelineProps> = ({
  aircraftList,
  missions,
  assignments,
  crews,
  selectedMissionId,
  onSelectMission,
  currentTimeString = '09:20:00',
}) => {
  // Timeline scale: 06:00 to 21:00 (15 hours = 900 minutes) providing generous runway buffer
  const DAY_START_MIN = 6 * 60;
  const DAY_END_MIN = 21 * 60;
  const TOTAL_MINUTES = DAY_END_MIN - DAY_START_MIN;

  // Hour labels every 2 hours in sentence-case "06:00" format + 21:00 boundary
  const hoursMarks = [6, 8, 10, 12, 14, 16, 18, 20, 21];

  const getPositionPercent = (timeStr: string) => {
    const mins = timeToMinutes(timeStr);
    const clamped = Math.max(DAY_START_MIN, Math.min(DAY_END_MIN, mins));
    return ((clamped - DAY_START_MIN) / TOTAL_MINUTES) * 100;
  };

  const getWidthPercent = (startStr: string, endStr: string) => {
    const s = timeToMinutes(startStr);
    const e = timeToMinutes(endStr);
    const dur = Math.max(40, e - s);
    return (dur / TOTAL_MINUTES) * 100;
  };

  // Hover Tooltip
  const [hoveredMission, setHoveredMission] = useState<{
    mission: Mission;
    asgn?: MissionAssignment;
    aircraft?: Aircraft;
    crew?: Crew;
    x: number;
    y: number;
  } | null>(null);

  // Collapsible Idle Aircraft
  const [isIdleExpanded, setIsIdleExpanded] = useState(false);

  // Group aircraft: active (has assigned missions or is AOG/maintenance) vs idle (serviceable & no assignments)
  const activeAircraft: Aircraft[] = [];
  const idleAircraft: Aircraft[] = [];

  aircraftList.forEach((ac) => {
    const hasMissions = assignments.some((a) => a.aircraftId === ac.id);
    if (hasMissions || ac.status !== 'Serviceable') {
      activeAircraft.push(ac);
    } else {
      idleAircraft.push(ac);
    }
  });

  const nowMinutes = timeToMinutes(currentTimeString.slice(0, 5));
  const nowPercent = Math.max(0, Math.min(100, ((nowMinutes - DAY_START_MIN) / TOTAL_MINUTES) * 100));

  const renderAircraftRow = (ac: Aircraft) => {
    const assignedMissionIds = assignments
      .filter((a) => a.aircraftId === ac.id)
      .map((a) => a.missionId);

    const acMissions = missions.filter((m) => assignedMissionIds.includes(m.id));
    const isAog = ac.status === 'AOG';
    const isMaint = ac.status === 'Maintenance';

    return (
      <div
        key={ac.id}
        className={`flex items-center h-12 transition-colors ${
          isAog ? 'bg-[#E5554F]/5' : 'hover:bg-[#1D2530]/40'
        }`}
      >
        {/* Left aircraft label (w-44, clear and uncompressed) */}
        <div className="w-44 shrink-0 px-4 flex items-center justify-between border-r border-[#2A3340]/60">
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-mono font-semibold text-xs text-[#E8ECF1]">{ac.id}</span>
              <span className="text-[11px] text-[#657183]">{ac.role}</span>
            </div>
            <div className="text-[11px] text-[#9AA5B4] truncate max-w-[110px]" title={ac.callsign}>
              {ac.callsign}
            </div>
          </div>

          {isAog && <span className="text-[11px] text-[#E5554F] font-bold font-mono">AOG</span>}
          {isMaint && <span className="text-[11px] text-[#E0A33A] font-medium font-mono">Maint</span>}
        </div>

        {/* Timeline Track (min-w-[840px] with right runway buffer) */}
        <div
          className={`relative flex-1 min-w-[840px] h-full ${
            isAog ? 'bg-hatched-aog' : isMaint ? 'bg-hatched-maint' : ''
          }`}
        >
          {/* Subtle 2-hour grid dividers */}
          {hoursMarks.map((hr) => {
            const left = ((hr * 60 - DAY_START_MIN) / TOTAL_MINUTES) * 100;
            return (
              <div
                key={hr}
                className="absolute top-0 bottom-0 border-l border-[#2A3340]/30 pointer-events-none"
                style={{ left: `${left}%` }}
              />
            );
          })}

          {/* Mission Blocks with Anti-Clipping Guard */}
          {acMissions.map((m) => {
            const left = Math.max(0, Math.min(92, getPositionPercent(m.timeWindowStart)));
            const rawWidth = getWidthPercent(m.timeWindowStart, m.timeWindowEnd);
            // Cap width so card is never clipped by track edge
            const width = Math.min(rawWidth, Math.max(7, 98 - left));
            const isSelected = selectedMissionId === m.id;
            const asgn = assignments.find((a) => a.missionId === m.id);
            const crew = crews.find((c) => c.id === asgn?.crewId);

            // Clean distinct styling based on priority
            let bgFill = 'bg-[#2563EB]/20 text-[#E8ECF1] border border-[#2563EB]/40';
            let priorityBadgeColor = 'bg-[#2563EB] text-white';
            if (m.priority === 'P1') {
              bgFill = 'bg-[#E5554F]/20 text-[#E8ECF1] border border-[#E5554F]/40';
              priorityBadgeColor = 'bg-[#E5554F] text-white';
            } else if (m.priority === 'P2') {
              bgFill = 'bg-[#E0A33A]/20 text-[#E8ECF1] border border-[#E0A33A]/40';
              priorityBadgeColor = 'bg-[#E0A33A] text-white';
            }

            const showFullName = width >= 14;

            return (
              <div
                key={m.id}
                onClick={() => onSelectMission(m.id)}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredMission({
                    mission: m,
                    asgn,
                    aircraft: ac,
                    crew,
                    x: rect.left,
                    y: rect.top,
                  });
                }}
                onMouseLeave={() => setHoveredMission(null)}
                className={`absolute top-2 bottom-2 rounded-md px-2 flex items-center justify-between text-xs cursor-pointer transition-all overflow-hidden ${bgFill} ${
                  isSelected
                    ? 'ring-2 ring-[#2563EB] ring-offset-1 ring-offset-[#161C24] font-medium shadow-sm z-10'
                    : 'hover:brightness-110'
                }`}
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                <div className="flex items-center space-x-1.5 min-w-0 overflow-hidden">
                  <span className={`text-[9px] px-1 py-0.2 rounded font-bold shrink-0 ${priorityBadgeColor}`}>
                    {m.priority}
                  </span>
                  <span className="truncate text-xs font-medium">
                    {showFullName ? m.codeName : m.id}
                  </span>
                </div>
                {showFullName && (
                  <span className="text-[10px] text-[#9AA5B4] font-mono ml-1 shrink-0">
                    {m.id}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#161C24] select-none overflow-hidden relative font-sans">
      {/* Subtle Legend Line above Timeline */}
      <div className="h-7 px-4 border-b border-[#2A3340]/60 bg-[#161C24] flex items-center justify-between text-xs text-[#9AA5B4] shrink-0">
        <div className="flex items-center space-x-4 text-[11px]">
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#E5554F]" />
            <span className="text-[#9AA5B4]">P1</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#E0A33A]" />
            <span className="text-[#9AA5B4]">P2</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#4C8DF6]" />
            <span className="text-[#9AA5B4]">P3</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-3.5 h-2 rounded-sm bg-hatched-aog border border-[#E5554F]/30" />
            <span className="text-[#657183]">Unavailable</span>
          </span>
        </div>

        <div className="text-[11px] text-[#657183] font-sans">
          Click mission to inspect details
        </div>
      </div>

      {/* Timeline Scrollable Viewport with widened time axis (min-w-[1040px]) */}
      <div className="flex-1 overflow-x-auto overflow-y-auto relative scrollbar-thin">
        <div className="min-w-[1040px] flex flex-col pr-8">
          {/* Time Scale Header (Sentence-case 06:00 format, single UTC label) */}
          <div className="h-8 border-b border-[#2A3340] bg-[#161C24] flex items-center text-xs text-[#657183] shrink-0 font-sans">
            <div className="w-44 shrink-0 px-4 flex items-center justify-between text-[11px] text-[#657183]">
              <span className="font-medium text-[#E8ECF1]">Aircraft Asset</span>
              <span className="text-[10px] text-[#657183] font-mono">UTC</span>
            </div>
            <div className="relative flex-1 min-w-[840px] h-full">
              {hoursMarks.map((hr) => {
                const left = ((hr * 60 - DAY_START_MIN) / TOTAL_MINUTES) * 100;
                return (
                  <div
                    key={hr}
                    className="absolute top-0 bottom-0 border-l border-[#2A3340] flex items-center pl-1.5"
                    style={{ left: `${left}%` }}
                  >
                    <span className="text-[11px] tabular-nums font-sans">
                      {hr.toString().padStart(2, '0')}:00
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vertical "now" line */}
          <div
            className="absolute top-8 bottom-0 z-20 pointer-events-none flex flex-col items-center"
            style={{ left: `calc(176px + (100% - 176px) * ${nowPercent / 100})` }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB] -mt-0.5" />
            <div className="w-px h-full bg-[#2563EB]/70" />
          </div>

          {/* Aircraft Rows */}
          <div className="divide-y divide-[#2A3340]/40">
            {/* Active / Assigned / Unavailable Aircraft Rows */}
            {activeAircraft.map((ac) => renderAircraftRow(ac))}

            {/* Collapsed Idle Aircraft Row */}
            {idleAircraft.length > 0 && (
              <div>
                <button
                  onClick={() => setIsIdleExpanded(!isIdleExpanded)}
                  className="w-full h-10 px-4 bg-[#1D2530]/40 hover:bg-[#1D2530] flex items-center justify-between text-xs text-[#9AA5B4] transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    {isIdleExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[#657183]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[#657183]" />
                    )}
                    <Plane className="w-3.5 h-3.5 text-[#657183]" />
                    <span className="font-medium text-[#E8ECF1]">
                      {idleAircraft.length} aircraft available
                    </span>
                  </div>
                  <span className="text-[11px] text-[#657183]">
                    {isIdleExpanded ? 'Click to collapse' : 'Click to expand'}
                  </span>
                </button>

                {isIdleExpanded && (
                  <div className="divide-y divide-[#2A3340]/30 bg-[#0F1419]/30">
                    {idleAircraft.map((ac) => renderAircraftRow(ac))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hover Tooltip (Full mission details) */}
      {hoveredMission && (
        <div
          className="fixed z-50 bg-[#1D2530] border border-[#2A3340] rounded-lg p-3 text-xs text-[#E8ECF1] shadow-xl pointer-events-none max-w-xs space-y-1 animate-in fade-in"
          style={{
            left: Math.min(window.innerWidth - 300, hoveredMission.x + 20),
            top: Math.max(60, hoveredMission.y - 100),
          }}
        >
          <div className="flex items-center justify-between font-sans text-[11px] pb-1 border-b border-[#2A3340]">
            <span className="font-semibold text-[#E8ECF1]">{hoveredMission.mission.id}</span>
            <span className="text-[#657183]">
              {hoveredMission.mission.timeWindowStart}–{hoveredMission.mission.timeWindowEnd} UTC
            </span>
          </div>
          <div className="font-medium text-xs pt-0.5">{hoveredMission.mission.codeName}</div>
          <div className="text-[11px] text-[#9AA5B4]">
            Target: {hoveredMission.mission.targetLocation.name}
          </div>
          <div className="text-[11px] text-[#9AA5B4] pt-1 border-t border-[#2A3340]">
            Pilot: {hoveredMission.crew?.name || 'Unassigned'} • Role: {hoveredMission.mission.requiredRole}
          </div>
        </div>
      )}
    </div>
  );
};
