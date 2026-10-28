import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface DemoRunnerProps {
  isRunning: boolean;
  onStop: () => void;
  onTriggerBaseline: () => void;
  onTriggerDisruption: () => void;
  onTriggerApprove: () => void;
}

export const DemoRunner: React.FC<DemoRunnerProps> = ({
  isRunning,
  onStop,
  onTriggerBaseline,
  onTriggerDisruption,
  onTriggerApprove,
}) => {
  if (!isRunning) return null;

  const [step, setStep] = useState(1);
  const [description, setDescription] = useState('Generating baseline plan...');

  useEffect(() => {
    setStep(1);
    setDescription('Generating baseline plan...');
    onTriggerBaseline();

    const t1 = setTimeout(() => {
      setStep(2);
      setDescription('Injecting disruption: A3 unserviceable...');
      onTriggerDisruption();
    }, 5000);

    const t2 = setTimeout(() => {
      setStep(3);
      setDescription('Re-plan ready: review proposed asset swaps');
    }, 12000);

    const t3 = setTimeout(() => {
      setStep(4);
      setDescription('Commander signs off: plan approved and logged');
      onTriggerApprove();
    }, 18000);

    const tEnd = setTimeout(() => {
      onStop();
    }, 24000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(tEnd);
    };
  }, [isRunning]);

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-[#161C24] border border-[#2A3340] rounded-full px-4 py-1.5 shadow-lg flex items-center space-x-3 text-xs text-[#E8ECF1] font-sans">
      <span className="font-mono text-[11px] text-[#4C8DF6] font-semibold">
        Step {step} of 4
      </span>
      <span className="text-[#657183]">•</span>
      <span className="text-[#9AA5B4] text-xs">{description}</span>
      <button
        onClick={onStop}
        className="text-[#657183] hover:text-[#E8ECF1] ml-1 p-0.5"
        title="Stop demo"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
