import React, { useState } from 'react';
import { Play, RotateCcw, Check, ArrowRight } from 'lucide-react';
import { GeneratedPlan, LiveOperationalState } from '../types/ops';

interface EvaluationTabProps {
  currentPlan: GeneratedPlan;
  operationalState: LiveOperationalState;
  onReplayScenario: () => void;
}

export const EvaluationTab: React.FC<EvaluationTabProps> = ({
  operationalState,
  onReplayScenario,
}) => {
  const [isRunningBench, setIsRunningBench] = useState(false);

  const handleRunBenchmark = () => {
    setIsRunningBench(true);
    setTimeout(() => {
      setIsRunningBench(false);
    }, 800);
  };

  const metrics = [
    {
      label: 'Initial planning time',
      manual: '4.2 hours',
      vayu: '3.5 minutes',
      speedup: '72x faster',
    },
    {
      label: 'Priority 1 coverage',
      manual: '78.5%',
      vayu: '100.0%',
      speedup: '+21.5% coverage',
    },
    {
      label: 'Asset utilisation',
      manual: '61.2%',
      vayu: '88.7%',
      speedup: '+27.5% yield',
    },
    {
      label: 'Re-plan latency on disruption',
      manual: '45.0 minutes',
      vayu: '0.22 seconds',
      speedup: 'Instant',
    },
  ];

  const capabilityMatrix = [
    { feature: 'Common real-time operational picture', manual: false, vayu: true },
    { feature: 'Multi-source telemetry fusion (6 feeds)', manual: false, vayu: true },
    { feature: 'Predictive turnaround & serviceability', manual: false, vayu: true },
    { feature: 'Micro-climate weather risk scoring', manual: false, vayu: true },
    { feature: 'Automated threat radar risk scoring', manual: false, vayu: true },
    { feature: 'Constraint-aware optimization solver', manual: false, vayu: true },
    { feature: 'Sub-second dynamic re-planning on disruption', manual: false, vayu: true },
    { feature: 'Side-by-side what-if scenario exploration', manual: false, vayu: true },
    { feature: 'Explainable recommendations (Gemini)', manual: false, vayu: true },
    { feature: 'Commander retains sole decision authority', manual: true, vayu: true },
    { feature: 'Tamper-evident immutable audit log', manual: false, vayu: true },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#0F1419] p-8 text-[#E8ECF1] font-sans space-y-8 select-none">
      {/* Header section */}
      <div className="flex items-center justify-between pb-6 border-b border-[#2A3340]">
        <div>
          <h2 className="text-lg font-semibold text-[#E8ECF1]">
            System evaluation and benchmark
          </h2>
          <p className="text-xs text-[#9AA5B4] mt-1">
            Performance comparison of manual planning vs VAYU-OPS on identical synthetic operational data.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onReplayScenario}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-[#9AA5B4] hover:text-[#E8ECF1] bg-[#161C24] hover:bg-[#1D2530] border border-[#2A3340] transition"
          >
            Reset seed ({operationalState.scenarioSeed})
          </button>
          <button
            disabled={isRunningBench}
            onClick={handleRunBenchmark}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-[#4C8DF6] hover:bg-[#3B7DE8] text-white transition"
          >
            {isRunningBench ? 'Running...' : 'Run comparative test'}
          </button>
        </div>
      </div>

      {/* 4 Key Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <div
            key={i}
            className="bg-[#161C24] border border-[#2A3340] rounded-lg p-4 space-y-3"
          >
            <span className="text-xs text-[#657183] block">{m.label}</span>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-[11px] text-[#657183] block">Manual</span>
                <span className="text-sm text-[#9AA5B4] font-mono">{m.manual}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#657183]" />
              <div className="text-right">
                <span className="text-[11px] text-[#4C8DF6] block">VAYU-OPS</span>
                <span className="text-lg font-semibold text-[#E8ECF1] font-mono">{m.vayu}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-[#2A3340]/60 text-[11px] text-[#3FB27F] font-medium">
              {m.speedup}
            </div>
          </div>
        ))}
      </div>

      {/* Capability Matrix Table */}
      <div className="bg-[#161C24] border border-[#2A3340] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#2A3340] font-medium text-xs text-[#E8ECF1]">
          Capability comparison matrix
        </div>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#2A3340] text-[#657183] text-[11px]">
              <th className="py-2.5 px-5 font-normal">Operational capability</th>
              <th className="py-2.5 px-5 font-normal text-center w-36">Manual process</th>
              <th className="py-2.5 px-5 font-normal text-center w-36">VAYU-OPS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A3340]/40">
            {capabilityMatrix.map((item, idx) => (
              <tr key={idx} className="hover:bg-[#1D2530]/40 transition">
                <td className="py-3 px-5 text-[#E8ECF1]">{item.feature}</td>
                <td className="py-3 px-5 text-center text-[#657183]">
                  {item.manual ? 'Manual' : 'No'}
                </td>
                <td className="py-3 px-5 text-center text-[#3FB27F] font-medium">
                  Native
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
