import React from 'react';
import { MissionPriority } from '../../types/ops';

interface PriorityChipProps {
  priority: MissionPriority;
  size?: 'sm' | 'md';
}

export const PriorityChip: React.FC<PriorityChipProps> = ({ priority, size = 'md' }) => {
  const configs = {
    P1: {
      bg: 'bg-[#EF4444]/15',
      border: 'border-[#EF4444]/60',
      text: 'text-[#FCA5A5]',
      dot: 'bg-[#EF4444]',
      label: 'P1 CRITICAL',
    },
    P2: {
      bg: 'bg-[#F59E0B]/15',
      border: 'border-[#F59E0B]/60',
      text: 'text-[#FDE68A]',
      dot: 'bg-[#F59E0B]',
      label: 'P2 PRIORITY',
    },
    P3: {
      bg: 'bg-[#38BDF8]/15',
      border: 'border-[#38BDF8]/60',
      text: 'text-[#BAE6FD]',
      dot: 'bg-[#38BDF8]',
      label: 'P3 ROUTINE',
    },
  };

  const c = configs[priority] || configs.P3;
  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-semibold rounded border ${c.bg} ${c.border} ${c.text} ${padding} tracking-wider`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />
      <span>{c.label}</span>
    </span>
  );
};
