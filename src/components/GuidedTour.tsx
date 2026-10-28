import React, { useState } from 'react';
import { X, ArrowRight, ArrowLeft, CheckCircle2, Compass, Shield } from 'lucide-react';
import { Button } from './ui/Button';

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: '1. Mission Queue & Operational Demand',
      description:
        'The left rail displays real-time military taskings categorized by priority (P1 Critical, P2 Priority, P3 Routine). Each card displays required roles (CAP, Strike, ISR, Transport), time windows, assigned platforms, and predictive threat & weather scores.',
      highlight: 'Left Rail',
    },
    {
      title: '2. Plan Timeline & Tactical Map Workspace',
      description:
        'The center workspace pairs a Gantt sortie timeline with an interactive SVG tactical airspace picture. Hover over any block to inspect crew, ordnance, and constraints; view real-time SAM radar bubbles, airbase staging locations, and active flight paths.',
      highlight: 'Center Workspace',
    },
    {
      title: '3. Decision Panel & AI Explainability',
      description:
        'The right panel presents the optimal constraint-solved Air Tasking Order alongside two what-if alternatives. Gemini 3.8 Flash delivers natural language operational reasoning with factor contribution bars. Human Commander keeps final decision authority.',
      highlight: 'Right Panel',
    },
    {
      title: '4. Dynamic Re-Plan & Telemetry Resilience',
      description:
        'When disruptions occur—such as an aircraft going unserviceable (A3 AOG) or a pop-up SAM threat—the system re-optimises in milliseconds, displays a before-vs-after delta diff, and allows the Commander to endorse or manually override.',
      highlight: 'Command Bar & Bottom Drawer',
    },
  ];

  const current = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#111A2E] border border-[#243350] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden text-[#E6EDF7] font-sans">
        {/* Header */}
        <div className="p-4 bg-[#0B1220] border-b border-[#243350] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Compass className="w-5 h-5 text-[#38BDF8]" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider">
              VAYU-OPS Guided Operational Tour (Step {currentStep + 1} of {steps.length})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#6B7C99] hover:text-[#E6EDF7] rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Content */}
        <div className="p-5 space-y-4">
          <div className="text-[10px] font-mono text-[#38BDF8] uppercase tracking-widest">
            FOCAL ZONE: {current.highlight}
          </div>
          <h4 className="text-base font-bold text-[#E6EDF7]">{current.title}</h4>
          <p className="text-xs text-[#9FB0CC] leading-relaxed">{current.description}</p>

          {/* Step Progress Dots */}
          <div className="flex items-center space-x-2 pt-2">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStep ? 'w-8 bg-[#3B82F6]' : 'w-2 bg-[#243350]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0B1220] border-t border-[#243350] flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs font-mono text-[#6B7C99] hover:text-[#E6EDF7]"
          >
            Skip Tour
          </button>
          <div className="flex items-center space-x-2">
            {currentStep > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep((p) => p - 1)}
                icon={<ArrowLeft className="w-3.5 h-3.5" />}
              >
                Back
              </Button>
            )}
            {currentStep < steps.length - 1 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCurrentStep((p) => p + 1)}
                icon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Next Step
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={onClose}
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Start Operating
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
