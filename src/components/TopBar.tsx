import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Sun,
  Moon,
  ChevronDown,
  History,
  Play,
  RotateCcw,
  Zap,
  Check,
  Plane,
  ShieldAlert,
  CloudRain,
  ArrowUpRight,
  WifiOff,
  Radio,
  Database,
} from 'lucide-react';
import { FeedStatus, OperatingMode, UserRole, OperationalAlert } from '../types/ops';
import { LiveFeedStatus, LiveFeedMeta } from '../types/liveTraffic';

interface TopBarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  activeTab: 'AIR_TASKING' | 'EVALUATION';
  onTabChange: (tab: 'AIR_TASKING' | 'EVALUATION') => void;
  feeds: Record<string, FeedStatus>;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  onStartDemo: () => void;
  onOpenAuditLog: () => void;
  alerts: (string | OperationalAlert)[];
  onSelectAlert?: (alert: OperationalAlert) => void;
  onInjectA3Aog: () => void;
  onInjectNewThreat: () => void;
  onInjectWeatherShift: () => void;
  onInjectPriorityEscalation: () => void;
  onInjectFeedDelay: () => void;
  onResetScenario: () => void;
  scenarioSeed: number;
  liveFeedStatus?: LiveFeedStatus;
  liveFeedMeta?: LiveFeedMeta;
  onOpenDataSources?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentRole,
  onRoleChange,
  activeTab,
  onTabChange,
  feeds,
  theme,
  onThemeToggle,
  onStartDemo,
  onOpenAuditLog,
  alerts,
  onSelectAlert,
  onInjectA3Aog,
  onInjectNewThreat,
  onInjectWeatherShift,
  onInjectPriorityEscalation,
  onInjectFeedDelay,
  onResetScenario,
  scenarioSeed,
  liveFeedStatus,
  liveFeedMeta,
  onOpenDataSources,
}) => {
  const [isFeedPopoverOpen, setIsFeedPopoverOpen] = useState(false);
  const [isAlertsPopoverOpen, setIsAlertsPopoverOpen] = useState(false);
  const [isSimulateOpen, setIsSimulateOpen] = useState(false);

  const feedRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);
  const simulateRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (feedRef.current && !feedRef.current.contains(e.target as Node)) {
        setIsFeedPopoverOpen(false);
      }
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) {
        setIsAlertsPopoverOpen(false);
      }
      if (simulateRef.current && !simulateRef.current.contains(e.target as Node)) {
        setIsSimulateOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const feedList = Object.values(feeds);
  const allFeedsFresh = feedList.every((f) => f.freshness === 'FRESH');
  const hasStale = feedList.some((f) => f.freshness === 'STALE');

  return (
    <header className="h-12 bg-[#161C24] border-b border-[#2A3340] px-4 flex items-center justify-between text-[#E8ECF1] shrink-0 select-none z-30">
      {/* 1. Left: Tasteful Abstract Wing/Chevron Mark & Wordmark */}
      <div className="flex items-center space-x-2.5">
        <div className="w-6 h-6 rounded bg-[#1D2530] border border-[#2A3340] flex items-center justify-center text-[#4C8DF6]">
          {/* Abstract aerodynamic wing / chevron mark */}
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4L3 18l9-4 9 4-9-14z" />
          </svg>
        </div>
        <span className="font-sans font-medium text-sm tracking-wider text-[#E8ECF1]">
          VAYU-OPS
        </span>
      </div>

      {/* 2. Center: Clean Navigation Tabs (Tasking & Evaluation) */}
      <nav className="flex items-center space-x-1 font-sans text-xs">
        <button
          onClick={() => onTabChange('AIR_TASKING')}
          className={`px-3 py-1.5 rounded-md transition-colors ${
            activeTab === 'AIR_TASKING'
              ? 'bg-[#1D2530] text-[#E8ECF1] font-medium'
              : 'text-[#9AA5B4] hover:text-[#E8ECF1]'
          }`}
        >
          Tasking
        </button>
        <button
          onClick={() => onTabChange('EVALUATION')}
          className={`px-3 py-1.5 rounded-md transition-colors ${
            activeTab === 'EVALUATION'
              ? 'bg-[#1D2530] text-[#E8ECF1] font-medium'
              : 'text-[#9AA5B4] hover:text-[#E8ECF1]'
          }`}
        >
          Evaluation
        </button>
      </nav>

      {/* 3. Right: Clean action controls */}
      <div className="flex items-center space-x-2">
        {/* Simulate Event Dropdown */}
        <div className="relative" ref={simulateRef}>
          <button
            onClick={() => setIsSimulateOpen(!isSimulateOpen)}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-[#9AA5B4] hover:text-[#E8ECF1] bg-[#1D2530] hover:bg-[#222C3A] border border-[#2A3340] rounded-md transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-[#E0A33A]" />
            <span>Simulate event</span>
            <ChevronDown className="w-3 h-3 text-[#657183]" />
          </button>

          {isSimulateOpen && (
            <div className="absolute right-0 mt-1.5 w-60 bg-[#1D2530] border border-[#2A3340] rounded-lg shadow-xl py-1 text-xs z-50 animate-in fade-in">
              <div className="px-3 py-1.5 text-[11px] font-medium text-[#657183] border-b border-[#2A3340]">
                Inject operational disruption
              </div>
              <button
                onClick={() => {
                  onInjectA3Aog();
                  setIsSimulateOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-[#222C3A] flex items-center space-x-2 text-[#E8ECF1]"
              >
                <Plane className="w-3.5 h-3.5 text-[#E5554F]" />
                <span>Aircraft unserviceable (A3)</span>
              </button>
              <button
                onClick={() => {
                  onInjectNewThreat();
                  setIsSimulateOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-[#222C3A] flex items-center space-x-2 text-[#E8ECF1]"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-[#E0A33A]" />
                <span>New SAM threat</span>
              </button>
              <button
                onClick={() => {
                  onInjectWeatherShift();
                  setIsSimulateOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-[#222C3A] flex items-center space-x-2 text-[#E8ECF1]"
              >
                <CloudRain className="w-3.5 h-3.5 text-[#4C8DF6]" />
                <span>Weather deterioration</span>
              </button>
              <button
                onClick={() => {
                  onInjectPriorityEscalation();
                  setIsSimulateOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-[#222C3A] flex items-center space-x-2 text-[#E8ECF1]"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-[#3FB27F]" />
                <span>Priority shift (M-104 &rarr; P1)</span>
              </button>
              <button
                onClick={() => {
                  onInjectFeedDelay();
                  setIsSimulateOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-[#222C3A] flex items-center space-x-2 text-[#E8ECF1]"
              >
                <WifiOff className="w-3.5 h-3.5 text-[#657183]" />
                <span>Data feed delay (stale)</span>
              </button>
              <div className="border-t border-[#2A3340] my-1" />
              <button
                onClick={() => {
                  onResetScenario();
                  setIsSimulateOpen(false);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-[#222C3A] flex items-center space-x-2 text-[#9AA5B4]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset scenario (Seed #{scenarioSeed})</span>
              </button>
            </div>
          )}
        </div>

        {/* Run Demo Button */}
        <button
          onClick={onStartDemo}
          className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-[#E8ECF1] bg-[#1D2530] hover:bg-[#222C3A] border border-[#2A3340] rounded-md transition-colors"
        >
          <Play className="w-3 h-3 text-[#3FB27F]" />
          <span>Run demo</span>
        </button>

        {/* Role Selector */}
        <div className="relative">
          <select
            value={currentRole}
            onChange={(e) => onRoleChange(e.target.value as UserRole)}
            className="bg-[#1D2530] text-[#E8ECF1] border border-[#2A3340] rounded-md px-2.5 py-1 text-xs font-sans focus:outline-none cursor-pointer"
          >
            <option value="Commander">Commander</option>
            <option value="Planner">Planner</option>
            <option value="Analyst">Analyst</option>
          </select>
        </div>

        {/* Feed Health Indicator (Status dot + label with popover) */}
        <div className="relative" ref={feedRef}>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setIsFeedPopoverOpen(!isFeedPopoverOpen)}
              className="flex items-center space-x-1.5 px-2 py-1 rounded-md hover:bg-[#1D2530] transition text-xs text-[#9AA5B4] border border-transparent hover:border-[#2A3340] cursor-pointer"
              title={allFeedsFresh ? "All feeds live" : hasStale ? "Feed delay detected" : "Telemetry feed missing"}
              aria-label={allFeedsFresh ? "All feeds live" : "Data feed health status"}
            >
              <span
                className={`block w-2 h-2 rounded-full ${
                  allFeedsFresh
                    ? 'bg-[#3FB27F]'
                    : hasStale
                    ? 'bg-[#E0A33A]'
                    : 'bg-[#E5554F]'
                }`}
              />
              <span className="text-[11px] font-sans text-[#9AA5B4] hidden sm:inline">
                {allFeedsFresh ? 'All feeds live' : hasStale ? 'Feed delay' : 'Degraded'}
              </span>
            </button>

            {/* Live Traffic Feed Status Chip */}
            {liveFeedStatus && (
              <button
                onClick={onOpenDataSources}
                className={`flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-mono border transition cursor-pointer ${
                  liveFeedStatus === 'CONNECTED'
                    ? 'bg-[#3FB27F]/10 border-[#3FB27F]/30 text-[#3FB27F]'
                    : liveFeedStatus === 'DELAYED'
                    ? 'bg-[#E0A33A]/10 border-[#E0A33A]/30 text-[#E0A33A]'
                    : liveFeedStatus === 'RATE_LIMITED'
                    ? 'bg-[#F2994A]/10 border-[#F2994A]/30 text-[#F2994A]'
                    : 'bg-[#E5554F]/10 border-[#E5554F]/30 text-[#E5554F]'
                }`}
                title="Real-time ADS-B Feed. Click to view data attribution & credits"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    liveFeedStatus === 'CONNECTED'
                      ? 'bg-[#3FB27F] animate-pulse'
                      : liveFeedStatus === 'DELAYED'
                      ? 'bg-[#E0A33A]'
                      : liveFeedStatus === 'RATE_LIMITED'
                      ? 'bg-[#F2994A]'
                      : 'bg-[#E5554F]'
                  }`}
                />
                <span className="font-semibold text-[10px]">
                  {liveFeedStatus === 'CONNECTED'
                    ? 'Connected'
                    : liveFeedStatus === 'RATE_LIMITED'
                    ? 'Rate-limited'
                    : liveFeedStatus === 'DELAYED'
                    ? 'Delayed'
                    : 'Offline'}
                </span>
                {liveFeedMeta && (
                  <span className="text-[10px] opacity-75 hidden md:inline">
                    · {liveFeedMeta.secondsSinceLastUpdate}s ago
                  </span>
                )}
              </button>
            )}
          </div>

          {isFeedPopoverOpen && (
            <div className="absolute right-0 mt-1.5 w-64 bg-[#1D2530] border border-[#2A3340] rounded-lg shadow-xl p-3 text-xs z-50 animate-in fade-in space-y-2.5">
              <div className="text-[11px] font-medium text-[#657183] pb-1 border-b border-[#2A3340]">
                Telemetry & External Feeds
              </div>
              <div className="space-y-1.5">
                {feedList.map((f) => (
                  <div key={f.name} className="flex items-center justify-between text-[11px]">
                    <span className="text-[#9AA5B4]">{f.name}</span>
                    <span className="flex items-center space-x-1 text-[#657183] font-mono">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          f.freshness === 'FRESH'
                            ? 'bg-[#3FB27F]'
                            : f.freshness === 'STALE'
                            ? 'bg-[#E0A33A]'
                            : 'bg-[#E5554F]'
                        }`}
                      />
                      <span>{f.freshness.toLowerCase()}</span>
                    </span>
                  </div>
                ))}

                {/* Real-time ADS-B and Weather rows */}
                <div className="border-t border-[#2A3340]/60 pt-1.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#9AA5B4] flex items-center space-x-1">
                      <Radio className="w-3 h-3 text-[#3FB27F]" />
                      <span>OpenSky ADS-B</span>
                    </span>
                    <span className="flex items-center space-x-1 text-[#657183] font-mono">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          liveFeedStatus === 'CONNECTED'
                            ? 'bg-[#3FB27F]'
                            : liveFeedStatus === 'DELAYED'
                            ? 'bg-[#E0A33A]'
                            : 'bg-[#E5554F]'
                        }`}
                      />
                      <span>{liveFeedStatus?.toLowerCase() || 'connected'}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#9AA5B4] flex items-center space-x-1">
                      <Database className="w-3 h-3 text-[#4C8DF6]" />
                      <span>Open-Meteo</span>
                    </span>
                    <span className="flex items-center space-x-1 text-[#3FB27F] font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3FB27F]" />
                      <span>fresh</span>
                    </span>
                  </div>
                </div>
              </div>

              {onOpenDataSources && (
                <button
                  onClick={() => {
                    setIsFeedPopoverOpen(false);
                    onOpenDataSources();
                  }}
                  className="w-full mt-2 py-1.5 px-2 bg-[#161C24] hover:bg-[#222C3A] border border-[#2A3340] rounded text-[11px] text-[#4C8DF6] font-medium transition text-center cursor-pointer"
                >
                  View Data Sources & Credit Usage &rarr;
                </button>
              )}
            </div>
          )}
        </div>

        {/* Alerts Bell Popover */}
        <div className="relative" ref={alertsRef}>
          <button
            onClick={() => setIsAlertsPopoverOpen(!isAlertsPopoverOpen)}
            className="p-1.5 rounded-md hover:bg-[#1D2530] transition text-[#9AA5B4] hover:text-[#E8ECF1] relative cursor-pointer"
            title={alerts.length > 0 ? `${alerts.length} operational alerts` : 'No operational alerts'}
            aria-label={alerts.length > 0 ? `${alerts.length} operational alerts` : 'No operational alerts'}
          >
            <Bell className="w-4 h-4" />
            {alerts.length > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#E5554F]" />
            )}
          </button>

          {isAlertsPopoverOpen && (
            <div className="absolute right-0 mt-1.5 w-80 bg-[#1D2530] border border-[#2A3340] rounded-lg shadow-xl p-3 text-xs z-50 animate-in fade-in space-y-2">
              <div className="flex items-center justify-between text-[11px] font-medium text-[#657183] pb-1 border-b border-[#2A3340]">
                <span>Operational alerts</span>
                <span>{alerts.length} active</span>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1.5">
                {alerts.length === 0 ? (
                  <div className="text-center py-4 text-[#657183]">No active alerts</div>
                ) : (
                  alerts.map((alert, idx) => {
                    const isObj = typeof alert !== 'string';
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          if (isObj && onSelectAlert) {
                            onSelectAlert(alert);
                            setIsAlertsPopoverOpen(false);
                          }
                        }}
                        className={`p-2 rounded bg-[#161C24] text-[11px] text-[#E8ECF1] border border-[#2A3340]/60 leading-relaxed font-sans transition ${
                          isObj ? 'hover:bg-[#1D2530] hover:border-[#4C8DF6]/50 cursor-pointer' : ''
                        }`}
                      >
                        {isObj ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-[#E8ECF1]">{alert.title}</span>
                              <span
                                className={`text-[9px] px-1 rounded font-bold ${
                                  alert.severity === 'CRITICAL'
                                    ? 'bg-[#E5554F]/20 text-[#E5554F]'
                                    : alert.severity === 'WARNING'
                                    ? 'bg-[#E0A33A]/20 text-[#E0A33A]'
                                    : 'bg-[#4C8DF6]/20 text-[#4C8DF6]'
                                }`}
                              >
                                {alert.severity}
                              </span>
                            </div>
                            <div className="text-[#9AA5B4] text-[10px] flex items-center space-x-2">
                              <span>Asset: {alert.aircraftId}</span>
                              <span>•</span>
                              <span>{alert.timestamp}</span>
                            </div>
                            <div className="text-[11px] text-[#E8ECF1]">{alert.reason}</div>
                            <div className="text-[10px] text-[#4C8DF6] font-medium pt-0.5 flex items-center justify-between">
                              <span>Action: {alert.suggestedResponse}</span>
                              <span className="text-[9px] underline shrink-0 ml-1">Inspect &rarr;</span>
                            </div>
                          </div>
                        ) : (
                          <span>{alert}</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* History / Audit Log Trigger */}
        <button
          onClick={onOpenAuditLog}
          className="p-1.5 rounded-md hover:bg-[#1D2530] transition text-[#9AA5B4] hover:text-[#E8ECF1] cursor-pointer"
          title="Audit log and action history"
          aria-label="Audit log and action history"
        >
          <History className="w-4 h-4" />
        </button>

        {/* Theme Toggle (Light / Dark) */}
        <button
          onClick={onThemeToggle}
          className="p-1.5 rounded-md hover:bg-[#1D2530] transition text-[#9AA5B4] hover:text-[#E8ECF1] border border-transparent hover:border-[#2A3340] cursor-pointer"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-[#E0A33A]" /> : <Moon className="w-4 h-4 text-[#4C8DF6]" />}
        </button>
      </div>
    </header>
  );
};
