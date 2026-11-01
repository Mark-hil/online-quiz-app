import React from 'react';
import { Check, BookOpen, Layers, Shield, CheckCircle2, Clock } from 'lucide-react';
import { WizardStep } from './types';

interface StepperHeaderProps {
  currentStep: WizardStep;
  onStepChange: (step: WizardStep) => void;
  maxStepReached: number;
  totalQuestions: number;
  totalMarks: number;
  durationMinutes: number;
  isEditMode: boolean;
  lastAutoSaved?: Date | null;
}

const STEPS = [
  { step: 1 as WizardStep, label: 'Basics & Identity', icon: BookOpen, desc: 'Course & schedule' },
  { step: 2 as WizardStep, label: 'Questions Strategy', icon: Layers, desc: 'Fixed set or dynamic bank' },
  { step: 3 as WizardStep, label: 'Security & Proctoring', icon: Shield, desc: 'Anti-cheat & monitoring' },
  { step: 4 as WizardStep, label: 'Review & Launch', icon: CheckCircle2, desc: 'Readiness checklist' },
];

export const StepperHeader: React.FC<StepperHeaderProps> = ({
  currentStep,
  onStepChange,
  maxStepReached,
  totalQuestions,
  totalMarks,
  durationMinutes,
  isEditMode,
  lastAutoSaved,
}) => {
  const progressPercent = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xs p-4 sm:p-5 mb-6 sticky top-0 z-30 transition-all">
      {/* Top Header Row with Metadata Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3.5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
              {isEditMode ? 'Edit Assessment Studio' : 'New Assessment Studio'}
            </span>
            {lastAutoSaved && (
              <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                <Clock size={12} className="text-emerald-500" />
                Draft saved {lastAutoSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
            {isEditMode ? 'Configure Assessment' : 'Create Examination or Quiz'}
          </h1>
        </div>

        {/* Live Metrics Quick Badges */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Questions:</span>
            <span className="font-bold text-slate-900">{totalQuestions}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-blue-50/80 border border-blue-200 text-xs flex items-center gap-1.5 text-blue-900">
            <span className="text-blue-700 font-medium">Total Marks:</span>
            <span className="font-bold text-blue-950">{totalMarks}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-purple-50/80 border border-purple-200 text-xs flex items-center gap-1.5 text-purple-900">
            <span className="text-purple-700 font-medium">Duration:</span>
            <span className="font-bold text-purple-950">{durationMinutes}m</span>
          </div>
        </div>
      </div>

      {/* Modern Stepper Track */}
      <div className="relative">
        {/* Background Track Line */}
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 rounded-full hidden md:block" />
        {/* Active Progress Fill Line */}
        <div 
          className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 -translate-y-1/2 rounded-full transition-all duration-300 hidden md:block" 
          style={{ width: `${progressPercent}%` }}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
          {STEPS.map(({ step, label, icon: Icon, desc }) => {
            const isCompleted = step < currentStep;
            const isCurrent = step === currentStep;
            const isAccessible = step <= maxStepReached || isCompleted;

            return (
              <button
                key={step}
                type="button"
                onClick={() => {
                  if (isAccessible) onStepChange(step);
                }}
                disabled={!isAccessible}
                className={`flex items-center gap-3 p-2.5 sm:p-3 rounded-xl border transition-all text-left group ${
                  isCurrent
                    ? 'bg-blue-50/90 border-blue-400 shadow-sm ring-2 ring-blue-500/20'
                    : isCompleted
                      ? 'bg-white border-emerald-300 hover:border-emerald-400 hover:bg-emerald-50/30 cursor-pointer'
                      : isAccessible
                        ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer'
                        : 'bg-slate-50/60 border-slate-200/60 opacity-60 cursor-not-allowed'
                }`}
              >
                {/* Step Icon / Number Pill */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 transition-colors shadow-2xs ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 group-hover:bg-slate-200'
                  }`}
                >
                  {isCompleted ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}
                </div>

                {/* Step Texts */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${
                      isCurrent ? 'text-blue-700' : isCompleted ? 'text-emerald-700' : 'text-slate-500'
                    }`}>
                      Step {step}
                    </span>
                    {isCompleted && (
                      <span className="text-[10px] font-bold text-emerald-600">✓ Done</span>
                    )}
                  </div>
                  <div className={`text-xs sm:text-sm font-bold truncate ${
                    isCurrent ? 'text-blue-950 font-black' : 'text-slate-900'
                  }`}>
                    {label}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate hidden sm:block">
                    {desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
