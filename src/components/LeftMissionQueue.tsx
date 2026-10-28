import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Aircraft,
  Crew,
  LiveOperationalState,
  Mission,
  MissionAssignment,
} from '../types/ops';

interface LeftMissionQueueProps {
  missions: Mission[];
  selectedMissionId: string | null;
  onSelectMission: (id: string) => void;
  assignments: MissionAssignment[];
  aircraftList: Aircraft[];
  crews: Crew[];
  operationalState: LiveOperationalState;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const LeftMissionQueue: React.FC<LeftMissionQueueProps> = ({
  missions,
  selectedMissionId,
  onSelectMission,
  assignments,
  aircraftList,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'P1' | 'P2' | 'P3'>('ALL');

  const filteredMissions = useMemo(() => {
    return missions.filter((m) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        m.id.toLowerCase().includes(q) ||
        m.codeName.toLowerCase().includes(q) ||
        m.targetLocation.name.toLowerCase().includes(q);

      if (!matchesQuery) return false;
      if (priorityFilter !== 'ALL' && m.priority !== priorityFilter) return false;
      return true;
    });
  }, [missions, searchQuery, priorityFilter]);

  if (isCollapsed) {
    return (
      <div className="w-12 bg-[#161C24] border-r border-[#2A3340] flex flex-col items-center py-3 select-none shrink-0 transition-all duration-200">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded text-[#9AA5B4] hover:text-[#E8ECF1] hover:bg-[#1D2530] transition"
          title="Expand mission list"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-[260px] bg-[#161C24] border-r border-[#2A3340] flex flex-col h-full select-none shrink-0 transition-all duration-200 overflow-hidden font-sans">
      {/* Sidebar Header */}
      <div className="h-10 px-3 border-b border-[#2A3340] flex items-center justify-between text-xs text-[#9AA5B4]">
        <span className="font-medium text-[#E8ECF1]">Missions</span>
        <div className="flex items-center space-x-1">
          <span className="text-[11px] text-[#657183] tabular-nums font-mono">{filteredMissions.length}</span>
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded text-[#657183] hover:text-[#E8ECF1] transition"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="p-2.5 border-b border-[#2A3340] space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#657183]" />
          <input
            id="mission-search-input"
            type="text"
            placeholder="Search missions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0F1419] border border-[#2A3340] rounded-md pl-8 pr-2.5 py-1 text-xs text-[#E8ECF1] placeholder-[#657183] focus:outline-none focus:border-[#4C8DF6]"
          />
        </div>

        {/* Priority Filter Segmented Control */}
        <div className="grid grid-cols-4 gap-0.5 bg-[#0F1419] p-0.5 rounded-md border border-[#2A3340] text-[11px] font-medium text-center">
          {(['ALL', 'P1', 'P2', 'P3'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setPriorityFilter(tab)}
              className={`py-0.5 rounded transition ${
                priorityFilter === tab
                  ? 'bg-[#1D2530] text-[#E8ECF1] font-semibold'
                  : 'text-[#657183] hover:text-[#9AA5B4]'
              }`}
            >
              {tab === 'ALL' ? 'All' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Clean Mission List (No cards-within-cards, clean row hierarchy) */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#2A3340]/40">
        {filteredMissions.length === 0 ? (
          <div className="p-4 text-center text-xs text-[#657183]">No missions found</div>
        ) : (
          filteredMissions.map((mission) => {
            const isSelected = selectedMissionId === mission.id;
            const asgn = assignments.find((a) => a.missionId === mission.id);
            const ac = aircraftList.find((a) => a.id === asgn?.aircraftId);

            // Priority dot color
            const priorityDotColor =
              mission.priority === 'P1'
                ? 'bg-[#E5554F]'
                : mission.priority === 'P2'
                ? 'bg-[#E0A33A]'
                : 'bg-[#4C8DF6]';

            // Status color & label
            let statusDot = 'bg-[#3FB27F]';
            let statusText = 'Assigned';
            if (mission.status === 'Approved') {
              statusText = 'Approved';
            } else if (!ac) {
              statusDot = 'bg-[#E5554F]';
              statusText = 'Unassigned';
            } else if (asgn && asgn.predictedRisk > 65) {
              statusDot = 'bg-[#E0A33A]';
              statusText = 'At risk';
            }

            return (
              <div
                key={mission.id}
                onClick={() => onSelectMission(mission.id)}
                className={`px-3 py-2.5 transition-colors cursor-pointer relative ${
                  isSelected ? 'bg-[#1D2530]' : 'hover:bg-[#1D2530]/50'
                }`}
              >
                {/* Left accent indicator bar when selected */}
                {isSelected && (
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#4C8DF6]" />
                )}

                {/* Line 1: Priority dot + mission name */}
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${priorityDotColor} shrink-0`} />
                    <span className="font-medium text-xs text-[#E8ECF1] truncate">
                      {mission.codeName}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-[#657183] shrink-0 ml-1">
                    {mission.id}
                  </span>
                </div>

                {/* Line 2: Time window subtitle */}
                <div className="text-[11px] text-[#657183] font-mono mb-1 pl-3.5">
                  {mission.timeWindowStart}–{mission.timeWindowEnd}Z • {mission.requiredRole}
                </div>

                {/* Line 3: Assigned aircraft & small status text */}
                <div className="flex items-center justify-between text-[11px] pl-3.5">
                  <span className="text-[#9AA5B4]">
                    {ac ? `${ac.id} (${ac.callsign})` : 'No asset'}
                  </span>
                  <span className="flex items-center space-x-1 text-[11px] text-[#657183]">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                    <span>{statusText}</span>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
