import React from 'react';
import { BookOpen, Lock, Clock, CheckCircle2, Unlock, RefreshCw } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import { Course, QuestionBankAccessRequest } from '../../../../lib/database';

interface RestrictedBankViewProps {
  course: Course;
  isUnassigned: boolean;
  userPendingRequest: QuestionBankAccessRequest | null;
  isClaimingCourse: boolean;
  onClaimCourse: () => void;
  onRequestAccess: () => void;
}

export default function RestrictedBankView({
  course,
  isUnassigned,
  userPendingRequest,
  isClaimingCourse,
  onClaimCourse,
  onRequestAccess,
}: RestrictedBankViewProps) {
  if (isUnassigned || !course.assigned_lecturer_id) {
    return (
      <Card className="border-blue-200 bg-gradient-to-b from-blue-50/80 to-indigo-50/30 p-8 text-center space-y-6 rounded-2xl shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
          <BookOpen size={32} />
        </div>

        <div className="max-w-xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 mb-1">
            ⚡ Unassigned Academic Course
          </div>
          <h3 className="text-xl font-bold text-slate-900">{course.code}: {course.title}</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            This course bank currently has <strong className="text-slate-900">no lead lecturer assigned</strong> for this semester. 
            If you are teaching or coordinating <strong className="text-slate-900">{course.code}</strong>, you can claim it now to unlock full access, author questions, or import exam sets.
          </p>
        </div>

        <div className="pt-2 flex flex-col items-center justify-center gap-2">
          <Button
            onClick={onClaimCourse}
            disabled={isClaimingCourse}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl shadow-md inline-flex items-center gap-2"
          >
            <CheckCircle2 size={18} />
            <span>{isClaimingCourse ? 'Assigning...' : 'Claim & Assign Myself as Lead Lecturer'}</span>
          </Button>
          <p className="text-xs text-slate-400 mt-1">
            Assigns you as the active course owner with full question bank rights and access approval capabilities.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50/40 p-8 text-center space-y-6 rounded-2xl shadow-sm">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
        <Lock size={32} />
      </div>

      <div className="max-w-xl mx-auto space-y-2">
        <h3 className="text-xl font-bold text-slate-900">Restricted Course Question Bank</h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          You are not currently assigned as the lead lecturer for <strong className="text-slate-900">{course.code} ({course.title})</strong>. 
          To maintain academic integrity and prevent exam question leakage across semester rotations, questions are locked to active course staff.
        </p>
      </div>

      {userPendingRequest ? (
        <div className="max-w-md mx-auto p-4 bg-white rounded-xl border border-amber-200 shadow-sm text-left space-y-1.5">
          <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm mb-1">
            <Clock size={16} />
            <span>Access Request Pending Moderation</span>
          </div>
          <p className="text-xs text-slate-600">
            Submitted on {new Date(userPendingRequest.created_at).toLocaleDateString()} for{' '}
            <strong className="text-slate-800">{userPendingRequest.duration_days} days</strong> ({userPendingRequest.access_level === 'read_only' ? 'Examiner / Viewer' : 'Contributor'}).
          </p>
          <p className="text-xs text-slate-500 italic mt-2 border-t pt-2">
            "{userPendingRequest.reason}"
          </p>
          <p className="text-[11px] text-slate-400 mt-2">
            Awaiting approval by Lead Tutor ({course.assigned_lecturer_name || 'Department Head'}).
          </p>
        </div>
      ) : (
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={onRequestAccess}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl shadow-md inline-flex items-center gap-2"
          >
            <Unlock size={18} />
            <span>Request Access to Bank</span>
          </Button>

          <Button
            variant="outline"
            onClick={onClaimCourse}
            disabled={isClaimingCourse}
            className="border-slate-300 text-slate-700 hover:bg-slate-100 font-medium px-4 py-2.5 rounded-xl inline-flex items-center gap-2 text-xs"
            title="Take over this course for the new semester rotation"
          >
            <RefreshCw size={14} />
            <span>{isClaimingCourse ? 'Updating...' : 'Semester Handover: Take Over Course'}</span>
          </Button>
        </div>
      )}
      {!userPendingRequest && (
        <p className="text-xs text-slate-400">
          Request access for moderation/co-teaching, or claim lead if this course has been rotated to you this semester.
        </p>
      )}
    </Card>
  );
}
