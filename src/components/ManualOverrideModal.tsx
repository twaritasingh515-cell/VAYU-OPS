import React, { useState } from 'react';
import { X, Check, AlertTriangle } from 'lucide-react';
import {
  GeneratedPlan,
  LiveOperationalState,
  MissionAssignment,
} from '../types/ops';
import { timeOverlaps } from '../services/optimiser';

interface ManualOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: GeneratedPlan;
  operationalState: LiveOperationalState;
  onSaveOverride: (updatedAssignments: MissionAssignment[]) => void;
}

export const ManualOverrideModal: React.FC<ManualOverrideModalProps> = ({
  isOpen,
  onClose,
  plan,
  operationalState,
  onSaveOverride,
}) => {
  if (!isOpen) return null;

  const [assignments, setAssignments] = useState<MissionAssignment[]>(
    JSON.parse(JSON.stringify(plan.assignments))
  );

  const handleAircraftChange = (missionId: string, aircraftId: string) => {
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.missionId === missionId) {
          return {
            ...a,
            aircraftId: aircraftId === 'NONE' ? null : aircraftId,
          };
        }
        return a;
      })
    );
  };

  const handleCrewChange = (missionId: string, crewId: string) => {
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.missionId === missionId) {
          return {
            ...a,
            crewId: crewId === 'NONE' ? null : crewId,
          };
        }
        return a;
      })
    );
  };

  const getAssignmentWarnings = (asgn: MissionAssignment) => {
    const warnings: string[] = [];
    const mission = operationalState.missions.find((m) => m.id === asgn.missionId);
    if (!mission) return warnings;

    if (!asgn.aircraftId) {
      warnings.push('No aircraft assigned');
      return warnings;
    }

    const aircraft = operationalState.aircraft.find((a) => a.id === asgn.aircraftId);
    if (!aircraft) return warnings;

    if (aircraft.status === 'AOG') {
      warnings.push(`Aircraft ${aircraft.id} is unserviceable (AOG)`);
    }

    if (aircraft.role !== mission.requiredRole) {
      warnings.push(`Role mismatch: ${aircraft.id} is ${aircraft.role}, requires ${mission.requiredRole}`);
    }

    for (const other of assignments) {
      if (other.missionId !== asgn.missionId && other.aircraftId === asgn.aircraftId) {
        const otherMission = operationalState.missions.find((m) => m.id === other.missionId);
        if (otherMission) {
          if (timeOverlaps(mission.timeWindowStart, mission.timeWindowEnd, otherMission.timeWindowStart, otherMission.timeWindowEnd)) {
            warnings.push(`Time conflict with ${otherMission.id}`);
          }
        }
      }
    }

    if (asgn.crewId) {
      const crew = operationalState.crews.find((c) => c.id === asgn.crewId);
      if (crew) {
        if (!crew.qualifications.includes(mission.requiredRole)) {
          warnings.push(`Crew ${crew.name} lacks ${mission.requiredRole} endorsement`);
        }
        if (crew.fatigueScore > 75) {
          warnings.push(`Crew ${crew.name} exceeds rest limits (fatigue ${crew.fatigueScore})`);
        }
      }
    }

    return warnings;
  };

  const handleSave = () => {
    onSaveOverride(assignments);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-[#161C24] border border-[#2A3340] rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col text-[#E8ECF1] font-sans overflow-hidden">
        {/* Header */}
        <div className="h-12 px-4 border-b border-[#2A3340] flex items-center justify-between">
          <div className="font-medium text-sm text-[#E8ECF1]">
            Manual assignment override
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#657183] hover:text-[#E8ECF1] rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Assignments rows */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-[#2A3340]/50 space-y-3">
          {operationalState.missions.map((mission) => {
            const asgn = assignments.find((a) => a.missionId === mission.id) || {
              missionId: mission.id,
              aircraftId: null,
              crewId: null,
              weaponTypeId: null,
              weaponQuantity: 0,
              predictedRisk: 50,
              serviceabilityScore: 50,
              weatherImpactScore: 50,
              crewFatigueScore: 50,
              compositeScore: 0,
              constraintViolations: [],
            };

            const warnings = getAssignmentWarnings(asgn);

            return (
              <div key={mission.id} className="pt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[#E8ECF1] font-medium">{mission.id}</span>
                    <span className="font-medium text-[#E8ECF1]">{mission.codeName}</span>
                    <span className="text-[#657183]">({mission.requiredRole})</span>
                  </div>
                  <span className="font-mono text-[11px] text-[#657183]">
                    {mission.timeWindowStart}–{mission.timeWindowEnd}Z
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-[#657183] block mb-1">Aircraft</label>
                    <select
                      value={asgn.aircraftId || 'NONE'}
                      onChange={(e) => handleAircraftChange(mission.id, e.target.value)}
                      className="w-full bg-[#0F1419] border border-[#2A3340] rounded px-2.5 py-1.5 text-xs text-[#E8ECF1] focus:outline-none focus:border-[#4C8DF6]"
                    >
                      <option value="NONE">Unassigned</option>
                      {operationalState.aircraft.map((ac) => (
                        <option key={ac.id} value={ac.id}>
                          {ac.id} ({ac.model.split(' ')[0]}) — {ac.role} [{ac.status}]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-[#657183] block mb-1">Pilot</label>
                    <select
                      value={asgn.crewId || 'NONE'}
                      onChange={(e) => handleCrewChange(mission.id, e.target.value)}
                      className="w-full bg-[#0F1419] border border-[#2A3340] rounded px-2.5 py-1.5 text-xs text-[#E8ECF1] focus:outline-none focus:border-[#4C8DF6]"
                    >
                      <option value="NONE">Unassigned</option>
                      {operationalState.crews.map((cr) => (
                        <option key={cr.id} value={cr.id}>
                          {cr.name} ({cr.qualifications.join(',')})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {warnings.length > 0 && (
                  <div className="p-2 rounded bg-[#E5554F]/10 border border-[#E5554F]/30 text-[11px] text-[#E5554F] space-y-0.5">
                    {warnings.map((w, idx) => (
                      <div key={idx} className="flex items-center space-x-1.5">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0F1419] border-t border-[#2A3340] flex items-center justify-end space-x-2 text-xs">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[#9AA5B4] hover:text-[#E8ECF1] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3.5 py-1.5 rounded-md bg-[#4C8DF6] hover:bg-[#3B7DE8] text-white font-medium flex items-center space-x-1.5 transition"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply override</span>
          </button>
        </div>
      </div>
    </div>
  );
};
