import React from 'react';
import { 
  Shield, Eye, Video, Monitor, Shuffle, CheckCircle2, 
  ArrowLeft, ArrowRight, Award, Lock, HelpCircle 
} from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';

interface SecurityProctoringStepProps {
  randomizeQuestions: boolean;
  onRandomizeQuestionsChange: (val: boolean) => void;
  randomizeOptions: boolean;
  onRandomizeOptionsChange: (val: boolean) => void;
  showResultsImmediately: boolean;
  onShowResultsImmediatelyChange: (val: boolean) => void;
  allowReview: boolean;
  onAllowReviewChange: (val: boolean) => void;
  passingScore: string;
  onPassingScoreChange: (val: string) => void;
  requireSeb: boolean;
  onRequireSebChange: (val: boolean) => void;
  enableCameraProctoring: boolean;
  onEnableCameraProctoringChange: (val: boolean) => void;
  enableScreenRecording: boolean;
  onEnableScreenRecordingChange: (val: boolean) => void;
  enableTabMonitoring: boolean;
  onEnableTabMonitoringChange: (val: boolean) => void;
  enableCopyPastePrevention: boolean;
  onEnableCopyPastePreventionChange: (val: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

export const SecurityProctoringStep: React.FC<SecurityProctoringStepProps> = ({
  randomizeQuestions,
  onRandomizeQuestionsChange,
  randomizeOptions,
  onRandomizeOptionsChange,
  showResultsImmediately,
  onShowResultsImmediatelyChange,
  allowReview,
  onAllowReviewChange,
  passingScore,
  onPassingScoreChange,
  requireSeb,
  onRequireSebChange,
  enableCameraProctoring,
  onEnableCameraProctoringChange,
  enableScreenRecording,
  onEnableScreenRecordingChange,
  enableTabMonitoring,
  onEnableTabMonitoringChange,
  enableCopyPastePrevention,
  onEnableCopyPastePreventionChange,
  onBack,
  onNext,
}) => {
  // Compute Security Level
  let securityPoints = 0;
  if (randomizeQuestions) securityPoints += 10;
  if (randomizeOptions) securityPoints += 10;
  if (enableCopyPastePrevention) securityPoints += 20;
  if (enableTabMonitoring) securityPoints += 20;
  if (enableScreenRecording) securityPoints += 15;
  if (enableCameraProctoring) securityPoints += 15;
  if (requireSeb) securityPoints += 10;
  securityPoints = Math.min(100, securityPoints);

  const securityLabel = 
    securityPoints >= 80 ? 'Strict Institutional Integrity' :
    securityPoints >= 40 ? 'Standard Proctoring' : 'Light / Formative';

  const securityBadgeColor =
    securityPoints >= 80 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
    securityPoints >= 40 ? 'bg-blue-100 text-blue-800 border-blue-300' :
    'bg-slate-100 text-slate-700 border-slate-300';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Security Posture Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="text-emerald-400" size={18} />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Academic Integrity Posture
            </span>
          </div>
          <h3 className="text-lg font-black text-white">{securityLabel}</h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Balanced anti-cheating guardrails tailored to high-stakes university standards.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Integrity Score</div>
            <div className="text-2xl font-black text-emerald-400">{securityPoints}%</div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${securityBadgeColor}`}>
            Level: {securityPoints >= 80 ? 'High' : securityPoints >= 40 ? 'Medium' : 'Basic'}
          </span>
        </div>
      </div>

      {/* 1. Exams Settings Card */}
      <Card className="border-slate-200/90 shadow-xs space-y-4">
        <div className="pb-2 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Exams Settings</h3>
          <p className="text-xs text-slate-500">Candidate flow, sequence randomization, and immediate feedback controls.</p>
        </div>

        <div className="space-y-3 divide-y divide-slate-100">
          {/* Randomize Question Order */}
          <div className="pt-2 flex items-start justify-between gap-4 cursor-pointer" onClick={() => onRandomizeQuestionsChange(!randomizeQuestions)}>
            <div className="flex-1">
              <label className="text-sm font-semibold text-slate-900 block cursor-pointer">
                Randomize Question Order
              </label>
              <p className="text-xs text-slate-500 mt-0.5">
                Questions will appear in random order for each student
              </p>
            </div>
            <input
              type="checkbox"
              checked={randomizeQuestions}
              onChange={(e) => onRandomizeQuestionsChange(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer mt-0.5"
            />
          </div>

          {/* Randomize Option Order */}
          <div className="pt-3 flex items-start justify-between gap-4 cursor-pointer" onClick={() => onRandomizeOptionsChange(!randomizeOptions)}>
            <div className="flex-1">
              <label className="text-sm font-semibold text-slate-900 block cursor-pointer">
                Randomize Option Order
              </label>
              <p className="text-xs text-slate-500 mt-0.5">
                Multiple choice options will be shuffled for each question
              </p>
            </div>
            <input
              type="checkbox"
              checked={randomizeOptions}
              onChange={(e) => onRandomizeOptionsChange(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer mt-0.5"
            />
          </div>

          {/* Show Results Immediately */}
          <div className="pt-3 flex items-start justify-between gap-4 cursor-pointer" onClick={() => onShowResultsImmediatelyChange(!showResultsImmediately)}>
            <div className="flex-1">
              <label className="text-sm font-semibold text-slate-900 block cursor-pointer">
                Show Results Immediately
              </label>
              <p className="text-xs text-slate-500 mt-0.5">
                Students see their score right after submission
              </p>
            </div>
            <input
              type="checkbox"
              checked={showResultsImmediately}
              onChange={(e) => onShowResultsImmediatelyChange(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer mt-0.5"
            />
          </div>

          {/* Allow Review */}
          <div className="pt-3 flex items-start justify-between gap-4 cursor-pointer" onClick={() => onAllowReviewChange(!allowReview)}>
            <div className="flex-1">
              <label className="text-sm font-semibold text-slate-900 block cursor-pointer">
                Allow Review
              </label>
              <p className="text-xs text-slate-500 mt-0.5">
                Students can review their answers after submission
              </p>
            </div>
            <input
              type="checkbox"
              checked={allowReview}
              onChange={(e) => onAllowReviewChange(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer mt-0.5"
            />
          </div>
        </div>
      </Card>

      {/* 2. Anti-Cheating & Device Settings Card */}
      <Card className="border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Shield className="text-blue-600" size={18} />
          <h3 className="text-base font-bold text-slate-900">Anti-Cheating & Device Settings</h3>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-4">
          {/* Require Safe Exam Browser (SEB) */}
          <div className="flex items-start justify-between gap-4 cursor-pointer" onClick={() => onRequireSebChange(!requireSeb)}>
            <div className="flex items-start gap-2.5 flex-1">
              <Lock className="text-amber-500 flex-shrink-0 mt-0.5" size={17} />
              <div>
                <label className="text-sm font-semibold text-slate-900 block cursor-pointer">
                  Require Safe Exam Browser (SEB)
                </label>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Enforce SEB lockdown (desktop/laptop only). <strong>Leave unchecked for Homework & Assignments</strong> so students can take it on mobile phones or regular browsers.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={requireSeb}
              onChange={(e) => onRequireSebChange(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer mt-0.5"
            />
          </div>

          <div className="border-t border-slate-200/60 pt-3">
            {/* Enable Camera Proctoring (Webcam) */}
            <div className="flex items-start justify-between gap-4 cursor-pointer" onClick={() => onEnableCameraProctoringChange(!enableCameraProctoring)}>
              <div className="flex items-start gap-2.5 flex-1">
                <Video className="text-blue-500 flex-shrink-0 mt-0.5" size={17} />
                <div>
                  <label className="text-sm font-semibold text-slate-900 block cursor-pointer">
                    Enable Camera Proctoring (Webcam)
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Streams live student webcam video during the test (ideal for lab exercises or remote exams).
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableCameraProctoring}
                onChange={(e) => onEnableCameraProctoringChange(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer mt-0.5"
              />
            </div>
          </div>

          <div className="border-t border-slate-200/60 pt-3">
            {/* Enable Screen Recording */}
            <div className="flex items-start justify-between gap-4 cursor-pointer" onClick={() => onEnableScreenRecordingChange(!enableScreenRecording)}>
              <div className="flex items-start gap-2.5 flex-1">
                <Monitor className="text-purple-500 flex-shrink-0 mt-0.5" size={17} />
                <div>
                  <label className="text-sm font-semibold text-slate-900 block cursor-pointer">
                    Enable Screen Recording
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Records student screen during the quiz. (Requires laptop/desktop; not supported on mobile phones).
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableScreenRecording}
                onChange={(e) => onEnableScreenRecordingChange(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer mt-0.5"
              />
            </div>
          </div>

          <div className="border-t border-slate-200/60 pt-3">
            {/* Tab Switch & Window Monitoring */}
            <div className="flex items-start justify-between gap-4 cursor-pointer" onClick={() => onEnableTabMonitoringChange(!enableTabMonitoring)}>
              <div className="flex items-start gap-2.5 flex-1">
                <Eye className="text-blue-500 flex-shrink-0 mt-0.5" size={17} />
                <div>
                  <label className="text-sm font-semibold text-slate-900 block cursor-pointer">
                    Tab Switch & Window Monitoring
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Tracks and logs when a student switches tabs or minimizes the window.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableTabMonitoring}
                onChange={(e) => onEnableTabMonitoringChange(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer mt-0.5"
              />
            </div>
          </div>

          <div className="border-t border-slate-200/60 pt-3">
            {/* Disable Copy, Paste & Right-Click */}
            <div className="flex items-start justify-between gap-4 cursor-pointer" onClick={() => onEnableCopyPastePreventionChange(!enableCopyPastePrevention)}>
              <div className="flex items-start gap-2.5 flex-1">
                <Shield className="text-emerald-500 flex-shrink-0 mt-0.5" size={17} />
                <div>
                  <label className="text-sm font-semibold text-slate-900 block cursor-pointer">
                    Disable Copy, Paste & Right-Click
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Blocks right-click context menu and copy/paste keyboard shortcuts.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableCopyPastePrevention}
                onChange={(e) => onEnableCopyPastePreventionChange(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer mt-0.5"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Passing Threshold Setting Card */}
      <Card className="border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Award className="text-amber-500" size={18} />
          <div>
            <h3 className="text-base font-bold text-slate-900">Passing Mark Threshold</h3>
            <p className="text-xs text-slate-500">Minimum percentage required for a passing grade.</p>
          </div>
        </div>

        <div className="max-w-xs space-y-2">
          <div className="flex items-center gap-2">
            {['40', '50', '60', '70'].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => onPassingScoreChange(val)}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                  passingScore === val
                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {val}%
              </button>
            ))}
          </div>
          <Input
            type="number"
            value={passingScore}
            onChange={(e) => onPassingScoreChange(e.target.value)}
            min="0"
            max="100"
            placeholder="e.g. 50"
          />
        </div>
      </Card>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold"
        >
          <ArrowLeft size={16} />
          <span>Back to Questions</span>
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={onNext}
          className="flex items-center gap-2 py-2.5 px-6 font-bold shadow-sm"
        >
          <span>Continue to Final Review</span>
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
};
