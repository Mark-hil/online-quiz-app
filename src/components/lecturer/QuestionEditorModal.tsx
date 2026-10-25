import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  CheckCircle2, 
  Circle, 
  HelpCircle, 
  Plus, 
  Trash2, 
  FileText, 
  CheckSquare, 
  ToggleLeft, 
  AlertCircle
} from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { parseOptions } from '../../utils/quizUtils';

export interface QuestionForm {
  question_text: string;
  question_type: 'mcq' | 'true_false' | 'essay';
  options: string[];
  correct_answer: string;
  marks: number;
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  status?: 'active' | 'retired' | 'draft';
}

interface QuestionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: QuestionForm;
  isEditing: boolean;
  onSave: (question: QuestionForm) => void;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  bankMode?: boolean;
  courseCode?: string;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function QuestionEditorModal({
  isOpen,
  onClose,
  question,
  isEditing,
  onSave,
  title,
  subtitle,
  submitLabel,
  bankMode = false,
  courseCode
}: QuestionEditorModalProps) {
  const [formData, setFormData] = useState<QuestionForm>({
    question_text: '',
    question_type: 'mcq',
    options: ['', '', '', ''],
    correct_answer: '',
    marks: 1,
    topic: 'General',
    difficulty: 'medium',
    status: 'active'
  });
  const [localError, setLocalError] = useState('');

  // Sync state when modal opens or question changes
  useEffect(() => {
    if (isOpen) {
      setLocalError('');
      const parsedOpts = parseOptions(question.options);
      const safeOpts = parsedOpts.length >= 2 
        ? parsedOpts 
        : ['', '', '', ''];
      
      // Ensure at least 4 slots for MCQ if less than 4
      const paddedOpts = safeOpts.length < 4 
        ? [...safeOpts, ...Array(4 - safeOpts.length).fill('')]
        : safeOpts;

      // Handle correct_answer if stored as letter ('A', 'B', etc.)
      let resolvedCorrect = question.correct_answer || '';
      const letterIdx = OPTION_LETTERS.indexOf(resolvedCorrect.toUpperCase());
      if (letterIdx >= 0 && letterIdx < paddedOpts.length && paddedOpts[letterIdx]?.trim()) {
        if (!paddedOpts.includes(resolvedCorrect)) {
          resolvedCorrect = paddedOpts[letterIdx];
        }
      }

      setFormData({
        question_text: question.question_text || '',
        question_type: question.question_type || 'mcq',
        options: paddedOpts,
        correct_answer: resolvedCorrect,
        marks: question.marks || 1,
        topic: question.topic || 'General',
        difficulty: question.difficulty || 'medium',
        status: question.status || 'active'
      });
    }
  }, [isOpen, question]);

  // Lock background body scroll and listen for Escape key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleTypeChange = (newType: 'mcq' | 'true_false' | 'essay') => {
    setLocalError('');
    if (newType === 'true_false') {
      const currentAns = formData.correct_answer.toLowerCase();
      const validTf = currentAns === 'true' || currentAns === 'false' 
        ? (currentAns === 'true' ? 'True' : 'False') 
        : 'True';
      setFormData(prev => ({
        ...prev,
        question_type: newType,
        options: ['True', 'False'],
        correct_answer: validTf
      }));
    } else if (newType === 'essay') {
      setFormData(prev => ({
        ...prev,
        question_type: newType,
        options: [],
        correct_answer: ''
      }));
    } else {
      // MCQ
      const parsed = parseOptions(formData.options);
      const opts = parsed.length >= 4 
        ? parsed.slice(0, 4) 
        : [...parsed, ...Array(Math.max(0, 4 - parsed.length)).fill('')];
      setFormData(prev => ({
        ...prev,
        question_type: newType,
        options: opts,
        correct_answer: ''
      }));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const oldVal = formData.options[index];
    const newOptions = [...formData.options];
    newOptions[index] = value;

    // If this option was selected as the correct answer, keep correct_answer in sync
    let newCorrect = formData.correct_answer;
    if (formData.correct_answer === oldVal && oldVal.trim() !== '') {
      newCorrect = value;
    }

    setFormData(prev => ({
      ...prev,
      options: newOptions,
      correct_answer: newCorrect
    }));
  };

  const handleSetCorrectAnswer = (optionValue: string) => {
    setLocalError('');
    setFormData(prev => ({
      ...prev,
      correct_answer: optionValue
    }));
  };

  const handleAddOption = () => {
    if (formData.options.length >= 6) return;
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const handleRemoveOption = (indexToRemove: number) => {
    if (formData.options.length <= 2) return;
    const removedVal = formData.options[indexToRemove];
    const newOptions = formData.options.filter((_, idx) => idx !== indexToRemove);
    let newCorrect = formData.correct_answer;
    if (newCorrect === removedVal) {
      newCorrect = '';
    }
    setFormData(prev => ({
      ...prev,
      options: newOptions,
      correct_answer: newCorrect
    }));
  };

  const handleSave = () => {
    setLocalError('');

    if (!formData.question_text.trim()) {
      setLocalError('Question prompt / text is required.');
      return;
    }

    if (formData.question_type === 'mcq') {
      const validOptions = formData.options.map(o => o.trim()).filter(Boolean);
      if (validOptions.length < 2) {
        setLocalError('Multiple choice questions require at least 2 non-empty options.');
        return;
      }
      if (!formData.correct_answer || !validOptions.includes(formData.correct_answer.trim())) {
        setLocalError('Please select a valid correct answer choice.');
        return;
      }
    } else if (formData.question_type === 'true_false') {
      const norm = formData.correct_answer.trim().toLowerCase();
      if (norm !== 'true' && norm !== 'false') {
        setLocalError('Please specify whether True or False is the correct answer.');
        return;
      }
    }

    if (!formData.marks || formData.marks < 1) {
      setLocalError('Marks allocation must be at least 1 point.');
      return;
    }

    onSave({
      ...formData,
      question_text: formData.question_text.trim(),
      options: formData.question_type === 'mcq' 
        ? formData.options.map(o => o.trim())
        : (formData.question_type === 'true_false' ? ['True', 'False'] : []),
      correct_answer: formData.correct_answer.trim(),
      marks: Number(formData.marks) || 1
    });
  };

  const modalNode = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200 z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center border border-blue-200/60">
              <HelpCircle size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  {title || (isEditing ? 'Edit Question' : (bankMode ? `Add Question to ${courseCode || 'Bank'}` : 'Add New Question'))}
                </h3>
                <Badge variant={isEditing ? 'warning' : 'primary'}>
                  {isEditing ? 'Editing' : 'New'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {subtitle || (bankMode ? 'Configure question details, calibration difficulty, and answer choices' : 'Define the question prompt, answer choices, and scoring rules')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 p-2 rounded-xl transition-colors"
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* Validation Alert */}
          {localError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-3 text-red-800 text-sm animate-fadeIn">
              <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{localError}</div>
            </div>
          )}

          {/* Bank Mode Metadata Card (Topic, Difficulty, Status) */}
          {bankMode && (
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-3.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Question Bank Attributes {courseCode ? `• ${courseCode}` : ''}
                </span>
                {formData.status && isEditing && (
                  <Badge variant={formData.status === 'active' ? 'success' : formData.status === 'retired' ? 'secondary' : 'warning'}>
                    {formData.status.toUpperCase()}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Topic / Sub-topic
                  </label>
                  <input
                    type="text"
                    value={formData.topic || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                    placeholder="e.g. Loops, SQL, Algorithms"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Empirical Difficulty
                  </label>
                  <select
                    value={formData.difficulty || 'medium'}
                    onChange={(e) => setFormData(prev => ({ ...prev, difficulty: e.target.value as any }))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                  >
                    <option value="easy">🟢 Easy (Foundational)</option>
                    <option value="medium">🟡 Medium (Standard)</option>
                    <option value="hard">🔴 Hard (Advanced)</option>
                  </select>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Calibrates after 5 student exam attempts.
                  </span>
                </div>

                {isEditing && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Pool Status
                    </label>
                    <select
                      value={formData.status || 'active'}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                    >
                      <option value="active">Active (Available for Draw)</option>
                      <option value="retired">Retired (Past Term)</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Question Type Segmented Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Question Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleTypeChange('mcq')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                  formData.question_type === 'mcq'
                    ? 'bg-blue-50/80 border-blue-500 text-blue-900 font-semibold shadow-xs ring-1 ring-blue-500'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className={`p-2 rounded-lg ${formData.question_type === 'mcq' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <CheckSquare size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold">Multiple Choice</div>
                  <div className="text-[11px] text-slate-500">A, B, C, D choices</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('true_false')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                  formData.question_type === 'true_false'
                    ? 'bg-blue-50/80 border-blue-500 text-blue-900 font-semibold shadow-xs ring-1 ring-blue-500'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className={`p-2 rounded-lg ${formData.question_type === 'true_false' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <ToggleLeft size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold">True / False</div>
                  <div className="text-[11px] text-slate-500">Binary decision</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('essay')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                  formData.question_type === 'essay'
                    ? 'bg-blue-50/80 border-blue-500 text-blue-900 font-semibold shadow-xs ring-1 ring-blue-500'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className={`p-2 rounded-lg ${formData.question_type === 'essay' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <FileText size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold">Essay / Theory</div>
                  <div className="text-[11px] text-slate-500">Open-ended answer</div>
                </div>
              </button>
            </div>
          </div>

          {/* Question Text Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Question Prompt <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {formData.question_text.length} characters
              </span>
            </div>
            <textarea
              rows={3}
              value={formData.question_text}
              onChange={(e) => setFormData(prev => ({ ...prev, question_text: e.target.value }))}
              placeholder="e.g. What is the derivative of sin(x) with respect to x?"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400 leading-relaxed font-sans"
              required
            />
          </div>

          {/* Multiple Choice Options Builder */}
          {formData.question_type === 'mcq' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Answer Options & Correct Key <span className="text-red-500">*</span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Type the choice text and click the key badge to designate the correct answer.
                  </p>
                </div>
                {formData.options.length < 6 && (
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                  >
                    <Plus size={13} />
                    <span>Add Choice</span>
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {formData.options.map((option, idx) => {
                  const letter = OPTION_LETTERS[idx] || `${idx + 1}`;
                  const isSelected = Boolean(
                    formData.correct_answer && 
                    option.trim() !== '' &&
                    (
                      formData.correct_answer.trim() === option.trim() ||
                      OPTION_LETTERS.indexOf(formData.correct_answer.trim().toUpperCase()) === idx
                    )
                  );

                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Option Alphabet Badge */}
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}
                      >
                        {letter}
                      </div>

                      {/* Input Field */}
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`Option ${letter} text...`}
                        className="flex-1 min-w-0 bg-transparent border-0 px-2 py-1 text-sm text-slate-900 focus:outline-none placeholder:text-slate-400 font-medium"
                      />

                      {/* Correct Answer Toggle Button */}
                      <button
                        type="button"
                        onClick={() => handleSetCorrectAnswer(option)}
                        disabled={!option.trim()}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200'
                        }`}
                        title={isSelected ? 'This is marked as the correct answer' : 'Click to mark as correct answer'}
                      >
                        {isSelected ? (
                          <>
                            <CheckCircle2 size={14} className="text-white" />
                            <span>Correct Key</span>
                          </>
                        ) : (
                          <>
                            <Circle size={14} className="text-slate-400" />
                            <span>Set Correct</span>
                          </>
                        )}
                      </button>

                      {/* Delete Option Button (allowed if > 2) */}
                      {formData.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                          title="Remove this option"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* True / False Cards */}
          {formData.question_type === 'true_false' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Designate Correct Answer <span className="text-red-500">*</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Select whether the stated premise is True or False.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {['True', 'False'].map((val) => {
                  const isSelected = formData.correct_answer.toLowerCase() === val.toLowerCase();
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleSetCorrectAnswer(val)}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950 font-bold shadow-sm ring-2 ring-emerald-500/20'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 border border-slate-300'
                          }`}
                        >
                          {val === 'True' ? 'T' : 'F'}
                        </div>
                        <span className="text-sm">{val}</span>
                      </div>
                      {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                          <CheckCircle2 size={14} />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Essay Instructions Notice */}
          {formData.question_type === 'essay' && (
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs space-y-1.5 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <FileText size={15} />
                <span>Essay / Subjective Question Guidance</span>
              </div>
              <p className="text-amber-800">
                Students will be provided an open-ended rich response area. Submissions for this question will require manual grading and evaluation against institutional rubrics.
              </p>
            </div>
          )}

          {/* Marks Allocation & Scoring */}
          <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Marks Allocation <span className="text-red-500">*</span>
              </label>
              <p className="text-[11px] text-slate-500">
                Points awarded for answering this question correctly.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.marks}
                  onChange={(e) => setFormData(prev => ({ ...prev, marks: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                  className="w-24 pl-3 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <span className="absolute right-2.5 top-2.5 text-xs font-semibold text-slate-400 pointer-events-none">
                  pts
                </span>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1">
                {[1, 2, 5, 10].map(pts => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, marks: pts }))}
                    className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                      formData.marks === pts 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {pts}p
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20"
          >
            <CheckCircle2 size={16} />
            <span>{submitLabel || (isEditing ? 'Update Question' : (bankMode ? 'Add to Bank' : 'Add to Exam'))}</span>
          </Button>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalNode, document.body)
    : modalNode;
}
