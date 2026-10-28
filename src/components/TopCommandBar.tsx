import React from 'react';
import {
  Clock,
  Radio,
  Lock,
  Sun,
  Moon,
  Eye,
  Play,
  RotateCcw,
  Keyboard,
  HelpCircle,
  Layers,
  BarChart3,
  ChevronDown,
} from 'lucide-react';
import { FeedStatus, OperatingMode, UserRole } from '../types/ops';
import { Button } from './ui/Button';

export type AppTheme = 'dark' | 'light' | 'nightops';

interface TopCommandBarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  activeMode: OperatingMode;
  onModeChange: (mode: OperatingMode) => void;
  feeds: Record<string, FeedStatus>;
  activeTab: 'AIR_TASKING' | 'EVALUATION';
  onTabChange: (tab: 'AIR_TASKING' | 'EVALUATION') => void;
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  onOpenHowItWorks: () => void;
  onOpenShortcuts: () => void;
  onOpenTour: () => void;
  onStartDemo: () => void;
  onReplayScenario: () => void;
  currentTimeString: string;
  utcTimeString: string;
  scenarioSeed: number;
}

export const TopCommandBar: React.FC<TopCommandBarProps> = ({
  currentRole,
  onRoleChange,
  activeMode,
  onModeChange,
  feeds,
  activeTab,
  onTabChange,
  theme,
  onThemeChange,
  onOpenHowItWorks,
  onOpenShortcuts,
  onOpenTour,
  onStartDemo,
  onReplayScenario,
  currentTimeString,
  utcTimeString,
  scenarioSeed,
}) => {
  const feedList = Object.values(feeds);

  return (
    <header className="h-14 bg-[#0B1220] border-b border-[#243350] px-4 flex items-center justify-between text-[#E6EDF7] shrink-0 select-none z-30">
      {/* Left: Brand + Breadcrumb + View Tabs */}
      <div className="flex items-center space-x-4">
        {/* IAF Emblem / Brand Wordmark */}
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-full bg-[#111A2E] border border-[#F59E0B]/80 flex items-center justify-center p-0.5 shadow-inner">
            <div className="w-5 h-5 rounded-full border border-orange-500/80 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full border border-white/90 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-mono text-sm font-extrabold tracking-wider text-[#E6EDF7]">
                VAYU-OPS
              </span>
              <span className="text-[9px] font-mono tracking-widest px-1 py-0.2 rounded bg-[#17233B] text-[#38BDF8] border border-[#243350]">
                C2 DSS
              </span>
            </div>
          </div>
        </div>

        <div className="h-4 w-px bg-[#243350]" />

        {/* View Switcher Tabs (Air Tasking vs Evaluation) */}
        <div className="flex items-center bg-[#111A2E] p-0.5 rounded-lg border border-[#243350] font-mono text-xs">
          <button
            onClick={() => onTabChange('AIR_TASKING')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition-colors ${
              activeTab === 'AIR_TASKING'
                ? 'bg-[#17233B] text-[#38BDF8] font-bold shadow-sm'
                : 'text-[#9FB0CC] hover:text-[#E6EDF7]'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Air Tasking | Live</span>
          </button>
          <button
            onClick={() => onTabChange('EVALUATION')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition-colors ${
              activeTab === 'EVALUATION'
                ? 'bg-[#17233B] text-[#F59E0B] font-bold shadow-sm'
                : 'text-[#9FB0CC] hover:text-[#E6EDF7]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>Evaluation</span>
          </button>
        </div>

        {/* Segmented Mode Switcher */}
        <div className="hidden lg:flex items-center bg-[#111A2E] p-0.5 rounded-lg border border-[#243350] font-mono text-xs">
          <span className="text-[10px] text-[#6B7C99] px-2 uppercase font-semibold">MODE:</span>
          <button
            onClick={() => onModeChange('MODE_1_PLANNING')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeMode === 'MODE_1_PLANNING'
                ? 'bg-[#3B82F6]/20 text-[#38BDF8] border border-[#3B82F6]/60 font-bold'
                : 'text-[#9FB0CC] hover:text-[#E6EDF7]'
            }`}
            title="1. Planning Cycle: Standard ingest, constraint solve & publish"
          >
            1. Planning
          </button>
          <button
            onClick={() => onModeChange('MODE_2_DYNAMIC_REPLAN')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeMode === 'MODE_2_DYNAMIC_REPLAN'
                ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/60 font-bold'
                : 'text-[#9FB0CC] hover:text-[#E6EDF7]'
            }`}
            title="2. Dynamic Re-plan: Event-driven disruption reaction"
          >
            2. Re-Plan
          </button>
          <button
            onClick={() => onModeChange('MODE_3_DEGRADED')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeMode === 'MODE_3_DEGRADED'
                ? 'bg-[#EF4444]/20 text-[#FCA5A5] border border-[#EF4444]/60 font-bold'
                : 'text-[#9FB0CC] hover:text-[#E6EDF7]'
            }`}
            title="3. Degraded Data: Fallback greedy heuristic active"
          >
            3. Degraded
          </button>
        </div>
      </div>

      {/* Center: Live Scenario Clock & Feed Health */}
      <div className="hidden xl:flex items-center space-x-4">
        {/* Clock */}
        <div className="flex items-center space-x-2 bg-[#111A2E] px-3 py-1 rounded border border-[#243350] font-mono text-xs">
          <Clock className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span className="font-bold text-[#E6EDF7] tabular-nums">{utcTimeString}Z</span>
          <span className="text-[#6B7C99]">/</span>
          <span className="text-[#9FB0CC] tabular-nums">{currentTimeString} IST</span>
        </div>

        {/* 6-Feed Health Strip */}
        <div className="flex items-center space-x-1.5 bg-[#111A2E] px-2.5 py-1 rounded border border-[#243350]">
          <span className="text-[10px] font-mono text-[#6B7C99] uppercase mr-1">Feeds:</span>
          {feedList.map((f) => {
            const isFresh = f.freshness === 'FRESH';
            const isStale = f.freshness === 'STALE';
            const dotColor = isFresh
              ? 'bg-[#22C55E]'
              : isStale
              ? 'bg-[#F59E0B] animate-pulse'
              : 'bg-[#EF4444] animate-pulse';

            return (
              <div
                key={f.name}
                className="group relative flex items-center justify-center p-1 cursor-pointer"
                title={`${f.name} Feed: ${f.freshness} (${Math.round(
                  (Date.now() - f.lastUpdated) / 1000
                )}s ago)`}
              >
                <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                {/* Micro tooltip on hover */}
                <div className="absolute top-7 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col bg-[#0B1220] border border-[#243350] p-1.5 rounded shadow-xl text-[10px] font-mono text-[#E6EDF7] z-50 whitespace-nowrap pointer-events-none">
                  <span className="font-bold">{f.name} Feed</span>
                  <span className="text-[#9FB0CC]">{f.freshness} • Latency {f.latencyMs}ms</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Role Dropdown, Theme Toggle, Demo & Quick Actions */}
      <div className="flex items-center space-x-2">
        {/* Air-gapped badge */}
        <div className="hidden 2xl:flex items-center space-x-1 px-2 py-1 rounded bg-[#22C55E]/10 border border-[#22C55E]/30 text-[10px] font-mono text-[#22C55E]">
          <Lock className="w-3 h-3 text-[#22C55E]" />
          <span>Air-gapped (Simulated)</span>
        </div>

        {/* 60s Demo Run trigger */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onStartDemo}
          shortcut="D"
          icon={<Play className="w-3 h-3 text-[#F59E0B]" />}
          title="Auto-run 60-second interactive briefing demonstration"
        >
          <span className="hidden sm:inline">60s Demo</span>
        </Button>

        {/* Role Selector Dropdown */}
        <div className="flex items-center bg-[#111A2E] border border-[#243350] rounded-md px-2 py-1 text-xs font-mono">
          <span className="text-[10px] text-[#6B7C99] uppercase mr-1.5">Role:</span>
          <select
            value={currentRole}
            onChange={(e) => onRoleChange(e.target.value as UserRole)}
            className="bg-transparent text-[#E6EDF7] font-semibold text-xs focus:outline-none cursor-pointer"
          >
            <option value="Commander" className="bg-[#111A2E] text-[#E6EDF7]">
              Commander (Executive)
            </option>
            <option value="Planner" className="bg-[#111A2E] text-[#E6EDF7]">
              Planner (Propose/Override)
            </option>
            <option value="Analyst" className="bg-[#111A2E] text-[#E6EDF7]">
              Analyst (Read-Only)
            </option>
          </select>
        </div>

        {/* Theme Switcher Toggle (Dark, Light, Night-Ops) */}
        <div className="flex items-center bg-[#111A2E] border border-[#243350] rounded-md p-0.5">
          <button
            onClick={() => onThemeChange('dark')}
            className={`p-1.5 rounded transition ${
              theme === 'dark' ? 'bg-[#17233B] text-[#38BDF8]' : 'text-[#6B7C99] hover:text-[#E6EDF7]'
            }`}
            title="Dark Theme"
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onThemeChange('light')}
            className={`p-1.5 rounded transition ${
              theme === 'light' ? 'bg-[#17233B] text-[#F59E0B]' : 'text-[#6B7C99] hover:text-[#E6EDF7]'
            }`}
            title="Light Theme"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onThemeChange('nightops')}
            className={`p-1.5 rounded transition ${
              theme === 'nightops' ? 'bg-[#17233B] text-[#EF4444]' : 'text-[#6B7C99] hover:text-[#E6EDF7]'
            }`}
            title="Night-Ops Low-Brightness Red-Shift"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tour & Shortcuts */}
        <button
          onClick={onOpenTour}
          className="p-1.5 rounded bg-[#111A2E] hover:bg-[#17233B] border border-[#243350] text-[#9FB0CC] hover:text-[#E6EDF7] transition"
          title="Take Guided Operational Tour"
        >
          <HelpCircle className="w-3.5 h-3.5 text-[#38BDF8]" />
        </button>

        <button
          onClick={onOpenShortcuts}
          className="p-1.5 rounded bg-[#111A2E] hover:bg-[#17233B] border border-[#243350] text-[#9FB0CC] hover:text-[#E6EDF7] transition"
          title="Keyboard Shortcuts [?]"
        >
          <Keyboard className="w-3.5 h-3.5 text-[#9FB0CC]" />
        </button>
      </div>
    </header>
  );
};
