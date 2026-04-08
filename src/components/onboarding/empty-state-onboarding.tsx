"use client";

import { useState } from "react";
import { Sprout, Mic, Bot, BarChart3, Shield, ChevronRight, Check } from "lucide-react";

interface EmptyStateOnboardingProps {
  onCreatePlant: () => void;
}

const steps = [
  {
    icon: <Sprout className="h-10 w-10 text-lime-400" />,
    title: "Welcome to G-Buddy",
    subtitle: "Your AI-powered grow companion",
    features: [
      { icon: <Mic className="h-4 w-4" />, text: "Log your grow data with natural language" },
      { icon: <Bot className="h-4 w-4" />, text: "Ask AI anything related to your cultivation" },
      { icon: <BarChart3 className="h-4 w-4" />, text: "Track VPD, climate & watering history to get custom insights" }
    ],
    action: "Next"
  },
  {
    icon: <Shield className="h-10 w-10 text-lime-400" />,
    title: "100% Private. 100% Yours.",
    subtitle: "Your data never leaves your device",
    features: [
      { icon: <Shield className="h-4 w-4" />, text: "No cloud storage, no accounts needed" },
      { icon: <Shield className="h-4 w-4" />, text: "All data stays in your browser" },
      { icon: <Shield className="h-4 w-4" />, text: "Export to Excel and record your grow journey" }
    ],
    action: "Create New Plant"
  }
];

export function EmptyStateOnboarding({ onCreatePlant }: EmptyStateOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onCreatePlant();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  return (
    <div className="glass-panel rounded-3xl p-8 max-w-md">
      {/* Icon */}
      <div className="flex justify-center mb-6">
        <div className="rounded-2xl bg-lime-400/10 p-4 ring-1 ring-lime-400/20">
          {step.icon}
        </div>
      </div>

      {/* Title */}
      <h2 className="text-center text-xl font-semibold text-lime-100">
        {step.title}
      </h2>
      <p className="mt-1 text-center text-sm text-lime-100/70">
        {step.subtitle}
      </p>

      {/* Features */}
      <div className="mt-6 space-y-3">
        {step.features.map((feature, index) => (
          <div key={index} className="flex items-center gap-3 text-sm text-lime-100/80">
            <span className="shrink-0 text-lime-400">{feature.icon}</span>
            <span>{feature.text}</span>
          </div>
        ))}
      </div>

      {/* Dots */}
      <div className="mt-6 flex justify-center gap-2">
        {steps.map((_, index) => (
          <div
            key={index}
            className={`h-1.5 rounded-full transition-all ${
              index === currentStep ? "w-8 bg-lime-400" : "w-1.5 bg-lime-400/40"
            }`}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-between">
        {currentStep > 0 ? (
          <button
            onClick={() => setCurrentStep((prev) => prev - 1)}
            className="text-sm text-lime-100/50 hover:text-lime-100 transition-colors"
          >
            Back
          </button>
        ) : (
          <div />
        )}

        <button
          onClick={handleNext}
          className="flex items-center gap-2 rounded-lg bg-lime-400/20 px-5 py-2.5 text-sm font-semibold text-lime-100 border border-lime-400/30 hover:bg-lime-400/30 transition-colors"
        >
          {isLastStep ? (
            <>
              <Check className="h-4 w-4" />
              {step.action}
            </>
          ) : (
            <>
              {step.action}
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}