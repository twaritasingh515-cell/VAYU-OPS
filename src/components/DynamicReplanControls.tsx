import React from 'react';
import {
  AlertTriangle,
  Zap,
  ShieldAlert,
  ArrowRight,
  GitCompare,
  X,
  Plane,
  CloudRain,
  ArrowUpRight,
} from 'lucide-react';
import { UserRole } from '../types/ops';
import { Button } from './ui/Button';

interface DynamicReplanControlsProps {
  currentRole: UserRole;
  activeDisruptionAlert: {
    title: string;
    description: string;
    diffSummary: string;
    timestamp: string;
  } | null;
  onInjectA3Aog: () => void;
  onInjectNewThreat: () => void;
  onInjectWeatherShift: () => void;
  onInjectPriorityEscalation: () => void;
  onDismissAlert: () => void;
  onOpenDiffModal: () => void;
  onApproveReplan: () => void;
}

export const DynamicReplanControls: React.FC<DynamicReplanControlsProps> = ({
  currentRole,
  activeDisruptionAlert,
  onInjectA3Aog,
  onInjectNewThreat,
  onInjectWeatherShift,
  onInjectPriorityEscalation,
  onDismissAlert,
  onOpenDiffModal,
  onApproveReplan,
}) => {
  const isCommander = currentRole === 'Commander';

  return (
    <div className="space-y-2 select-none">
      {/* Critical Re-Plan Slide-in Alert Banner */}
      {activeDisruptionAlert && (
        <div className="bg-[#111A2E] border-l-4 border-l-[#EF4444] border-y border-r border-[#243350] rounded-r-lg p-3 text-[#E6EDF7] shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-md bg-[#EF4444]/15 border border-[#EF4444]/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-[10px] font-bold text-[#EF4444] uppercase tracking-wider">
                  Combat Disruption Detected
                </span>
                <span className="text-[10px] font-mono text-[#6B7C99]">
                  [{activeDisruptionAlert.timestamp}]
                </span>
              </div>
              <div className="font-sans font-bold text-xs text-[#E6EDF7]">
                {activeDisruptionAlert.title}
              </div>
              <div className="text-[11px] font-mono text-[#9FB0CC]">
                {activeDisruptionAlert.description} •{' '}
                <span className="text-[#22D3EE] font-semibold">{activeDisruptionAlert.diffSummary}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenDiffModal}
              icon={<GitCompare className="w-3.5 h-3.5 text-[#38BDF8]" />}
            >
              Review Re-Plan Diff
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!isCommander}
              onClick={onApproveReplan}
              title={isCommander ? 'Commander direct approval' : 'Commander role required'}
            >
              Approve Re-Plan
            </Button>
            <button
              onClick={onDismissAlert}
              className="text-[#6B7C99] hover:text-[#E6EDF7] p-1 rounded transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Disruption Injection Bar (Subtle C2 control) */}
      <div className="h-9 px-3 bg-[#111A2E] border border-[#243350] rounded-lg flex items-center justify-between text-xs font-mono">
        <div className="flex items-center space-x-2 text-[#9FB0CC]">
          <Zap className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span className="font-semibold uppercase tracking-wider text-[10px]">
            Dynamic Disruption Injections:
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={onInjectA3Aog}
            className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#FCA5A5] border border-[#EF4444]/40 transition flex items-center space-x-1"
          >
            <Plane className="w-3 h-3 text-[#EF4444]" />
            <span>A3 AOG Lockout</span>
          </button>

          <button
            onClick={onInjectNewThreat}
            className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#17233B] hover:bg-[#1E2D4A] text-[#E6EDF7] border border-[#243350] transition flex items-center space-x-1"
          >
            <ShieldAlert className="w-3 h-3 text-[#F59E0B]" />
            <span>Pop-up SAM Lock</span>
          </button>

          <button
            onClick={onInjectWeatherShift}
            className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#17233B] hover:bg-[#1E2D4A] text-[#E6EDF7] border border-[#243350] transition flex items-center space-x-1"
          >
            <CloudRain className="w-3 h-3 text-[#38BDF8]" />
            <span>Severe Squall Front</span>
          </button>

          <button
            onClick={onInjectPriorityEscalation}
            className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#17233B] hover:bg-[#1E2D4A] text-[#E6EDF7] border border-[#243350] transition flex items-center space-x-1"
          >
            <ArrowUpRight className="w-3 h-3 text-[#22D3EE]" />
            <span>M-104 &rarr; P1 Urgent</span>
          </button>
        </div>
      </div>
    </div>
  );
};
