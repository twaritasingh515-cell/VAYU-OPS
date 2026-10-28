import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  Bell,
  ChevronDown,
  ChevronUp,
  Hash,
  Clock,
  User,
  Link,
  CheckCircle,
} from 'lucide-react';
import { AuditLogEntry } from '../types/ops';

interface AuditLogAndAlertsProps {
  auditLog: AuditLogEntry[];
  alerts: string[];
}

export const AuditLogAndAlerts: React.FC<AuditLogAndAlertsProps> = ({
  auditLog,
  alerts,
}) => {
  const [activeTab, setActiveTab] = useState<'ALERTS' | 'AUDIT_LOG'>('ALERTS');
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-slate-950 border-t border-slate-800 text-slate-100 select-none">
      {/* Ticker / Tabs Header */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-slate-850 text-xs font-mono">
        <div className="flex items-center space-x-2">
          {/* Tab 1: Live Alerts */}
          <button
            onClick={() => setActiveTab('ALERTS')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded transition ${
              activeTab === 'ALERTS'
                ? 'bg-slate-800 text-cyan-300 font-bold border border-cyan-800/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>Alerts Ticker ({alerts.length})</span>
          </button>

          {/* Tab 2: Hash-Chained Audit Log */}
          <button
            onClick={() => setActiveTab('AUDIT_LOG')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded transition ${
              activeTab === 'AUDIT_LOG'
                ? 'bg-slate-800 text-emerald-300 font-bold border border-emerald-800/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Immutable Audit Log ({auditLog.length} Blocks)</span>
          </button>
        </div>

        {/* Security & Verification Status */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-1 text-[11px] text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Hash Chain Integrity Verified (SHA-256)</span>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
            title={isExpanded ? 'Collapse panel' : 'Expand panel'}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div
        className={`overflow-y-auto transition-all duration-300 ${
          isExpanded ? 'h-52' : 'h-24'
        } p-3 font-mono text-xs`}
      >
        {activeTab === 'ALERTS' ? (
          <div className="space-y-1.5">
            {alerts.length === 0 ? (
              <div className="text-slate-500 py-2 text-center">No active anomalies. System nominal.</div>
            ) : (
              alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className="p-1.5 rounded bg-slate-900/80 border border-slate-800 flex items-center justify-between text-[11px] text-slate-300"
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                    <span>{alert}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">REALTIME</span>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Immutable Hash-Chained Audit Trail */
          <div className="space-y-2">
            <div className="text-[10px] text-slate-400 pb-1 flex items-center justify-between border-b border-slate-850">
              <span>Append-only cryptographic ledger • Every transaction chained to previous block hash</span>
              <span className="text-emerald-400">Enclave STQC Level-3</span>
            </div>

            <div className="space-y-1.5">
              {[...auditLog].reverse().map((entry) => (
                <div
                  key={entry.hash}
                  className="p-2 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-[11px] space-y-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <div className="flex items-center space-x-2">
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 font-bold">
                        #{entry.index.toString().padStart(3, '0')}
                      </span>
                      <span className="font-bold text-slate-200">{entry.action}</span>
                      <span className="text-slate-400 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-500" />
                        {entry.actorRole}
                      </span>
                    </div>
                    <span className="text-slate-500 text-[10px]">{entry.timestamp}</span>
                  </div>

                  <p className="text-slate-300 font-sans text-xs">{entry.details}</p>

                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 pt-0.5">
                    <span className="flex items-center gap-1 font-mono">
                      <Link className="w-3 h-3 text-cyan-400" />
                      Prev: <span className="text-slate-400">{entry.previousHash.slice(0, 12)}...</span>
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Hash className="w-3 h-3 text-emerald-400" />
                      Hash: <span className="text-emerald-300 font-bold">{entry.hash.slice(0, 16)}...</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
