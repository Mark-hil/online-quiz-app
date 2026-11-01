import React from 'react';
import { BookOpen, Plus, Upload, FilterX } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';

interface EmptyBankStateProps {
  type: 'no_courses' | 'no_questions' | 'no_filter_matches';
  courseCode?: string;
  hasActiveFilters?: boolean;
  onOpenAddCourse?: () => void;
  onOpenAddQuestion?: () => void;
  onOpenImport?: () => void;
  onResetFilters?: () => void;
}

export default function EmptyBankState({
  type,
  courseCode,
  hasActiveFilters,
  onOpenAddCourse,
  onOpenAddQuestion,
  onOpenImport,
  onResetFilters,
}: EmptyBankStateProps) {
  if (type === 'no_courses') {
    return (
      <Card className="p-12 text-center border-dashed border-2 border-slate-200 bg-white/60 space-y-4 rounded-2xl">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
          <BookOpen size={32} />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h3 className="text-xl font-bold text-slate-900">No Courses Registered Yet</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Your institution's question repository is currently clean. Register your course code (e.g.{' '}
            <strong className="text-slate-700">INFO210, CS101, ENG201</strong>) to start building questions and conducting multi-session exams.
          </p>
        </div>
        <div className="pt-2">
          <Button
            onClick={onOpenAddCourse}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl shadow-md inline-flex items-center gap-2"
          >
            <Plus size={18} />
            <span>Create Your First Course</span>
          </Button>
        </div>
      </Card>
    );
  }

  if (type === 'no_filter_matches' || hasActiveFilters) {
    return (
      <Card className="p-12 text-center rounded-2xl border border-slate-100 bg-white shadow-sm space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
          <FilterX size={28} />
        </div>
        <h4 className="text-base font-bold text-slate-800">No questions match your current filters</h4>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          We couldn't find any questions matching your selected topic, category, tier, or search terms.
        </p>
        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onResetFilters}
            className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-medium"
          >
            Clear all filters
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-12 text-center rounded-2xl border border-slate-100 bg-white shadow-sm space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
        <BookOpen size={32} />
      </div>
      <div className="max-w-md mx-auto space-y-1.5">
        <h4 className="text-lg font-bold text-slate-900">Question Bank is Empty for {courseCode}</h4>
        <p className="text-sm text-slate-500">
          Start authoring questions or upload your existing question bank via Word (.docx), Excel (.xlsx), Aiken, or CSV.
        </p>
      </div>
      <div className="pt-2 flex justify-center items-center gap-2 flex-wrap">
        <Button onClick={onOpenAddQuestion} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
          <Plus size={16} />
          <span>Add First Question</span>
        </Button>
        <Button onClick={onOpenImport} variant="outline" size="sm" className="rounded-xl border-slate-200">
          <Upload size={16} className="text-blue-600" />
          <span>Import Questions</span>
        </Button>
      </div>
    </Card>
  );
}
