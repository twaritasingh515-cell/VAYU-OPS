import React from 'react';

export type StatusVariant =
  | 'Planned'
  | 'At Risk'
  | 'Unassigned'
  | 'Approved'
  | 'Executed'
  | 'Serviceable'
  | 'Maintenance'
  | 'AOG'
  | 'Fresh'
  | 'Stale'
  | 'Missing'
  | 'FRESH'
  | 'STALE'
  | 'MISSING';

interface StatusPillProps {
  status: StatusVariant;
  size?: 'sm' | 'md';
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, size = 'sm' }) => {
  const configs: Record<
    StatusVariant,
    { bg: string; border: string; text: string; dot: string; label: string }
  > = {
    FRESH: {
      bg: 'bg-[#22C55E]/10',
      border: 'border-[#22C55E]/30',
      text: 'text-[#22C55E]',
      dot: 'bg-[#22C55E]',
      label: 'FRESH',
    },
    STALE: {
      bg: 'bg-[#F59E0B]/15',
      border: 'border-[#F59E0B]/40',
      text: 'text-[#F59E0B]',
      dot: 'bg-[#F59E0B]',
      label: 'STALE',
    },
    MISSING: {
      bg: 'bg-[#EF4444]/15',
      border: 'border-[#EF4444]/40',
      text: 'text-[#EF4444]',
      dot: 'bg-[#EF4444]',
      label: 'MISSING',
    },
    Planned: {
      bg: 'bg-[#38BDF8]/10',
      border: 'border-[#38BDF8]/30',
      text: 'text-[#38BDF8]',
      dot: 'bg-[#38BDF8]',
      label: 'PLANNED',
    },
    'At Risk': {
      bg: 'bg-[#F59E0B]/15',
      border: 'border-[#F59E0B]/40',
      text: 'text-[#F59E0B]',
      dot: 'bg-[#F59E0B]',
      label: 'AT RISK',
    },
    Unassigned: {
      bg: 'bg-[#EF4444]/15',
      border: 'border-[#EF4444]/40',
      text: 'text-[#EF4444]',
      dot: 'bg-[#EF4444]',
      label: 'UNASSIGNED',
    },
    Approved: {
      bg: 'bg-[#22C55E]/15',
      border: 'border-[#22C55E]/40',
      text: 'text-[#22C55E]',
      dot: 'bg-[#22C55E]',
      label: 'APPROVED',
    },
    Executed: {
      bg: 'bg-[#9FB0CC]/10',
      border: 'border-[#9FB0CC]/30',
      text: 'text-[#9FB0CC]',
      dot: 'bg-[#9FB0CC]',
      label: 'EXECUTED',
    },
    Serviceable: {
      bg: 'bg-[#22C55E]/15',
      border: 'border-[#22C55E]/40',
      text: 'text-[#22C55E]',
      dot: 'bg-[#22C55E]',
      label: 'SERVICEABLE',
    },
    Maintenance: {
      bg: 'bg-[#F59E0B]/15',
      border: 'border-[#F59E0B]/40',
      text: 'text-[#F59E0B]',
      dot: 'bg-[#F59E0B]',
      label: 'MAINTENANCE',
    },
    AOG: {
      bg: 'bg-[#EF4444]/20',
      border: 'border-[#EF4444]/60',
      text: 'text-[#EF4444]',
      dot: 'bg-[#EF4444] animate-pulse',
      label: 'AOG LOCKOUT',
    },
    Fresh: {
      bg: 'bg-[#22C55E]/10',
      border: 'border-[#22C55E]/30',
      text: 'text-[#22C55E]',
      dot: 'bg-[#22C55E]',
      label: 'FRESH',
    },
    Stale: {
      bg: 'bg-[#F59E0B]/15',
      border: 'border-[#F59E0B]/40',
      text: 'text-[#F59E0B]',
      dot: 'bg-[#F59E0B]',
      label: 'STALE',
    },
    Missing: {
      bg: 'bg-[#EF4444]/15',
      border: 'border-[#EF4444]/40',
      text: 'text-[#EF4444]',
      dot: 'bg-[#EF4444]',
      label: 'MISSING',
    },
  };

  const c = configs[status] || configs.Planned;
  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-medium rounded border ${c.bg} ${c.border} ${c.text} ${padding} tracking-wider`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />
      <span>{c.label}</span>
    </span>
  );
};
