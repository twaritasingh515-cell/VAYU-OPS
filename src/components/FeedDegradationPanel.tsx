import React from 'react';
import {
  WifiOff,
  AlertTriangle,
  Radio,
  CheckCircle,
  RefreshCw,
  Cpu,
} from 'lucide-react';
import { FeedFreshness, FeedStatus } from '../types/ops';

interface FeedDegradationPanelProps {
  feeds: Record<string, FeedStatus>;
  onToggleFeedStatus: (feedName: FeedStatus['name'], status: FeedFreshness) => void;
  onRestoreAllFeeds: () => void;
  isDegradedModeActive: boolean;
  onActivateDegradedMode: () => void;
}

export const FeedDegradationPanel: React.FC<FeedDegradationPanelProps> = ({
  feeds,
  onToggleFeedStatus,
  onRestoreAllFeeds,
  isDegradedModeActive,
  onActivateDegradedMode,
}) => {
  const feedList = Object.values(feeds);
  const anyDegraded = feedList.some((f) => f.freshness !== 'FRESH');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-100 select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800 mb-2">
        <div className="flex items-center space-x-2">
          <WifiOff className="w-4 h-4 text-rose-400" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            Mode 3 Telemetry Health & Degradation Simulation
          </h3>
        </div>

        <div className="flex items-center space-x-2">
          {anyDegraded ? (
            <button
              onClick={onRestoreAllFeeds}
              className="px-2.5 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 font-mono text-xs flex items-center space-x-1"
            >
              <RefreshCw className="w-3 h-3 text-emerald-400" />
              <span>Restore All Feeds (Fresh)</span>
            </button>
          ) : (
            <button
              onClick={onActivateDegradedMode}
              className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-700 font-mono text-xs flex items-center space-x-1"
            >
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>Simulate Threat & Weather Outage</span>
            </button>
          )}
        </div>
      </div>

      {/* Description Banner */}
      <div className="text-[11px] font-mono text-slate-400 mb-2.5 leading-relaxed">
        Test fault-tolerance by injecting stale or disconnected feed telemetry. When critical telemetry is degraded,
        VAYU-OPS switches to the <span className="text-amber-400 font-bold">Greedy Priority Fallback Planner</span> and
        flags manual verification required.
      </div>

      {/* Feed Status Toggle Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-mono text-xs">
        {feedList.map((f) => {
          return (
            <div
              key={f.name}
              className={`p-2 rounded border flex flex-col justify-between ${
                f.freshness === 'FRESH'
                  ? 'bg-slate-950/80 border-slate-800'
                  : f.freshness === 'STALE'
                  ? 'bg-amber-950/40 border-amber-700/80'
                  : 'bg-rose-950/40 border-rose-700/80'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-200">{f.name}</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    f.freshness === 'FRESH'
                      ? 'bg-emerald-400'
                      : f.freshness === 'STALE'
                      ? 'bg-amber-400'
                      : 'bg-rose-500'
                  }`}
                />
              </div>

              <div className="text-[10px] text-slate-400 mb-2">
                Status: <span className="font-semibold">{f.freshness}</span>
              </div>

              {/* Status Selector Dropdown */}
              <select
                value={f.freshness}
                onChange={(e) => onToggleFeedStatus(f.name, e.target.value as FeedFreshness)}
                className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:border-amber-400"
              >
                <option value="FRESH">Fresh</option>
                <option value="STALE">Stale (&gt;2m)</option>
                <option value="MISSING">Missing (&gt;10m)</option>
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
};
