import React from 'react';
import { 
  Search, Plus, Upload, Download, Tag, Archive, 
  ShieldCheck, RefreshCw, X, Filter
} from 'lucide-react';
import Button from '../../../../components/ui/Button';
import { AssessmentCategoryItem } from '../../../../lib/database';
import { ASSESSMENT_CATEGORIES } from '../../../../utils/categoryUtils';
import { StatusFilterType, TierFilterType } from './types';

interface BankFiltersToolbarProps {
  searchTerm: string;
  statusFilter: StatusFilterType;
  difficultyFilter: string;
  topicFilter: string;
  categoryFilter: string;
  tierFilter: TierFilterType;
  courseCategories: AssessmentCategoryItem[];
  topics: string[];
  totalQuestionsCount: number;
  filteredCount: number;
  isCourseLead: boolean;
  loadingQuestions: boolean;
  onSearchChange: (val: string) => void;
  onStatusChange: (val: StatusFilterType) => void;
  onDifficultyChange: (val: string) => void;
  onTopicChange: (val: string) => void;
  onCategoryChange: (val: string) => void;
  onTierChange: (val: TierFilterType) => void;
  onResetFilters: () => void;
  onOpenAddQuestion: () => void;
  onOpenImport: () => void;
  onExportCSV: () => void;
  onOpenCategories: () => void;
  onRetirePreviousTerm: () => void;
  onOpenAccessManagement: () => void;
  onRefresh: () => void;
}

export default function BankFiltersToolbar({
  searchTerm,
  statusFilter,
  difficultyFilter,
  topicFilter,
  categoryFilter,
  tierFilter,
  courseCategories,
  topics,
  totalQuestionsCount,
  filteredCount,
  isCourseLead,
  loadingQuestions,
  onSearchChange,
  onStatusChange,
  onDifficultyChange,
  onTopicChange,
  onCategoryChange,
  onTierChange,
  onResetFilters,
  onOpenAddQuestion,
  onOpenImport,
  onExportCSV,
  onOpenCategories,
  onRetirePreviousTerm,
  onOpenAccessManagement,
  onRefresh,
}: BankFiltersToolbarProps) {
  const hasActiveFilters = 
    searchTerm.trim() !== '' || 
    statusFilter !== 'all' || 
    difficultyFilter !== 'all' || 
    topicFilter !== 'all' || 
    categoryFilter !== 'all' || 
    tierFilter !== 'all';

  return (
    <div className="space-y-3">
      {/* Primary Action Buttons Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <Button
            onClick={onOpenAddQuestion}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 rounded-xl font-medium shadow-sm transition-all text-sm py-2 px-4"
          >
            <Plus size={16} />
            <span>Add Question</span>
          </Button>

          <Button
            variant="outline"
            onClick={onOpenImport}
            className="flex items-center gap-1.5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-sm py-2 px-3.5"
            title="Import from Word (.docx), Excel (.xlsx), Aiken (.txt), CSV or Smart Paste"
          >
            <Upload size={16} className="text-blue-600" />
            <span>Import Questions</span>
          </Button>

          <Button
            variant="outline"
            onClick={onExportCSV}
            className="flex items-center gap-1.5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-sm py-2 px-3.5"
          >
            <Download size={16} className="text-slate-500" />
            <span>Export CSV</span>
          </Button>

          <Button
            variant="outline"
            onClick={onOpenCategories}
            className="flex items-center gap-1.5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-sm py-2 px-3.5"
            title="Manage assessment categories and prefixes for this course"
          >
            <Tag size={16} className="text-indigo-600" />
            <span>Categories ({courseCategories.length})</span>
          </Button>

          {isCourseLead && (
            <>
              <Button
                variant="outline"
                onClick={onRetirePreviousTerm}
                className="text-amber-700 border-amber-200 hover:bg-amber-50 flex items-center gap-1.5 rounded-xl text-sm py-2 px-3.5"
                title="Archive questions used in previous terms so students cannot leak them"
              >
                <Archive size={15} />
                <span>Retire Previous Pool</span>
              </Button>

              <Button
                variant="outline"
                onClick={onOpenAccessManagement}
                className="text-indigo-700 border-indigo-200 hover:bg-indigo-50 flex items-center gap-1.5 rounded-xl text-sm py-2 px-3.5"
                title="Manage faculty access delegations and review pending requests"
              >
                <ShieldCheck size={16} className="text-indigo-600" />
                <span>Delegations</span>
              </Button>
            </>
          )}
        </div>

        {/* Quick Refresh */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 border-slate-200 rounded-xl px-3 py-1.5"
        >
          <RefreshCw size={14} className={loadingQuestions ? 'animate-spin text-blue-600' : ''} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Filter Row */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Omni Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search question, topic..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 font-medium"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium cursor-pointer"
            >
              <option value="all">All Categories ({totalQuestionsCount})</option>
              {courseCategories.map((c) => (
                <option key={c.id} value={c.prefix}>
                  [{c.prefix}] {c.name}
                </option>
              ))}
              <option value="uncategorized">General / Uncategorized</option>
            </select>
          </div>

          {/* Tier Filter */}
          <div>
            <select
              value={tierFilter}
              onChange={(e) => onTierChange(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium cursor-pointer"
            >
              <option value="all">All Assessment Tiers</option>
              {ASSESSMENT_CATEGORIES.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.shortLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium cursor-pointer"
            >
              <option value="active">Active Pool Only (Live)</option>
              <option value="retired">Retired / Archived (Past)</option>
              <option value="draft">Drafts</option>
              <option value="all">All Statuses</option>
            </select>
          </div>

          {/* Difficulty Filter */}
          <div>
            <select
              value={difficultyFilter}
              onChange={(e) => onDifficultyChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium cursor-pointer"
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy (Pass Rate ≥ 80%)</option>
              <option value="medium">Medium (Pass Rate 40-79%)</option>
              <option value="hard">Hard (Pass Rate &lt; 40%)</option>
            </select>
          </div>

          {/* Topic Filter */}
          <div>
            <select
              value={topicFilter}
              onChange={(e) => onTopicChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium cursor-pointer"
            >
              <option value="all">All Topics</option>
              {topics.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filter Pills Bar */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                <Filter size={11} /> Filters:
              </span>

              {searchTerm.trim() !== '' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Search: "{searchTerm}"
                  <button onClick={() => onSearchChange('')} className="hover:text-blue-900 ml-0.5">
                    <X size={12} />
                  </button>
                </span>
              )}

              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Status: {statusFilter}
                  <button onClick={() => onStatusChange('all')} className="hover:text-emerald-900 ml-0.5">
                    <X size={12} />
                  </button>
                </span>
              )}

              {difficultyFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  Difficulty: {difficultyFilter}
                  <button onClick={() => onDifficultyChange('all')} className="hover:text-amber-900 ml-0.5">
                    <X size={12} />
                  </button>
                </span>
              )}

              {categoryFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                  Category: [{categoryFilter}]
                  <button onClick={() => onCategoryChange('all')} className="hover:text-purple-900 ml-0.5">
                    <X size={12} />
                  </button>
                </span>
              )}

              {tierFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Tier: {tierFilter}
                  <button onClick={() => onTierChange('all')} className="hover:text-indigo-900 ml-0.5">
                    <X size={12} />
                  </button>
                </span>
              )}

              {topicFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  Topic: {topicFilter}
                  <button onClick={() => onTopicChange('all')} className="hover:text-slate-900 ml-0.5">
                    <X size={12} />
                  </button>
                </span>
              )}

              <span className="text-xs text-slate-400 font-medium ml-1">
                ({filteredCount} of {totalQuestionsCount} items match)
              </span>
            </div>

            <button
              onClick={onResetFilters}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold underline underline-offset-2 transition-colors cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
