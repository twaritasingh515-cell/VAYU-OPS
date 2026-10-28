import React from 'react';
import { X, Check } from 'lucide-react';
import { GeneratedPlan, UserRole } from '../types/ops';

interface ApprovalConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: GeneratedPlan;
  currentRole: UserRole;
  onConfirmPublish: () => void;
}

export const ApprovalConfirmationModal: React.FC<ApprovalConfirmationModalProps> = ({
  isOpen,
  onClose,
  plan,
  currentRole,
  onConfirmPublish,
}) => {
  if (!isOpen) return null;

  const isCommander = currentRole === 'Commander';
  const assignedCount = plan.assignments.filter((a) => a.aircraftId !== null).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-[#161C24] border border-[#2A3340] rounded-lg shadow-xl w-full max-w-md overflow-hidden text-[#E8ECF1] font-sans">
        {/* Header */}
        <div className="h-12 px-4 border-b border-[#2A3340] flex items-center justify-between">
          <div className="font-medium text-sm text-[#E8ECF1]">
            Approve air tasking plan
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#657183] hover:text-[#E8ECF1] rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {!isCommander ? (
            <div className="p-3 bg-[#E5554F]/10 border border-[#E5554F]/30 rounded text-[#E5554F]">
              Commander role required to publish air tasking orders. Switch role in the top bar.
            </div>
          ) : (
            <p className="text-[#9AA5B4] leading-relaxed">
              Confirm authorization to broadcast this plan to forward tactical wings. Future disruption replans will evaluate against this state.
            </p>
          )}

          <div className="bg-[#1D2530] p-3 rounded border border-[#2A3340]/60 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-[#657183]">Plan option:</span>
              <span className="font-medium text-[#E8ECF1]">{plan.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#657183]">P1 mission coverage:</span>
              <span className="text-[#3FB27F] font-mono">{plan.metrics.p1CoveragePercent}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#657183]">Assigned sorties:</span>
              <span className="font-mono text-[#E8ECF1]">{assignedCount} / {plan.assignments.length}</span>
            </div>
          </div>
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
            disabled={!isCommander}
            onClick={() => {
              onConfirmPublish();
              onClose();
            }}
            className={`px-3.5 py-1.5 rounded-md font-medium flex items-center space-x-1.5 transition ${
              isCommander
                ? 'bg-[#4C8DF6] hover:bg-[#3B7DE8] text-white'
                : 'bg-[#1D2530] text-[#657183] cursor-not-allowed'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Confirm & broadcast</span>
          </button>
        </div>
      </div>
    </div>
  );
};
