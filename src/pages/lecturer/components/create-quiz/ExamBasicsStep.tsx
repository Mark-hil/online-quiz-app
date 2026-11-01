import React from 'react';
import { 
  BookOpen, Plus, Tag, CheckCircle2, Calendar, Clock, 
  HelpCircle, ArrowRight, Sparkles 
} from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import Textarea from '../../../../components/ui/Textarea';
import { Course, AssessmentCategory, AssessmentCategoryItem } from '../../../../lib/database';
import { ASSESSMENT_CATEGORIES, getCategoryColorBadgeClasses } from '../../../../utils/categoryUtils';

interface ExamBasicsStepProps {
  courseId: string;
  onCourseChange: (courseId: string) => void;
  courses: Course[];
  onOpenAddCourseModal: () => void;
  title: string;
  onTitleChange: (val: string) => void;
  category: AssessmentCategory;
  onCategoryChange: (cat: AssessmentCategory) => void;
  categoryPrefix: string;
  onCategoryPrefixChange: (prefix: string) => void;
  courseCategories: AssessmentCategoryItem[];
  onOpenCategoryModal: () => void;
  subject: string;
  onSubjectChange: (val: string) => void;
  description: string;
  onDescriptionChange: (val: string) => void;
  duration: string;
  onDurationChange: (val: string) => void;
  deadlineDate: string;
  onDeadlineDateChange: (val: string) => void;
  deadlineTime: string;
  onDeadlineTimeChange: (val: string) => void;
  onNext: () => void;
  isEditMode: boolean;
}

const DURATION_PRESETS = [
  { label: '15 mins', value: '15' },
  { label: '30 mins', value: '30' },
  { label: '45 mins', value: '45' },
  { label: '1 hour', value: '60' },
  { label: '1.5 hours', value: '90' },
  { label: '2 hours', value: '120' },
  { label: '3 hours', value: '180' },
];

export const ExamBasicsStep: React.FC<ExamBasicsStepProps> = ({
  courseId,
  onCourseChange,
  courses,
  onOpenAddCourseModal,
  title,
  onTitleChange,
  category,
  onCategoryChange,
  categoryPrefix,
  onCategoryPrefixChange,
  courseCategories,
  onOpenCategoryModal,
  subject,
  onSubjectChange,
  description,
  onDescriptionChange,
  duration,
  onDurationChange,
  deadlineDate,
  onDeadlineDateChange,
  deadlineTime,
  onDeadlineTimeChange,
  onNext,
}) => {
  const selectedCourse = courses.find(c => c.id === courseId);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Card 1: Course & Title Identity */}
      <Card className="border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <BookOpen className="text-blue-600" size={20} />
          <div>
            <h2 className="text-base font-bold text-slate-900">Institutional Course & Identity</h2>
            <p className="text-xs text-slate-500">Every assessment belongs to a certified institutional course context.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Course Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Institutional Course <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={onOpenAddCourseModal}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
              >
                <Plus size={13} />
                <span>New Course</span>
              </button>
            </div>
            <select
              value={courseId}
              onChange={(e) => onCourseChange(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white font-medium text-slate-800 shadow-2xs"
            >
              <option value="">-- Choose Course (e.g. CS101, ENG202) --</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.title}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Selecting a course connects this exam to its dedicated Question Bank and question pools.
            </p>
          </div>

          {/* Exam Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Assessment Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="e.g. Mid-Semester Examination 2026"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white font-medium text-slate-800 shadow-2xs"
            />
            <p className="text-[11px] text-slate-500 mt-1.5">
              Official title shown to students in timetables and grade transcripts.
            </p>
          </div>
        </div>

        {/* Assessment Classification Tier */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Assessment Tier & Weighting <span className="text-rose-500">*</span>
              </label>
              <p className="text-xs text-slate-500">
                Choose the academic classification to apply standard defaults and grading curves.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
            {ASSESSMENT_CATEGORIES.map((cat) => {
              const isSelected = category === cat.key;
              const emoji = 
                cat.key === 'final_exam' ? '🎓' :
                cat.key === 'mid_semester' ? '📝' :
                cat.key === 'class_test' ? '📋' :
                cat.key === 'quiz' ? '⚡' : '🎯';

              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => {
                    onCategoryChange(cat.key);
                    // Smart default durations
                    if (cat.key === 'final_exam' && (!duration || duration === '30' || duration === '60')) {
                      onDurationChange('120');
                    } else if (cat.key === 'mid_semester' && (!duration || duration === '30' || duration === '120')) {
                      onDurationChange('60');
                    } else if (cat.key === 'quiz' && (!duration || duration === '120' || duration === '60')) {
                      onDurationChange('30');
                    }
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/80 shadow-xs ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl">{emoji}</span>
                    {isSelected ? (
                      <CheckCircle2 size={16} className="text-blue-600" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                    )}
                  </div>
                  <div>
                    <div className={`text-xs font-bold leading-tight ${isSelected ? 'text-blue-950 font-black' : 'text-slate-900'}`}>
                      {cat.label}
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {cat.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Optional Category Tag & Prefix */}
          {courseId && (
            <div className="mt-4 p-3.5 bg-slate-50/90 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Tag size={14} className="text-purple-600" />
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Course Assessment Prefix Tag (Optional)
                  </label>
                </div>
                <button
                  type="button"
                  onClick={onOpenCategoryModal}
                  className="text-xs font-semibold text-purple-600 hover:text-purple-800 underline"
                >
                  + Manage Course Categories
                </button>
              </div>

              {courseCategories.length > 0 ? (
                <div className="flex items-center gap-2">
                  <select
                    value={categoryPrefix}
                    onChange={(e) => onCategoryPrefixChange(e.target.value)}
                    className="flex-1 text-xs border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 text-slate-800"
                  >
                    <option value="">No Course Prefix (General Pool)</option>
                    {courseCategories.map((c) => (
                      <option key={c.id} value={c.prefix}>
                        [{c.prefix}] {c.name}
                      </option>
                    ))}
                  </select>
                  {categoryPrefix && (
                    <span className={`px-2.5 py-1 rounded text-xs font-bold border uppercase ${
                      getCategoryColorBadgeClasses(courseCategories.find(c => c.prefix === categoryPrefix)?.color)
                    }`}>
                      [{categoryPrefix}] {courseCategories.find(c => c.prefix === categoryPrefix)?.name}
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  No custom categories yet for {selectedCourse?.code || 'this course'}. You can tag questions later.
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Card 2: Timing, Subject & Instructions */}
      <Card className="border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <Clock className="text-indigo-600" size={20} />
          <div>
            <h2 className="text-base font-bold text-slate-900">Timing & Instructions</h2>
            <p className="text-xs text-slate-500">Set the exam time limit and availability schedule.</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Duration Selector with Quick Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Duration Time Limit <span className="text-rose-500">*</span>
              </label>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                {duration || 0} minutes total
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-2 mb-3">
              {DURATION_PRESETS.map((preset) => {
                const isActive = duration === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => onDurationChange(preset.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="max-w-xs">
              <Input
                type="number"
                label="Custom Minutes"
                value={duration}
                onChange={(e) => onDurationChange(e.target.value)}
                min="1"
                placeholder="e.g. 75"
              />
            </div>
          </div>

          {/* Schedule Window */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={16} className="text-slate-600" />
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Deadline & Availability Window (Optional)
              </label>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Leave blank if the exam should be open indefinitely until archived by lecturer.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Deadline Date</label>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => onDeadlineDateChange(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Deadline Time (GMT)</label>
                <input
                  type="time"
                  value={deadlineTime}
                  onChange={(e) => onDeadlineTimeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                />
              </div>
            </div>
          </div>

          {/* Subject & Instructions */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Subject / Topic Area"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder="e.g. Data Structures & Algorithms"
            />
            <Textarea
              label="Candidate Instructions & Guidelines (Optional)"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Instructions or guidelines shown to candidates before starting..."
              rows={2}
            />
          </div>
        </div>
      </Card>

      {/* Navigation Footer */}
      <div className="flex justify-end pt-2">
        <Button
          type="button"
          variant="primary"
          onClick={onNext}
          className="flex items-center gap-2 py-2.5 px-6 font-bold shadow-sm"
        >
          <span>Continue to Questions Strategy</span>
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
};
