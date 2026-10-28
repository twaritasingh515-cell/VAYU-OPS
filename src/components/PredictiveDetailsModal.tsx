import React from 'react';
import { X } from 'lucide-react';
import {
  Aircraft,
  Crew,
  LiveOperationalState,
  Mission,
  MissionAssignment,
} from '../types/ops';
import {
  calculateAircraftServiceability,
  calculateCrewFatigue,
  calculateThreatRisk,
  calculateWeatherImpact,
} from '../services/predictiveAnalytics';

interface PredictiveDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mission: Mission | null;
  assignment: MissionAssignment | null;
  aircraft: Aircraft | null;
  crew: Crew | null;
  operationalState: LiveOperationalState;
}

export const PredictiveDetailsModal: React.FC<PredictiveDetailsModalProps> = ({
  isOpen,
  onClose,
  mission,
  aircraft,
  crew,
  operationalState,
}) => {
  if (!isOpen || !mission) return null;

  const weather = calculateWeatherImpact(mission, operationalState);
  const threat = calculateThreatRisk(mission, operationalState, aircraft);
  const serv = aircraft ? calculateAircraftServiceability(aircraft) : null;
  const fat = crew ? calculateCrewFatigue(crew) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-[#161C24] border border-[#2A3340] rounded-lg shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col text-[#E8ECF1] font-sans overflow-hidden">
        {/* Header */}
        <div className="h-12 px-4 border-b border-[#2A3340] flex items-center justify-between">
          <div className="font-medium text-sm text-[#E8ECF1]">
            {mission.id} — {mission.codeName}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#657183] hover:text-[#E8ECF1] rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Mission Details */}
          <div className="bg-[#1D2530] p-3.5 rounded-lg border border-[#2A3340]/60 space-y-2">
            <span className="text-[11px] font-medium text-[#657183] block">Target profile</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[#657183]">Location: </span>
                <span className="text-[#E8ECF1]">{mission.targetLocation.name}</span>
              </div>
              <div>
                <span className="text-[#657183]">Sector: </span>
                <span className="text-[#E8ECF1]">{mission.targetLocation.sector}</span>
              </div>
              <div>
                <span className="text-[#657183]">Time window: </span>
                <span className="text-[#E8ECF1] font-mono">{mission.timeWindowStart}–{mission.timeWindowEnd}Z</span>
              </div>
              <div>
                <span className="text-[#657183]">Priority: </span>
                <span className="text-[#E8ECF1] font-mono">{mission.priority}</span>
              </div>
            </div>
          </div>

          {/* Threat Model */}
          <div className="bg-[#1D2530] p-3.5 rounded-lg border border-[#2A3340]/60 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-medium text-[#E8ECF1]">Threat evaluation</span>
              <span className="font-mono text-xs text-[#E8ECF1]">{threat.riskScore}% risk</span>
            </div>
            <p className="text-[#9AA5B4] text-[11px] leading-relaxed">{threat.explanation}</p>
          </div>

          {/* Weather Model */}
          <div className="bg-[#1D2530] p-3.5 rounded-lg border border-[#2A3340]/60 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-medium text-[#E8ECF1]">Weather conditions</span>
              <span className="font-mono text-xs text-[#E8ECF1]">{weather.impactScore}% impact</span>
            </div>
            <p className="text-[#9AA5B4] text-[11px] leading-relaxed">{weather.explanation}</p>
          </div>

          {/* Assigned Platform & Pilot */}
          {aircraft && serv && (
            <div className="bg-[#1D2530] p-3.5 rounded-lg border border-[#2A3340]/60 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-medium text-[#E8ECF1]">Platform: {aircraft.id} ({aircraft.callsign})</span>
                <span className="font-mono text-xs text-[#3FB27F]">{serv.probabilityPercent}% available</span>
              </div>
              <p className="text-[#9AA5B4] text-[11px] leading-relaxed">{serv.explanation}</p>
            </div>
          )}

          {crew && fat && (
            <div className="bg-[#1D2530] p-3.5 rounded-lg border border-[#2A3340]/60 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-medium text-[#E8ECF1]">Pilot: {crew.name}</span>
                <span className="font-mono text-xs text-[#E8ECF1]">{fat.fatigueScore}% fatigue</span>
              </div>
              <p className="text-[#9AA5B4] text-[11px] leading-relaxed">{fat.explanation}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0F1419] border-t border-[#2A3340] flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md text-xs text-[#9AA5B4] hover:text-[#E8ECF1] transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
