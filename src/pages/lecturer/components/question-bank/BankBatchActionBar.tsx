import React from 'react';
import { Plus, Tag, Archive, CheckSquare, X } from 'lucide-react';
import Button from '../../../../components/ui/Button';

interface BankBatchActionBarProps {
  isAllPageSelected: boolean;
  selectedCount: number;
  pageItemCount: number;
  isCourseLead: boolean;
  onSelectAllPage: () => void;
  onCreateQuizFromSelected: () => void;
  onOpenBatchCategory: () => void;
  onBulkRetire: () => void;
  onClearSelection: () => void;
}

export default function BankBatchActionBar({
  isAllPageSelected,
  selectedCount,
  pageItemCount,
  isCourseLead,
  onSelectAllPage,
  onCreateQuizFromSelected,
  onOpenBatchCategory,
  onBulkRetire,
  onClearSelection,
}: BankBatchActionBarProps) {
  return (
    <div className={`rounded-2xl px-4 py-3 border transition-all ${
      selectedCount > 0 
        ? 'bg-blue-50/70 border-blue-200/80 shadow-sm' 
        : 'bg-slate-50 border-slate-200/80'
    }`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Left: Select all checkbox & Selected pill */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2.5 cursor-pointer font-bold text-slate-700 text-xs sm:text-sm select-none">
            <input
              type="checkbox"
              checked={isAllPageSelected && pageItemCount > 0}
              onChange={onSelectAllPage}
              className="rounded text-blue-600 focus:ring-blue-500/20 w-4 h-4 cursor-pointer"
            />
            <span>Select All on Page ({pageItemCount})</span>
          </label>

          {selectedCount > 0 && (
            <span className="font-bold text-blue-800 bg-blue-100/90 px-3 py-0.5 rounded-full text-xs border border-blue-200 flex items-center gap-1">
              <CheckSquare size={13} />
              {selectedCount} selected
            </span>
          )}
        </div>

        {/* Right: Batch Actions */}
        {selectedCount > 0 ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={onCreateQuizFromSelected}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-1.5 px-3 text-xs flex items-center gap-1.5 rounded-xl shadow-sm transition-all"
              title="Create a quiz containing only the selected questions"
            >
              <Plus size={14} />
              <span>Create Quiz from Selected ({selectedCount})</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={onOpenBatchCategory}
              className="text-blue-700 bg-white border-blue-300 hover:bg-blue-50 py-1.5 px-3 text-xs flex items-center gap-1.5 rounded-xl transition-all"
              title="Assign selected questions to an assessment category and prefix"
            >
              <Tag size={14} />
              <span>Set Category ({selectedCount})</span>
            </Button>

            {isCourseLead && (
              <Button
                size="sm"
                variant="outline"
                onClick={onBulkRetire}
                className="text-amber-700 bg-white border-amber-300 hover:bg-amber-50 py-1.5 px-3 text-xs flex items-center gap-1.5 rounded-xl transition-all"
                title="Archive selected questions from live exam pools"
              >
                <Archive size={14} />
                <span>Retire Selected</span>
              </Button>
            )}

            <button
              onClick={onClearSelection}
              className="text-slate-500 hover:text-slate-800 text-xs font-semibold px-2 py-1 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <X size={13} />
              <span>Clear</span>
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-500 hidden sm:block">
            💡 Check questions to create a customized exam or categorize them in batch.
          </p>
        )}
      </div>
    </div>
  );
}
