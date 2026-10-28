import React from 'react';
import { X, Check } from 'lucide-react';
import { GeneratedPlan, LiveOperationalState } from '../types/ops';

interface PlanDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  priorPlan: GeneratedPlan | null;
  newPlan: GeneratedPlan;
  operationalState: LiveOperationalState;
  onApproveDiff: () => void;
  canApprove: boolean;
}

export const PlanDiffModal: React.FC<PlanDiffModalProps> = ({
  isOpen,
  onClose,
  priorPlan,
  newPlan,
  operationalState,
  onApproveDiff,
  canApprove,
}) => {
  if (!isOpen) return null;

  // Build clean diff per mission
  const diffRows = operationalState.missions.map((mission) => {
    const prior = priorPlan?.assignments.find((a) => a.missionId === mission.id);
    const curr = newPlan.assignments.find((a) => a.missionId === mission.id);

    const priorAc = operationalState.aircraft.find((a) => a.id === prior?.aircraftId);
    const currAc = operationalState.aircraft.find((a) => a.id === curr?.aircraftId);

    let changeType: 'UNMODIFIED' | 'CHANGED' | 'ADDED' | 'UNASSIGNED' = 'UNMODIFIED';
    let reason = 'Retained assignment';

    if (!prior?.aircraftId && curr?.aircraftId) {
      changeType = 'ADDED';
      reason = 'Newly assigned platform';
    } else if (prior?.aircraftId && !curr?.aircraftId) {
      changeType = 'UNASSIGNED';
      reason = 'Reassigned to higher priority sortie';
    } else if (prior?.aircraftId !== curr?.aircraftId || prior?.crewId !== curr?.crewId) {
      changeType = 'CHANGED';
      if (priorAc?.status === 'AOG') {
        reason = `${priorAc.id} unserviceable`;
      } else {
        reason = 'Optimised endurance and risk profile';
      }
    }

    return {
      mission,
      priorAc,
      currAc,
      changeType,
      reason,
    };
  });

  const changedRows = diffRows.filter((r) => r.changeType !== 'UNMODIFIED');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-[#161C24] border border-[#2A3340] rounded-lg shadow-xl w-full max-w-lg overflow-hidden text-[#E8ECF1] font-sans">
        {/* Header */}
        <div className="h-12 px-4 border-b border-[#2A3340] flex items-center justify-between">
          <div className="font-medium text-sm text-[#E8ECF1]">
            Plan changes ({changedRows.length})
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#657183] hover:text-[#E8ECF1] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Changes List */}
        <div className="p-4 space-y-2 text-xs">
          {changedRows.length === 0 ? (
            <div className="text-center py-6 text-[#657183]">No changes vs previous plan.</div>
          ) : (
            changedRows.map((row) => {
              const dotColor =
                row.changeType === 'ADDED'
                  ? 'bg-[#3FB27F]'
                  : row.changeType === 'UNASSIGNED'
                  ? 'bg-[#E5554F]'
                  : 'bg-[#E0A33A]';

              return (
                <div
                  key={row.mission.id}
                  className="p-3 bg-[#1D2530] rounded-md border border-[#2A3340]/60 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
                    <div>
                      <span className="font-mono font-medium text-[#E8ECF1]">{row.mission.id}</span>
                      <span className="text-[#9AA5B4] ml-2">
                        {row.priorAc?.id || 'None'} &rarr;{' '}
                        <span className="text-[#E8ECF1] font-medium">{row.currAc?.id || 'Unassigned'}</span>
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] text-[#657183]">
                    {row.reason}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0F1419] border-t border-[#2A3340] flex items-center justify-end space-x-2 text-xs">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[#9AA5B4] hover:text-[#E8ECF1] transition"
          >
            Dismiss
          </button>
          <button
            disabled={!canApprove}
            onClick={() => {
              onApproveDiff();
              onClose();
            }}
            className={`px-3 py-1.5 rounded-md font-medium flex items-center space-x-1.5 transition ${
              canApprove
                ? 'bg-[#4C8DF6] hover:bg-[#3B7DE8] text-white'
                : 'bg-[#1D2530] text-[#657183] cursor-not-allowed'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Approve plan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
