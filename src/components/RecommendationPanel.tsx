import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  Layers,
  Fuel,
  Users,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { GeneratedPlan, UserRole, OperationalAlert } from '../types/ops';

interface RecommendationPanelProps {
  currentRole: UserRole;
  plans: {
    recommended: GeneratedPlan;
    alternativeLowRisk: GeneratedPlan;
    alternativeSurge: GeneratedPlan;
  };
  activePlanId: string;
  onSelectPlan: (plan: GeneratedPlan) => void;
  onOpenApproveModal: () => void;
  onOpenManualOverride: () => void;
  onRejectPlan: () => void;
  isAiLoading: boolean;
  onRequestAiExplanation: (plan: GeneratedPlan) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  activeAlert?: OperationalAlert | null;
  onApplyAlertAction?: (alert: OperationalAlert) => void;
}

export const RecommendationPanel: React.FC<RecommendationPanelProps> = ({
  currentRole,
  plans,
  activePlanId,
  onSelectPlan,
  onOpenApproveModal,
  onOpenManualOverride,
  onRejectPlan,
  isAiLoading,
  onRequestAiExplanation,
  isCollapsed = false,
  onToggleCollapse,
  activeAlert,
  onApplyAlertAction,
}) => {
  const [selectedPlanType, setSelectedPlanType] = useState<'BALANCED' | 'LOW_RISK' | 'SURGE'>('BALANCED');
  const [isWhyExpanded, setIsWhyExpanded] = useState(false);
  const [isConstraintsExpanded, setIsConstraintsExpanded] = useState(true);

  const selectedPlan =
    selectedPlanType === 'BALANCED'
      ? plans.recommended
      : selectedPlanType === 'LOW_RISK'
      ? plans.alternativeLowRisk
      : plans.alternativeSurge;

  const isCommander = currentRole === 'Commander';
  const isAnalyst = currentRole === 'Analyst';

  // Human-like analyst summary
  const analystSummary =
    selectedPlanType === 'BALANCED'
      ? 'Covers all priority-1 missions with low operational risk and compliant crew rest.'
      : selectedPlanType === 'LOW_RISK'
      ? 'Prioritises defensive standoff distance and minimal threat exposure for all sorties.'
      : 'Maximises concurrent sortie generation and target coverage under elevated tempo.';

  const riskLabel =
    selectedPlan.metrics.averageRiskScore < 45
      ? 'Low'
      : selectedPlan.metrics.averageRiskScore < 65
      ? 'Moderate'
      : 'High';

  const riskBarWidth = `${Math.min(100, selectedPlan.metrics.averageRiskScore)}%`;

  // Trade-offs explanation per option
  const tradeOffs = {
    BALANCED: {
      pros: '100% P1 assurance, optimal fatigue margin (avg 24/100), standard fuel consumption.',
      cons: 'Moderate sortie turnaround buffer on secondary strike objectives.',
      recommendationReason: 'Best operational resilience under contested border conditions.',
    },
    LOW_RISK: {
      pros: '+45% standoff safety margin from SAM bubbles, zero flight corridor violations.',
      cons: '+18% transit duration, -12% concurrent target coverage.',
      recommendationReason: 'Recommended when active hostile electronic warfare or SAM radar is detected.',
    },
    SURGE: {
      pros: '+28% concurrent sortie generation, faster target neutralization window.',
      cons: '+35% pilot fatigue accumulation, accelerates airframe inspection intervals.',
      recommendationReason: 'Recommended during time-critical counter-air or strike escalation phases.',
    },
  }[selectedPlanType];

  if (isCollapsed) {
    return (
      <aside className="w-10 bg-[#161C24] border-l border-[#2A3340] flex flex-col items-center py-3 h-full shrink-0 select-none font-sans">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded hover:bg-[#1D2530] text-[#9AA5B4] hover:text-[#E8ECF1] transition cursor-pointer"
          title="Expand Recommended Plan"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="mt-8 flex items-center text-[11px] font-semibold text-[#657183] tracking-widest uppercase [writing-mode:vertical-rl] rotate-180">
          Recommended Plan
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[340px] bg-[#161C24] border-l border-[#2A3340] flex flex-col h-full select-none shrink-0 font-sans box-border">
      {/* 1. Panel Header */}
      <div className="h-10 px-3.5 border-b border-[#2A3340] flex items-center justify-between text-xs text-[#9AA5B4] shrink-0">
        <div className="flex items-center space-x-2">
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded text-[#657183] hover:text-[#E8ECF1] hover:bg-[#1D2530] transition cursor-pointer"
              title="Collapse Plan Panel"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
          <span className="font-medium text-[#E8ECF1]">Recommended plan</span>
        </div>
        <span className="text-[11px] text-[#657183]">Solved in 12 ms</span>
      </div>

      {/* 2. Scrollable Body: Content above the fixed footer */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Plan Title & One-line Summary */}
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-[#E8ECF1] tracking-tight">
            {selectedPlan.name}
          </h2>
          <p className="text-xs text-[#9AA5B4] leading-relaxed">
            {analystSummary}
          </p>
        </div>

        {/* 3 Equal Metric Columns with Clean Separation (No Overlap, Perfect Alignment) */}
        <div className="grid grid-cols-3 gap-2 py-3 border-y border-[#2A3340] box-border w-full">
          {/* Column 1: P1 Coverage */}
          <div className="min-w-0 flex flex-col justify-between text-center px-1">
            <div>
              <div
                className="text-xl sm:text-2xl font-bold leading-tight text-[#E8ECF1] tabular-nums font-sans tracking-tight"
                title={`${selectedPlan.metrics.p1CoveragePercent}%`}
              >
                {selectedPlan.metrics.p1CoveragePercent}%
              </div>
              <div className="text-[11px] text-[#657183] mt-0.5 font-medium leading-none">
                P1 Coverage
              </div>
            </div>
            <div className="text-[9px] text-[#3FB27F] font-semibold mt-2 leading-none uppercase tracking-wider">
              Optimal
            </div>
          </div>

          {/* Column 2: Plan Risk with indicator bar directly beneath metric clearly showing Moderate */}
          <div className="min-w-0 flex flex-col justify-between text-center px-1 border-x border-[#2A3340]/60">
            <div>
              <div
                className={`text-xl sm:text-2xl font-bold leading-tight font-sans tracking-tight ${
                  riskLabel === 'Moderate'
                    ? 'text-[#E0A33A]'
                    : riskLabel === 'Low'
                    ? 'text-[#3FB27F]'
                    : 'text-[#E5554F]'
                }`}
                title={riskLabel}
              >
                {riskLabel}
              </div>
              <div className="text-[11px] text-[#657183] mt-0.5 font-medium leading-none">
                Plan Risk
              </div>
            </div>

            {/* Positioned directly beneath Plan Risk: 3-zone segmented bar clearly indicating Moderate */}
            <div className="mt-2 space-y-1 w-full px-0.5">
              <div className="h-2 bg-[#1D2530] rounded-sm overflow-hidden w-full flex gap-0.5">
                {/* Zone 1: Low */}
                <div
                  className={`h-full flex-1 rounded-l-sm transition-all duration-300 ${
                    riskLabel === 'Low'
                      ? 'bg-[#3FB27F] ring-1 ring-[#3FB27F]'
                      : 'bg-[#3FB27F]/25'
                  }`}
                  title="Low Risk (<45)"
                />
                {/* Zone 2: Moderate */}
                <div
                  className={`h-full flex-1 transition-all duration-300 ${
                    riskLabel === 'Moderate'
                      ? 'bg-[#E0A33A] ring-1 ring-[#E0A33A]'
                      : 'bg-[#E0A33A]/25'
                  }`}
                  title="Moderate Risk (45-65)"
                />
                {/* Zone 3: High */}
                <div
                  className={`h-full flex-1 rounded-r-sm transition-all duration-300 ${
                    riskLabel === 'High'
                      ? 'bg-[#E5554F] ring-1 ring-[#E5554F]'
                      : 'bg-[#E5554F]/25'
                  }`}
                  title="High Risk (>65)"
                />
              </div>
              <div className="text-[9px] font-semibold leading-none uppercase tracking-wider text-[#E0A33A]">
                {riskLabel === 'Moderate' ? 'Level 2 · Mod' : riskLabel === 'Low' ? 'Level 1 · Low' : 'Level 3 · High'}
              </div>
            </div>
          </div>

          {/* Column 3: Asset Use */}
          <div className="min-w-0 flex flex-col justify-between text-center px-1">
            <div>
              <div
                className="text-xl sm:text-2xl font-bold leading-tight text-[#E8ECF1] tabular-nums font-sans tracking-tight"
                title="89%"
              >
                89%
              </div>
              <div className="text-[11px] text-[#657183] mt-0.5 font-medium leading-none">
                Asset Use
              </div>
            </div>
            <div className="text-[9px] text-[#9AA5B4] font-semibold mt-2 leading-none uppercase tracking-wider">
              8/9 Active
            </div>
          </div>
        </div>

        {/* Dynamic Alert Banner linking tracking disruption to recommendation */}
        {activeAlert && (
          <div className="p-3 rounded-lg bg-[#E5554F]/10 border border-[#E5554F]/40 space-y-1.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#E5554F] flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[#E5554F] shrink-0" />
                <span>DISRUPTION ALERT: {activeAlert.aircraftId}</span>
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#E5554F]/20 text-[#E5554F] font-semibold">
                {activeAlert.severity}
              </span>
            </div>
            <p className="text-[11px] text-[#E8ECF1] leading-relaxed">
              {activeAlert.reason}
            </p>
            <div className="pt-1 flex items-center justify-between gap-2 text-[11px]">
              <span className="text-[#9AA5B4] text-[10px] leading-tight">
                Suggested: {activeAlert.suggestedResponse}
              </span>
              {onApplyAlertAction && activeAlert.actionLabel && (
                <button
                  onClick={() => onApplyAlertAction(activeAlert)}
                  className="px-2.5 py-1 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium text-[10px] transition shrink-0 cursor-pointer shadow-sm"
                >
                  {activeAlert.actionLabel}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Plan Option Segmented Switcher */}
        <div className="space-y-1.5">
          <span className="text-xs text-[#9AA5B4] font-medium block">Plan option</span>
          <div className="grid grid-cols-3 gap-1 bg-[#0F1419] p-0.5 rounded-lg border border-[#2A3340] text-xs">
            <button
              onClick={() => {
                setSelectedPlanType('BALANCED');
                onSelectPlan(plans.recommended);
              }}
              className={`py-1.5 rounded-md transition text-center font-medium cursor-pointer ${
                selectedPlanType === 'BALANCED'
                  ? 'bg-[#1D2530] text-[#E8ECF1]'
                  : 'text-[#657183] hover:text-[#9AA5B4]'
              }`}
            >
              Balanced
            </button>
            <button
              onClick={() => {
                setSelectedPlanType('LOW_RISK');
                onSelectPlan(plans.alternativeLowRisk);
              }}
              className={`py-1.5 rounded-md transition text-center font-medium cursor-pointer ${
                selectedPlanType === 'LOW_RISK'
                  ? 'bg-[#1D2530] text-[#E8ECF1]'
                  : 'text-[#657183] hover:text-[#9AA5B4]'
              }`}
            >
              Low risk
            </button>
            <button
              onClick={() => {
                setSelectedPlanType('SURGE');
                onSelectPlan(plans.alternativeSurge);
              }}
              className={`py-1.5 rounded-md transition text-center font-medium cursor-pointer ${
                selectedPlanType === 'SURGE'
                  ? 'bg-[#1D2530] text-[#E8ECF1]'
                  : 'text-[#657183] hover:text-[#9AA5B4]'
              }`}
            >
              Surge
            </button>
          </div>
        </div>

        {/* Plan Trade-offs Overview */}
        <div className="p-3 rounded-lg bg-[#0F1419] border border-[#2A3340] space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-[11px] font-medium text-[#9AA5B4] border-b border-[#2A3340]/60 pb-1">
            <span>PLAN TRADE-OFF PROFILE</span>
            <span className="text-[10px] text-[#4C8DF6] font-mono">{selectedPlanType}</span>
          </div>
          <div className="space-y-1 text-[11px]">
            <div className="text-[#3FB27F] flex items-start space-x-1">
              <span className="font-bold">+</span>
              <span>{tradeOffs.pros}</span>
            </div>
            <div className="text-[#E0A33A] flex items-start space-x-1">
              <span className="font-bold">-</span>
              <span>{tradeOffs.cons}</span>
            </div>
            <div className="text-[#9AA5B4] text-[10px] pt-0.5 leading-relaxed">
              Rationale: {tradeOffs.recommendationReason}
            </div>
          </div>
        </div>

        {/* Resource Constraints & Conflicts Check */}
        <div className="border border-[#2A3340] rounded-lg overflow-hidden">
          <button
            onClick={() => setIsConstraintsExpanded(!isConstraintsExpanded)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-[#9AA5B4] hover:text-[#E8ECF1] bg-[#1D2530]/40 hover:bg-[#1D2530] transition cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#3FB27F]" />
              <span>Resource Constraints & Conflicts</span>
            </div>
            {isConstraintsExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-[#657183]" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-[#657183]" />
            )}
          </button>

          {isConstraintsExpanded && (
            <div className="p-3 bg-[#0F1419] border-t border-[#2A3340] space-y-2 text-[11px]">
              <div className="flex items-center justify-between text-[#E8ECF1]">
                <span className="text-[#9AA5B4]">Airframe Serviceability:</span>
                <span className="text-[#3FB27F] font-medium">9/10 Ready (1 AOG Isolated)</span>
              </div>
              <div className="flex items-center justify-between text-[#E8ECF1]">
                <span className="text-[#9AA5B4]">Pilot Rest Limits:</span>
                <span className="text-[#3FB27F] font-medium">100% Compliant (&lt;8h Duty)</span>
              </div>
              <div className="flex items-center justify-between text-[#E8ECF1]">
                <span className="text-[#9AA5B4]">Armament Munitions:</span>
                <span className="text-[#3FB27F] font-medium">All Payloads In-Stock</span>
              </div>
              <div className="flex items-center justify-between text-[#E8ECF1]">
                <span className="text-[#9AA5B4]">Deconfliction:</span>
                <span className="text-[#3FB27F] font-medium">Zero Corridor Violations</span>
              </div>
            </div>
          )}
        </div>

        {/* "Why this plan" Accordion (Gemini explanation) */}
        <div className="border border-[#2A3340] rounded-lg overflow-hidden">
          <button
            onClick={() => setIsWhyExpanded(!isWhyExpanded)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-medium text-[#9AA5B4] hover:text-[#E8ECF1] bg-[#1D2530]/50 hover:bg-[#1D2530] transition cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5 text-[#4C8DF6]" />
              <span>Why this plan</span>
            </div>
            {isWhyExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-[#657183]" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-[#657183]" />
            )}
          </button>

          {isWhyExpanded && (
            <div className="p-3.5 bg-[#0F1419] border-t border-[#2A3340] space-y-2 text-xs">
              <div className="text-[11px] text-[#657183]">
                AI-generated operational explanation (simulation advisory)
              </div>
              <div className="text-xs text-[#9AA5B4] leading-relaxed whitespace-pre-line font-sans">
                {isAiLoading ? (
                  <div className="text-[#657183] py-2">Consulting advisor...</div>
                ) : (
                  selectedPlan.explanation ||
                  `Assigned frontline multirole assets with certified qualifications and high serviceability margins. High priority sorties guaranteed under ${selectedPlanType.toLowerCase()} constraint weights.`
                )}
              </div>
              <button
                onClick={() => onRequestAiExplanation(selectedPlan)}
                disabled={isAiLoading}
                className="text-[11px] text-[#4C8DF6] hover:underline pt-1 block cursor-pointer"
              >
                Refresh explanation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Action Buttons: Fixed at bottom of panel */}
      <div className="p-4 border-t border-[#2A3340] bg-[#161C24] shrink-0 space-y-2">
        <button
          onClick={onOpenApproveModal}
          disabled={!isCommander}
          className={`w-full py-2.5 px-3 rounded-md text-xs font-medium transition text-center flex items-center justify-center space-x-1.5 ${
            isCommander
              ? 'bg-[#4C8DF6] hover:bg-[#3B7DE8] text-white shadow-sm cursor-pointer'
              : 'bg-[#1D2530] text-[#657183] cursor-not-allowed'
          }`}
          title={isCommander ? 'Approve active plan' : 'Commander role required to approve'}
        >
          <Check className="w-3.5 h-3.5" />
          <span>Approve plan</span>
        </button>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            onClick={onOpenManualOverride}
            disabled={isAnalyst}
            className={`py-1.5 px-3 rounded-md font-medium text-center border transition ${
              !isAnalyst
                ? 'bg-[#1D2530] hover:bg-[#222C3A] text-[#E8ECF1] border-[#2A3340] cursor-pointer'
                : 'bg-[#161C24] text-[#657183] border-transparent cursor-not-allowed'
            }`}
            title={!isAnalyst ? 'Manually adjust aircraft or crew assignments' : 'Role restricted'}
          >
            Override
          </button>

          <button
            onClick={onRejectPlan}
            disabled={!isCommander}
            className={`py-1.5 px-3 rounded-md font-medium text-center transition ${
              isCommander
                ? 'text-[#E5554F] hover:bg-[#E5554F]/10 cursor-pointer'
                : 'text-[#657183] cursor-not-allowed'
            }`}
            title={isCommander ? 'Reject current plan recommendation' : 'Commander role required'}
          >
            Reject
          </button>
        </div>
      </div>
    </aside>
  );
};
