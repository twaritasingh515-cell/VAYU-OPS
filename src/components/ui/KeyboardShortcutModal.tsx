import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutModal: React.FC<KeyboardShortcutModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'A', desc: 'Approve active Air Tasking Plan (Commander role)' },
    { key: 'O', desc: 'Open Manual Override matrix (reassign assets)' },
    { key: 'R', desc: 'Trigger Dynamic Re-plan on disruption' },
    { key: '/', desc: 'Focus mission queue search box' },
    { key: 'D', desc: 'Execute 60-Second Autonomous Demo flow' },
    { key: '1', desc: 'Switch to Mode 1 (Planning Cycle)' },
    { key: '2', desc: 'Switch to Mode 2 (Dynamic Re-Plan)' },
    { key: '3', desc: 'Switch to Mode 3 (Degraded Data Telemetry)' },
    { key: 'Esc', desc: 'Close open dialogs & inspectors' },
    { key: '?', desc: 'Show this keyboard shortcut sheet' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#111A2E] border border-[#243350] rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-[#E6EDF7]">
        {/* Header */}
        <div className="p-4 bg-[#0B1220] border-b border-[#243350] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Keyboard className="w-5 h-5 text-[#38BDF8]" />
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider">
              Command Keybindings
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#6B7C99] hover:text-[#E6EDF7] rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="p-4 divide-y divide-[#243350]/60 space-y-1">
          {shortcuts.map((s) => (
            <div key={s.key} className="py-2 flex items-center justify-between text-xs">
              <span className="text-[#9FB0CC] font-sans">{s.desc}</span>
              <kbd className="px-2 py-0.5 rounded font-mono text-xs bg-[#17233B] border border-[#33476D] text-[#38BDF8] font-bold shadow-sm">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0B1220] border-t border-[#243350] text-[11px] font-mono text-[#6B7C99] text-center">
          Tactical Hotkeys Active • Press <kbd className="text-[#9FB0CC]">Esc</kbd> to exit
        </div>
      </div>
    </div>
  );
};
