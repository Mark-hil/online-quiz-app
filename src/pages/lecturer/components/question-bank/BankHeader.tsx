import React from 'react';
import { BookOpen, Plus, ShieldCheck, Clock, CheckCircle2, Lock, Sparkles } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import Badge from '../../../../components/ui/Badge';
import { Course } from '../../../../lib/database';

interface BankHeaderProps {
  courses: Course[];
  selectedCourseId: string;
  selectedCourse?: Course;
  loadingCourses: boolean;
  hasCourseAccess: boolean;
  isCourseLead: boolean;
  pendingRequestsCount: number;
  onSelectCourse: (courseId: string) => void;
  onOpenAddCourse: () => void;
  onOpenAccessManagement: () => void;
}

export default function BankHeader({
  courses,
  selectedCourseId,
  selectedCourse,
  loadingCourses,
  hasCourseAccess,
  isCourseLead,
  pendingRequestsCount,
  onSelectCourse,
  onOpenAddCourse,
  onOpenAccessManagement,
}: BankHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Top Banner: Title & Course Switcher */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Institutional Question Bank
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                <Sparkles size={11} />
                CBT Assessment Vault
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Course-bound question repository with pass-rate calibration & anti-leak safeguards
            </p>
          </div>
        </div>

        {/* Course Selection Dropdown & Add Course */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-[280px] sm:min-w-[320px]">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Active Course Bank:
            </label>
            <div className="relative">
              <select
                value={selectedCourseId}
                onChange={(e) => onSelectCourse(e.target.value)}
                disabled={loadingCourses || courses.length === 0}
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-50 cursor-pointer"
              >
                {courses.length === 0 ? (
                  <option value="">No courses created yet</option>
                ) : (
                  courses.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title} {c.hasAccess ? '✓ (Access Granted)' : c.isUnassigned ? '⚡ (Unassigned — Claim)' : '🔒 (Restricted)'}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="pt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenAddCourse}
              className="flex items-center gap-1.5 h-[42px] px-3.5 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-600 rounded-xl font-medium transition-all"
            >
              <Plus size={16} />
              <span>New Course</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Selected Course Context Banner */}
      {selectedCourse && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black tracking-wider uppercase transition-colors ${
                hasCourseAccess
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-sm'
                  : 'bg-amber-50 text-amber-700 border border-amber-200/80 shadow-sm'
              }`}
            >
              {selectedCourse.code.slice(0, 4)}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900">
                  {selectedCourse.code}: {selectedCourse.title}
                </h2>
                {hasCourseAccess ? (
                  <Badge variant="success" className="flex items-center gap-1 font-semibold text-xs py-0.5">
                    <CheckCircle2 size={13} />
                    {isCourseLead ? 'Lead Tutor / Owner' : 'Delegated Access'}
                  </Badge>
                ) : (
                  <Badge variant="warning" className="flex items-center gap-1 font-semibold text-xs py-0.5">
                    <Lock size={13} /> Restricted Access
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Department: <span className="font-semibold text-slate-700">{selectedCourse.department || 'General Academic'}</span> • 
                Assigned Lead: <span className="font-semibold text-slate-700">{selectedCourse.assigned_lecturer_name || 'Unassigned'}</span>
                {(selectedCourse as any).delegationExpiresAt && (
                  <span className="text-blue-600 font-semibold ml-2">
                    (Access expires: {new Date((selectedCourse as any).delegationExpiresAt).toLocaleDateString()})
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Pending Delegation Requests Badge for Lead Tutor */}
          {isCourseLead && pendingRequestsCount > 0 && (
            <div className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 p-3 rounded-xl shadow-xs">
              <div className="flex items-center gap-2 text-amber-900 text-xs font-semibold">
                <Clock size={16} className="text-amber-600 animate-pulse" />
                <span>{pendingRequestsCount} Pending Access Request(s)</span>
              </div>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg shadow-sm"
                onClick={onOpenAccessManagement}
              >
                <ShieldCheck size={14} />
                <span>Review Requests</span>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
