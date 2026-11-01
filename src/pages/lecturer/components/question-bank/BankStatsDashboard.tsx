import React from 'react';
import { Database, CheckCircle, Award, AlertTriangle, Flame, Activity } from 'lucide-react';
import { BankStats, StatusFilterType } from './types';

interface BankStatsDashboardProps {
  stats: BankStats;
  courseCode: string;
  statusFilter: StatusFilterType;
  difficultyFilter: string;
  onFilterClick: (filterType: 'all' | 'active' | 'easy' | 'medium' | 'hard') => void;
}

export default function BankStatsDashboard({
  stats,
  courseCode,
  statusFilter,
  difficultyFilter,
  onFilterClick,
}: BankStatsDashboardProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Bank Diagnostics & Difficulty Spectrum
        </span>
        <span className="text-xs text-slate-400 font-medium hidden sm:inline">
          💡 Click any card below to instantly filter questions
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total in Bank */}
        <button
          type="button"
          onClick={() => onFilterClick('all')}
          className={`text-left p-4 rounded-2xl border transition-all cursor-pointer group hover:-translate-y-0.5 ${
            statusFilter === 'all' && difficultyFilter === 'all'
              ? 'bg-slate-900 border-slate-900 text-white shadow-md'
              : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className={`text-[11px] font-bold uppercase tracking-wider ${
              statusFilter === 'all' && difficultyFilter === 'all' ? 'text-slate-300' : 'text-slate-500'
            }`}>
              Total Items
            </p>
            <Database size={15} className={statusFilter === 'all' && difficultyFilter === 'all' ? 'text-blue-400' : 'text-slate-400'} />
          </div>
          <p className="text-2xl font-black mt-1.5 tracking-tight">{stats.total}</p>
          <p className={`text-[11px] mt-0.5 font-medium truncate ${
            statusFilter === 'all' && difficultyFilter === 'all' ? 'text-slate-400' : 'text-slate-400'
          }`}>
            All in {courseCode}
          </p>
        </button>

        {/* Active Pool */}
        <button
          type="button"
          onClick={() => onFilterClick('active')}
          className={`text-left p-4 rounded-2xl border transition-all cursor-pointer group hover:-translate-y-0.5 ${
            statusFilter === 'active' && difficultyFilter === 'all'
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'bg-white border-slate-100 hover:border-emerald-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className={`text-[11px] font-bold uppercase tracking-wider ${
              statusFilter === 'active' && difficultyFilter === 'all' ? 'text-emerald-100' : 'text-emerald-600'
            }`}>
              Active Pool
            </p>
            <CheckCircle size={15} className={statusFilter === 'active' && difficultyFilter === 'all' ? 'text-white' : 'text-emerald-500'} />
          </div>
          <p className={`text-2xl font-black mt-1.5 tracking-tight ${
            statusFilter === 'active' && difficultyFilter === 'all' ? 'text-white' : 'text-emerald-600'
          }`}>
            {stats.active}
          </p>
          <p className={`text-[11px] mt-0.5 font-medium truncate ${
            statusFilter === 'active' && difficultyFilter === 'all' ? 'text-emerald-100' : 'text-slate-400'
          }`}>
            Live exam pool
          </p>
        </button>

        {/* Easy (≥80%) */}
        <button
          type="button"
          onClick={() => onFilterClick('easy')}
          className={`text-left p-4 rounded-2xl border transition-all cursor-pointer group hover:-translate-y-0.5 ${
            difficultyFilter === 'easy'
              ? 'bg-teal-600 border-teal-600 text-white shadow-md shadow-teal-600/20'
              : 'bg-white border-slate-100 hover:border-teal-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className={`text-[11px] font-bold uppercase tracking-wider ${
              difficultyFilter === 'easy' ? 'text-teal-100' : 'text-teal-600'
            }`}>
              Easy (≥80%)
            </p>
            <Award size={15} className={difficultyFilter === 'easy' ? 'text-white' : 'text-teal-500'} />
          </div>
          <p className={`text-2xl font-black mt-1.5 tracking-tight ${
            difficultyFilter === 'easy' ? 'text-white' : 'text-teal-600'
          }`}>
            {stats.easy}
          </p>
          <p className={`text-[11px] mt-0.5 font-medium truncate ${
            difficultyFilter === 'easy' ? 'text-teal-100' : 'text-slate-400'
          }`}>
            High pass rate
          </p>
        </button>

        {/* Medium (40-79%) */}
        <button
          type="button"
          onClick={() => onFilterClick('medium')}
          className={`text-left p-4 rounded-2xl border transition-all cursor-pointer group hover:-translate-y-0.5 ${
            difficultyFilter === 'medium'
              ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'bg-white border-slate-100 hover:border-amber-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className={`text-[11px] font-bold uppercase tracking-wider ${
              difficultyFilter === 'medium' ? 'text-amber-100' : 'text-amber-600'
            }`}>
              Medium (40-79%)
            </p>
            <AlertTriangle size={15} className={difficultyFilter === 'medium' ? 'text-white' : 'text-amber-500'} />
          </div>
          <p className={`text-2xl font-black mt-1.5 tracking-tight ${
            difficultyFilter === 'medium' ? 'text-white' : 'text-amber-600'
          }`}>
            {stats.medium}
          </p>
          <p className={`text-[11px] mt-0.5 font-medium truncate ${
            difficultyFilter === 'medium' ? 'text-amber-100' : 'text-slate-400'
          }`}>
            Standard difficulty
          </p>
        </button>

        {/* Hard (<40%) */}
        <button
          type="button"
          onClick={() => onFilterClick('hard')}
          className={`text-left p-4 rounded-2xl border transition-all cursor-pointer group hover:-translate-y-0.5 ${
            difficultyFilter === 'hard'
              ? 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-600/20'
              : 'bg-white border-slate-100 hover:border-rose-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className={`text-[11px] font-bold uppercase tracking-wider ${
              difficultyFilter === 'hard' ? 'text-rose-100' : 'text-rose-600'
            }`}>
              Hard (&lt;40%)
            </p>
            <Flame size={15} className={difficultyFilter === 'hard' ? 'text-white' : 'text-rose-500'} />
          </div>
          <p className={`text-2xl font-black mt-1.5 tracking-tight ${
            difficultyFilter === 'hard' ? 'text-white' : 'text-rose-600'
          }`}>
            {stats.hard}
          </p>
          <p className={`text-[11px] mt-0.5 font-medium truncate ${
            difficultyFilter === 'hard' ? 'text-rose-100' : 'text-slate-400'
          }`}>
            Discriminant items
          </p>
        </button>

        {/* Auto-Calibrated */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-left">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              Calibrated
            </p>
            <Activity size={15} className="text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-600 mt-1.5 tracking-tight">
            {stats.calibratedCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium truncate">
            ≥5 test sittings
          </p>
        </div>
      </div>
    </div>
  );
}
