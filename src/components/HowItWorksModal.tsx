import React from 'react';
import {
  X,
  HelpCircle,
  Cpu,
  Layers,
  Zap,
  WifiOff,
  Server,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col text-slate-100 overflow-hidden font-sans">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <HelpCircle className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-slate-100">
                VAYU-OPS Operational Doctrine & System Architecture
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                AI-Enabled Decision Support for Air Tasking • Human-in-the-Loop Architecture
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-300 leading-relaxed">
          {/* Core Philosophy Banner */}
          <div className="bg-amber-950/30 border border-amber-600/60 rounded-lg p-3 text-amber-200">
            <h4 className="font-mono font-bold text-xs uppercase text-amber-300 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              Core Doctrine: The System RECOMMENDS and the Commander DECIDES
            </h4>
            <p className="text-[11px] leading-relaxed">
              VAYU-OPS is strictly decision-support software. It ingests multi-domain telemetry, predicts risk envelopes,
              solves combinatorial asset constraints, and explains trade-offs in plain natural language via Gemini.
              The AI never fires weapons, approves flight authorizations, or changes military doctrine. The human
              commander retains sole, inviolable operational authority.
            </p>
          </div>

          {/* Three Operating Modes */}
          <div className="space-y-3">
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200 border-b border-slate-800 pb-1">
              The Three Operational Modes
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Mode 1 */}
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 space-y-1.5">
                <div className="flex items-center space-x-1.5 text-cyan-400 font-mono font-bold text-xs">
                  <Layers className="w-4 h-4" />
                  <span>MODE 1: Planning Cycle</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Scheduled ATO cycle: <br />
                  <span className="font-mono text-slate-300">Ingest &rarr; Fuse &rarr; Predict &rarr; Optimise &rarr; Explain</span>.
                  Produces primary recommended plan plus 2 what-if alternatives for commander sign-off.
                </p>
              </div>

              {/* Mode 2 */}
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 space-y-1.5">
                <div className="flex items-center space-x-1.5 text-amber-400 font-mono font-bold text-xs">
                  <Zap className="w-4 h-4" />
                  <span>MODE 2: Dynamic Re-Plan</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Event-driven disruption response: aircraft AOG, pop-up SAM radars, sudden storm cells, or mission priority shifts.
                  Solves a minimal-drift re-plan in milliseconds and presents visual diffs.
                </p>
              </div>

              {/* Mode 3 */}
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 space-y-1.5">
                <div className="flex items-center space-x-1.5 text-rose-400 font-mono font-bold text-xs">
                  <WifiOff className="w-4 h-4" />
                  <span>MODE 3: Degraded Data</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Resilience under electronic warfare: detects stale/missing feeds (&gt;2m or &gt;10m), raises warnings, and
                  gracefully falls back to greedy priority heuristics with manual commander override.
                </p>
              </div>
            </div>
          </div>

          {/* Constraint Solver Overview */}
          <div className="space-y-2">
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200 border-b border-slate-800 pb-1 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Constraint-Based Assignment Engine (Simulating Google OR-Tools CP-SAT)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
              <div className="flex items-start space-x-1.5 bg-slate-950 p-2 rounded border border-slate-850">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>Aircraft role strictly matches mission role (ISR, CAP, Strike, Transport).</span>
              </div>
              <div className="flex items-start space-x-1.5 bg-slate-950 p-2 rounded border border-slate-850">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>Crew holds current role rating and duty hours are within circadian limits.</span>
              </div>
              <div className="flex items-start space-x-1.5 bg-slate-950 p-2 rounded border border-slate-850">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>Base munitions depot verified for Astra BVR / Spice / Standoff stocks.</span>
              </div>
              <div className="flex items-start space-x-1.5 bg-slate-950 p-2 rounded border border-slate-850">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>No temporal overlaps for the same airframe or pilot across sorties.</span>
              </div>
            </div>
          </div>

          {/* Production Note */}
          <div className="bg-slate-950 rounded-lg p-3.5 border border-slate-800 space-y-2">
            <div className="flex items-center space-x-2 text-slate-300 font-mono text-xs font-bold">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>Production Deployment Architecture Specification</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
              Prototype runs on synthetic data. Production design: Kafka/MQTT ingestion, FastAPI, PostgreSQL+TimescaleDB,
              OR-Tools CP-SAT, scikit-learn/XGBoost/PyTorch, React dashboard with WebSockets, air-gapped containers.
            </p>
            <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-850 flex items-center justify-between">
              <span>Security Classification: MoD Defense Enclave Restricted</span>
              <span>Synthetic Simulation Only • No Real Asset Coords</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs transition"
          >
            Close Operational Briefing
          </button>
        </div>
      </div>
    </div>
  );
};
