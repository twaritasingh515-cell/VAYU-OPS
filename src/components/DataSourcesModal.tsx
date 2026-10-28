import React from 'react';
import { X, ExternalLink, Database, CloudRain, Radio, ShieldCheck, Clock } from 'lucide-react';
import { LiveFeedMeta } from '../types/liveTraffic';

interface DataSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  feedMeta: LiveFeedMeta;
}

export const DataSourcesModal: React.FC<DataSourcesModalProps> = ({ isOpen, onClose, feedMeta }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none font-sans">
      <div className="w-full max-w-lg bg-[#161C24] border border-[#2A3340] rounded-xl shadow-2xl overflow-hidden flex flex-col text-xs text-[#E8ECF1] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-12 px-4 border-b border-[#2A3340] flex items-center justify-between bg-[#1D2530]">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-[#4C8DF6]" />
            <span className="font-semibold text-sm">Airspace Telemetry & Data Sources</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#657183] hover:text-[#E8ECF1] hover:bg-[#2A3340] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* 1. OpenSky Network Live Feed */}
          <div className="p-3.5 rounded-lg bg-[#0F1419] border border-[#2A3340] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Radio className="w-4 h-4 text-[#3FB27F]" />
                <span className="font-semibold text-xs text-[#E8ECF1]">The OpenSky Network</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  feedMeta.status === 'CONNECTED'
                    ? 'bg-[#3FB27F]/20 text-[#3FB27F]'
                    : feedMeta.status === 'RATE_LIMITED'
                    ? 'bg-[#E0A33A]/20 text-[#E0A33A]'
                    : 'bg-[#E5554F]/20 text-[#E5554F]'
                }`}
              >
                ● {feedMeta.status}
              </span>
            </div>

            <p className="text-[11px] text-[#9AA5B4] leading-relaxed">
              Provides real-time ADS-B and Mode-S state vectors for commercial and general aviation across the Western
              Indian flight Information Region (FIR). Used for automated civil traffic deconfliction.
            </p>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-[#161C24] p-2.5 rounded border border-[#2A3340]/60">
              <div>
                <span className="text-[#657183] block">Polling Interval</span>
                <span className="text-[#E8ECF1] font-semibold">{feedMeta.pollIntervalSec}s (Autonomous)</span>
              </div>
              <div>
                <span className="text-[#657183] block">Last Poll</span>
                <span className="text-[#E8ECF1] font-semibold">{feedMeta.secondsSinceLastUpdate}s ago</span>
              </div>
              <div>
                <span className="text-[#657183] block">Credit Budget Status</span>
                <span className="text-[#3FB27F] font-semibold">{feedMeta.creditBudgetStatus}</span>
              </div>
              <div>
                <span className="text-[#657183] block">Total Invocations Today</span>
                <span className="text-[#E8ECF1] font-semibold">{feedMeta.totalPollsToday} requests</span>
              </div>
            </div>

            <div className="text-[10px] text-[#657183] border-t border-[#2A3340]/40 pt-2 flex items-center justify-between">
              <span>Attribution: Data provided by The OpenSky Network (CC BY 4.0).</span>
              <a
                href="https://opensky-network.org"
                target="_blank"
                rel="noreferrer"
                className="text-[#4C8DF6] hover:underline flex items-center space-x-1"
              >
                <span>opensky-network.org</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          {/* 2. Open-Meteo Meteorological Feed */}
          <div className="p-3.5 rounded-lg bg-[#0F1419] border border-[#2A3340] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CloudRain className="w-4 h-4 text-[#4C8DF6]" />
                <span className="font-semibold text-xs text-[#E8ECF1]">Open-Meteo Global Forecasting</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#3FB27F]/20 text-[#3FB27F]">
                ● LIVE
              </span>
            </div>

            <p className="text-[11px] text-[#9AA5B4] leading-relaxed">
              Supplies real-time barometric pressure, surface winds, cloud ceiling, and horizontal visibility for
              participating airbases (Ambala, Hasimara, Jodhpur, Leh) and operational strike ingress zones.
            </p>

            <div className="text-[10px] text-[#657183] border-t border-[#2A3340]/40 pt-2 flex items-center justify-between">
              <span>Attribution: Weather data by Open-Meteo.com under Non-Commercial / CC BY 4.0.</span>
              <a
                href="https://open-meteo.com"
                target="_blank"
                rel="noreferrer"
                className="text-[#4C8DF6] hover:underline flex items-center space-x-1"
              >
                <span>open-meteo.com</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          {/* 3. Synthetic Air Tasking & Datalink (VAYU-OPS Internal) */}
          <div className="p-3.5 rounded-lg bg-[#0F1419] border border-[#2A3340] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-[#E0A33A]" />
                <span className="font-semibold text-xs text-[#E8ECF1]">VAYU-OPS Tactical Datalink & Simulation</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#4C8DF6]/20 text-[#4C8DF6]">
                ● ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-[#9AA5B4] leading-relaxed">
              Multi-source data fusion engine generating deterministic 60fps telemetry, SAM threat envelopes, fuel decay,
              and pilot fatigue scoring for high-tempo air tasking optimization.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="h-10 px-4 bg-[#1D2530] border-t border-[#2A3340] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#2A3340] hover:bg-[#323D4D] text-[#E8ECF1] rounded text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
