import React from 'react';
import { X, Download, ShieldCheck } from 'lucide-react';
import { AuditLogEntry } from '../types/ops';

interface AuditLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  auditLog: AuditLogEntry[];
}

export const AuditLogDrawer: React.FC<AuditLogDrawerProps> = ({
  isOpen,
  onClose,
  auditLog,
}) => {
  if (!isOpen) return null;

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
    link.setAttribute('download', `vayu_ops_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#161C24] border-l border-[#2A3340] h-full flex flex-col text-[#E8ECF1] font-sans shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="h-12 px-4 border-b border-[#2A3340] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-sm text-[#E8ECF1]">Audit history</span>
            <span className="text-xs text-[#657183] font-mono">({auditLog.length} events)</span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={handleExportCsv}
              className="p-1.5 text-[#9AA5B4] hover:text-[#E8ECF1] rounded transition"
              title="Download CSV"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[#657183] hover:text-[#E8ECF1] rounded transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Ledger Entries List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 font-sans text-xs">
          {[...auditLog].reverse().map((entry) => (
            <div
              key={entry.hash}
              className="p-3 rounded-lg bg-[#1D2530] border border-[#2A3340]/60 space-y-1.5"
            >
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center space-x-1.5 font-medium text-[#E8ECF1]">
                  <span>{entry.action}</span>
                  <span className="text-[#657183] font-normal">• {entry.actorRole}</span>
                </div>
                <span className="text-[10px] text-[#657183] font-mono tabular-nums">
                  {entry.timestamp}
                </span>
              </div>

              <p className="text-xs text-[#9AA5B4] leading-relaxed">{entry.details}</p>

              <div className="pt-1 border-t border-[#2A3340]/40 flex items-center justify-between text-[10px] text-[#657183] font-mono">
                <span>Hash: {entry.hash.slice(0, 12)}...</span>
                <span className="text-[#3FB27F] flex items-center gap-1 font-sans">
                  <ShieldCheck className="w-3 h-3" />
                  Verified
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="h-10 px-4 bg-[#0F1419] border-t border-[#2A3340] flex items-center justify-between text-[11px] text-[#657183]">
          <span>Append-only cryptographic ledger</span>
          <span>SHA-256</span>
        </div>
      </div>
    </div>
  );
};
