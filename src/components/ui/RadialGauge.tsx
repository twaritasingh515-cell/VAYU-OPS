import React from 'react';

interface RadialGaugeProps {
  value: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  label?: string;
  inverseColors?: boolean; // If true, lower is better (e.g. Risk)
}

export const RadialGauge: React.FC<RadialGaugeProps> = ({
  value,
  size = 54,
  strokeWidth = 5,
  label,
  inverseColors = false,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  let strokeColor = '#22C55E';
  if (inverseColors) {
    // For Risk: <35 green, 35-65 yellow, >65 red
    if (clamped > 65) strokeColor = '#EF4444';
    else if (clamped > 35) strokeColor = '#F59E0B';
    else strokeColor = '#22C55E';
  } else {
    // For Coverage / Readiness: >=90 green, >=75 yellow, <75 red
    if (clamped >= 90) strokeColor = '#22C55E';
    else if (clamped >= 70) strokeColor = '#F59E0B';
    else strokeColor = '#EF4444';
  }

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#243350"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono text-xs font-bold text-[#E6EDF7] leading-none">
          {Math.round(clamped)}%
        </span>
        {label && <span className="text-[9px] text-[#6B7C99] font-mono leading-none mt-0.5">{label}</span>}
      </div>
    </div>
  );
};
