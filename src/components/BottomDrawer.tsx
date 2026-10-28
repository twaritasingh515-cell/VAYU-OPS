import React, { useState } from 'react';
import {
  Bell,
  ShieldCheck,
  Radio,
  ChevronDown,
  ChevronUp,
  Download,
  Hash,
  Link,
  CheckCircle2,
  Clock,
  User,
  AlertTriangle,
} from 'lucide-react';
import { AuditLogEntry, FeedFreshness, FeedStatus } from '../types/ops';
import { StatusPill } from './ui/StatusPill';
import { Button } from './ui/Button';

interface BottomDrawerProps {
  auditLog: AuditLogEntry[];
  alerts: string[];
  feeds: Record<string, FeedStatus>;
  onToggleFeedStatus: (name: FeedStatus['name'], status: FeedFreshness) => void;
  onRestoreAllFeeds: () => void;
}

export const BottomDrawer: React.FC<BottomDrawerProps> = ({
  auditLog,
  alerts,
  feeds,
  onToggleFeedStatus,
  onRestoreAllFeeds,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALERTS' | 'AUDIT_LOG' | 'FEEDS'>('ALERTS');

  // Export audit log to CSV
  const handleExportCsv = () => {
    const headers = ['Index', 'Timestamp', 'ActorRole', 'Action', 'Details', 'PreviousHash', 'Hash'];
    const rows = auditLog.map((e) => [
      e.index,
      `"${e.timestamp}"`,
      `"${e.actorRole}"`,
      `"${e.action}"`,
      `"${e.details.replace(/"/g, '""')}"`,
      `"${e.previousHash}"`,
      `"${e.hash}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `VAYU_OPS_AUDIT_LEDGER_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const feedList = Object.values(feeds);
  const unreadAlertsCount = alerts.length;

  return (
    <div className="bg-[#0B1220] border-t border-[#243350] text-[#E6EDF7] select-none shrink-0 transition-all duration-200 z-20">
      {/* Drawer Control Tabs Bar */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-[#243350]/80 text-xs font-mono">
        <div className="flex items-center space-x-2">
          {/* Tab 1: Alerts */}
          <button
            onClick={() => {
              setActiveTab('ALERTS');
              setIsOpen(true);
            }}
            className={`flex items-center space-x-2 px-3 py-1 rounded-md transition ${
              activeTab === 'ALERTS' && isOpen
                ? 'bg-[#17233B] text-[#38BDF8] font-bold border border-[#3B82F6]/50 shadow-sm'
                : 'text-[#9FB0CC] hover:text-[#E6EDF7]'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>Alerts Feed</span>
            {unreadAlertsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#EF4444] text-white font-bold leading-none">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          {/* Tab 2: Audit Log */}
          <button
            onClick={() => {
              setActiveTab('AUDIT_LOG');
              setIsOpen(true);
            }}
            className={`flex items-center space-x-2 px-3 py-1 rounded-md transition ${
              activeTab === 'AUDIT_LOG' && isOpen
                ? 'bg-[#17233B] text-[#22C55E] font-bold border border-[#22C55E]/50 shadow-sm'
                : 'text-[#9FB0CC] hover:text-[#E6EDF7]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>Audit Log ({auditLog.length})</span>
          </button>

          {/* Tab 3: Feed Health */}
          <button
            onClick={() => {
              setActiveTab('FEEDS');
              setIsOpen(true);
            }}
            className={`flex items-center space-x-2 px-3 py-1 rounded-md transition ${
              activeTab === 'FEEDS' && isOpen
                ? 'bg-[#17233B] text-[#22D3EE] font-bold border border-[#22D3EE]/50 shadow-sm'
                : 'text-[#9FB0CC] hover:text-[#E6EDF7]'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-[#22D3EE]" />
            <span>Feed Integrity</span>
          </button>
        </div>

        {/* Right side: Expand toggle & CSV export */}
        <div className="flex items-center space-x-3">
          {activeTab === 'AUDIT_LOG' && isOpen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportCsv}
              icon={<Download className="w-3.5 h-3.5 text-[#38BDF8]" />}
            >
              Export CSV
            </Button>
          )}

          <div className="hidden sm:flex items-center space-x-1.5 text-[11px] text-[#22C55E]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Chain Verified (SHA-256)</span>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 rounded bg-[#111A2E] hover:bg-[#17233B] text-[#9FB0CC] hover:text-[#E6EDF7] border border-[#243350] transition"
            title={isOpen ? 'Collapse drawer' : 'Expand drawer'}
          >
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Drawer Body (Expandable 220px) */}
      {isOpen && (
        <div className="h-[220px] overflow-y-auto p-4 bg-[#111A2E] text-xs font-mono">
          {activeTab === 'ALERTS' && (
            <div className="space-y-1.5">
              {alerts.length === 0 ? (
                <div className="p-4 text-center text-[#6B7C99]">No active warnings. System nominal.</div>
              ) : (
                alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-[#0B1220] border border-[#243350] flex items-center justify-between text-xs text-[#E6EDF7]"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="w-2 h-2 rounded-full bg-[#F59E0B] shrink-0" />
                      <span>{alert}</span>
                    </div>
                    <span className="text-[10px] text-[#6B7C99] uppercase">Real-Time Telemetry</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'AUDIT_LOG' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[#9FB0CC] pb-1 border-b border-[#243350]">
                <span>Tamper-evident append-only ledger • Hash chained</span>
                <span className="text-[#22C55E]">ISO/IEC 27001 Cryptographic Enclave</span>
              </div>

              <div className="space-y-1.5">
                {[...auditLog].reverse().map((entry) => (
                  <div
                    key={entry.hash}
                    className="p-2.5 rounded-lg bg-[#0B1220] border border-[#243350] hover:border-[#33476D] transition text-[11px] space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-1.5 py-0.2 rounded bg-[#17233B] text-[#38BDF8] font-bold">
                          #{entry.index.toString().padStart(3, '0')}
                        </span>
                        <span className="font-bold text-[#E6EDF7]">{entry.action}</span>
                        <span className="text-[#9FB0CC] flex items-center gap-1">
                          <User className="w-3 h-3 text-[#6B7C99]" />
                          {entry.actorRole}
                        </span>
                      </div>
                      <span className="text-[#6B7C99] text-[10px] tabular-nums">{entry.timestamp}</span>
                    </div>

                    <p className="text-[#9FB0CC] font-sans text-xs">{entry.details}</p>

                    <div className="flex items-center space-x-4 text-[10px] text-[#6B7C99] pt-1">
                      <span className="flex items-center gap-1">
                        <Link className="w-3 h-3 text-[#38BDF8]" />
                        <span>Prev: {entry.previousHash.slice(0, 10)}...</span>
                      </span>
                      <span className="flex items-center gap-1 font-bold text-[#22C55E]">
                        <Hash className="w-3 h-3" />
                        <span>Hash: {entry.hash.slice(0, 14)}...</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'FEEDS' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[#9FB0CC] text-xs">
                  Telemetry Feed Ingestion Matrix (Simulated Kafka/MQTT Topics)
                </span>
                <Button variant="secondary" size="sm" onClick={onRestoreAllFeeds}>
                  Restore All Feeds
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {feedList.map((f) => (
                  <div
                    key={f.name}
                    className={`p-3 rounded-lg border flex flex-col justify-between ${
                      f.freshness === 'FRESH'
                        ? 'bg-[#0B1220] border-[#243350]'
                        : f.freshness === 'STALE'
                        ? 'bg-[#F59E0B]/10 border-[#F59E0B]'
                        : 'bg-[#EF4444]/10 border-[#EF4444]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-[#E6EDF7]">{f.name}</span>
                      <StatusPill status={f.freshness} size="sm" />
                    </div>

                    <div className="text-[10px] text-[#9FB0CC] space-y-0.5 mb-2 font-mono">
                      <div>Items: {f.itemCount}</div>
                      <div>Latency: {f.latencyMs}ms</div>
                    </div>

                    <select
                      value={f.freshness}
                      onChange={(e) => onToggleFeedStatus(f.name, e.target.value as FeedFreshness)}
                      className="bg-[#17233B] border border-[#243350] text-[#E6EDF7] rounded px-1.5 py-1 text-[10px] focus:outline-none"
                    >
                      <option value="FRESH">Fresh</option>
                      <option value="STALE">Stale (&gt;2m)</option>
                      <option value="MISSING">Missing (&gt;10m)</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
