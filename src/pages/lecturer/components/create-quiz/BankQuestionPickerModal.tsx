import React, { useState, useMemo } from 'react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import Badge from '../../../../components/ui/Badge';
import { AssessmentCategoryItem } from '../../../../lib/database';
import { QuestionForm } from './types';
import { parseOptions } from '../../../../utils/quizUtils';

interface BankQuestionPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseCode: string;
  bankQuestions: any[];
  loading: boolean;
  courseCategories: AssessmentCategoryItem[];
  onImportSelected: (selectedQuestions: QuestionForm[]) => void;
}

export const BankQuestionPickerModal: React.FC<BankQuestionPickerModalProps> = ({
  isOpen,
  onClose,
  courseCode,
  bankQuestions,
  loading,
  courseCategories,
  onImportSelected,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const topics = useMemo(() => {
    return Array.from(new Set(bankQuestions.map(q => q.topic || 'General'))).sort();
  }, [bankQuestions]);

  const filteredQuestions = useMemo(() => {
    return bankQuestions.filter(q => {
      const matchSearch = !search || q.question_text.toLowerCase().includes(search.toLowerCase());
      const matchDiff = difficultyFilter === 'all' || q.difficulty === difficultyFilter;
      const matchTopic = topicFilter === 'all' || (q.topic || 'General') === topicFilter;
      const matchCat = categoryFilter === 'all' || 
        (categoryFilter === 'uncategorized' 
          ? (!q.category_prefix && (!q.category || q.category === 'General'))
          : (q.category_prefix === categoryFilter || q.category === categoryFilter));
      return matchSearch && matchDiff && matchTopic && matchCat;
    });
  }, [bankQuestions, search, difficultyFilter, topicFilter, categoryFilter]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const allSelected = filteredQuestions.length > 0 && filteredQuestions.every(q => selectedIds.has(q.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        filteredQuestions.forEach(q => next.delete(q.id));
      } else {
        filteredQuestions.forEach(q => next.add(q.id));
      }
      return next;
    });
  };

  const handleConfirmImport = () => {
    const selected = bankQuestions.filter(q => selectedIds.has(q.id));
    const converted: QuestionForm[] = selected.map(q => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type || 'mcq',
      options: parseOptions(q.options),
      correct_answer: q.correct_answer,
      marks: q.marks || 1,
      topic: q.topic || 'General',
      difficulty: q.difficulty || 'medium',
      category: q.category || 'General',
      category_prefix: q.category_prefix || undefined,
    }));

    onImportSelected(converted);
    setSelectedIds(new Set());
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Select Questions from ${courseCode || 'Course'} Question Bank`}
    >
      <div className="space-y-4 max-h-[75vh] flex flex-col">
        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            type="text"
            placeholder="Search bank questions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
          >
            <option value="all">All Categories</option>
            {courseCategories.map((c) => (
              <option key={c.id} value={c.prefix}>
                [{c.prefix}] {c.name}
              </option>
            ))}
            <option value="uncategorized">General / Uncategorized</option>
          </select>
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
          >
            <option value="all">All Difficulties</option>
            <option value="easy">Easy (Pass Rate ≥80%)</option>
            <option value="medium">Medium (40-79%)</option>
            <option value="hard">Hard (&lt;40%)</option>
          </select>
          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
          >
            <option value="all">All Topics</option>
            {topics.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* List Header */}
        <div className="flex items-center justify-between text-xs text-slate-600 border-b pb-2">
          <label className="flex items-center gap-2 cursor-pointer font-bold">
            <input
              type="checkbox"
              checked={filteredQuestions.length > 0 && filteredQuestions.every(q => selectedIds.has(q.id))}
              onChange={handleSelectAllFiltered}
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
            />
            <span>Select All Filtered ({filteredQuestions.length})</span>
          </label>
          <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
            {selectedIds.size} Selected
          </span>
        </div>

        {/* Questions Scrollable List */}
        <div className="overflow-y-auto space-y-2 flex-1 max-h-[45vh] pr-1">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Loading questions from course bank...
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              No questions found matching your filter criteria.
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const isSelected = selectedIds.has(q.id);
              return (
                <div
                  key={q.id}
                  onClick={() => handleToggleSelect(q.id)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-400 shadow-2xs ring-1 ring-blue-500/20'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // handled by parent div click
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5 cursor-pointer flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="secondary" className="uppercase text-[9px] font-bold">
                          {q.question_type}
                        </Badge>
                        <Badge variant="primary" className="text-[9px] font-bold">
                          {q.marks || 1} mark{(q.marks || 1) > 1 ? 's' : ''}
                        </Badge>
                        {q.topic && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {q.topic}
                          </span>
                        )}
                        {q.difficulty && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            q.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-700' :
                            q.difficulty === 'hard' ? 'bg-rose-50 text-rose-700' :
                            'bg-amber-50 text-amber-700'
                          }`}>
                            {q.difficulty}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-slate-900 leading-snug line-clamp-2">
                        {q.question_text}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleConfirmImport}
            disabled={selectedIds.size === 0}
            className="font-bold"
          >
            Import {selectedIds.size} Question{selectedIds.size === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
