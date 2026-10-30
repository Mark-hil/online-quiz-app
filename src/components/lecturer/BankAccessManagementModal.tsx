import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Users,
  UserPlus,
  ShieldCheck,
  Clock,
  Ban,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Search,
  RefreshCw,
  Shield,
  History
} from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { db, QuestionBankAccessRequest } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

export interface BankAccessManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  courseCode?: string;
  courseTitle?: string;
  assignedLecturerName?: string;
  assignedLecturerEmail?: string;
  assignedLecturerId?: string;
  isAcademicOfficer?: boolean;
  onChanged?: () => void;
}

interface LecturerOption {
  id: string;
  name: string;
  email: string;
  department?: string;
}

export default function BankAccessManagementModal({
  isOpen,
  onClose,
  courseId,
  courseCode = 'Course',
  courseTitle = '',
  assignedLecturerName,
  assignedLecturerEmail,
  assignedLecturerId,
  isAcademicOfficer = false,
  onChanged
}: BankAccessManagementModalProps) {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'active' | 'grant' | 'pending' | 'history'>('active');
  const [delegations, setDelegations] = useState<QuestionBankAccessRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [lecturersList, setLecturersList] = useState<LecturerOption[]>([]);
  const [loadingLecturers, setLoadingLecturers] = useState(false);

  // Direct Grant State
  const [selectedLecturerId, setSelectedLecturerId] = useState('');
  const [lecturerSearchTerm, setLecturerSearchTerm] = useState('');
  const [grantLevel, setGrantLevel] = useState<'read_only' | 'contributor'>('contributor');
  const [grantDurationDays, setGrantDurationDays] = useState<number>(30);
  const [grantNotes, setGrantNotes] = useState('');
  const [isSubmittingGrant, setIsSubmittingGrant] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantSuccessMsg, setGrantSuccessMsg] = useState<string | null>(null);

  // Revoke State
  const [revokingReqId, setRevokingReqId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isSubmittingRevoke, setIsSubmittingRevoke] = useState(false);

  // Review Pending State
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Body scroll lock & Escape listener
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (revokingReqId) {
          setRevokingReqId(null);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, revokingReqId]);

  // Load Delegations
  const loadDelegations = async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const data = await db.getCourseBankDelegations(courseId);
      setDelegations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading course bank delegations:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Lecturers for assignment dropdown
  const loadLecturers = async () => {
    setLoadingLecturers(true);
    try {
      const data = await db.getUsersByRole('lecturer');
      if (Array.isArray(data)) {
        setLecturersList(data);
      }
    } catch (err) {
      console.error('Error fetching university lecturers:', err);
    } finally {
      setLoadingLecturers(false);
    }
  };

  useEffect(() => {
    if (isOpen && courseId) {
      loadDelegations();
      loadLecturers();
      setGrantSuccessMsg(null);
      setGrantError(null);
      setRevokingReqId(null);
    }
  }, [isOpen, courseId]);

  // Filtered categories of delegations
  const activeDelegations = useMemo(() => {
    return delegations.filter(d => {
      if (d.status !== 'approved') return false;
      if (!d.expires_at) return true;
      return new Date(d.expires_at) > new Date();
    });
  }, [delegations]);

  const pendingRequests = useMemo(() => {
    return delegations.filter(d => d.status === 'pending');
  }, [delegations]);

  const auditHistory = useMemo(() => {
    return delegations.filter(d => {
      if (d.status === 'revoked' || d.status === 'rejected') return true;
      if (d.status === 'approved' && d.expires_at && new Date(d.expires_at) <= new Date()) return true;
      return false;
    });
  }, [delegations]);

  // Filtered lecturer options (excluding current course lead)
  const availableLecturers = useMemo(() => {
    const activeRequesterIds = new Set(activeDelegations.map(d => d.requester_id));
    return lecturersList.filter(l => {
      if (assignedLecturerId && l.id === assignedLecturerId) return false;
      if (activeRequesterIds.has(l.id)) return false;
      if (!lecturerSearchTerm.trim()) return true;
      const term = lecturerSearchTerm.toLowerCase();
      return (
        l.name.toLowerCase().includes(term) ||
        l.email.toLowerCase().includes(term) ||
        (l.department || '').toLowerCase().includes(term)
      );
    });
  }, [lecturersList, assignedLecturerId, activeDelegations, lecturerSearchTerm]);

  // Handle Direct Grant
  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLecturerId || !user) {
      setGrantError('Please select a lecturer from the directory.');
      return;
    }

    setGrantError(null);
    setIsSubmittingGrant(true);

    try {
      await db.grantBankAccessDirectly({
        course_id: courseId,
        lecturer_id: selectedLecturerId,
        access_level: grantLevel,
        duration_days: grantDurationDays,
        granted_by: user.id,
        notes: grantNotes.trim() || undefined
      });

      const selectedName = lecturersList.find(l => l.id === selectedLecturerId)?.name || 'Lecturer';
      setGrantSuccessMsg(`Successfully granted ${grantLevel === 'contributor' ? 'Contributor' : 'Read-Only'} access to ${selectedName} for ${grantDurationDays} days.`);
      setSelectedLecturerId('');
      setGrantNotes('');
      await loadDelegations();
      if (onChanged) onChanged();
      setTimeout(() => setActiveTab('active'), 1200);
    } catch (err: any) {
      console.error('Error granting access directly:', err);
      setGrantError(err.message || 'Failed to grant access. Please try again.');
    } finally {
      setIsSubmittingGrant(false);
    }
  };

  // Handle Revoke
  const handleConfirmRevoke = async () => {
    if (!revokingReqId || !user) return;
    setIsSubmittingRevoke(true);

    try {
      await db.revokeBankAccess({
        request_id: revokingReqId,
        revoked_by: user.id,
        reason: revokeReason.trim() || 'Access revoked by Academic Administration'
      });

      setRevokingReqId(null);
      setRevokeReason('');
      await loadDelegations();
      if (onChanged) onChanged();
    } catch (err: any) {
      console.error('Error revoking bank access:', err);
      alert(err.message || 'Failed to revoke access.');
    } finally {
      setIsSubmittingRevoke(false);
    }
  };

  // Handle Quick Extension
  const handleExtendAccess = async (requestId: string, days: number) => {
    if (!user) return;
    try {
      await db.extendBankAccess({
        request_id: requestId,
        additional_days: days,
        reviewer_id: user.id
      });
      await loadDelegations();
      if (onChanged) onChanged();
    } catch (err: any) {
      console.error('Error extending bank access:', err);
      alert(err.message || 'Failed to extend access.');
    }
  };

  // Handle Review Pending Request
  const handleReviewPending = async (requestId: string, decision: 'approved' | 'rejected') => {
    if (!user) return;
    setIsSubmittingReview(true);
    try {
      await db.reviewBankAccessRequest(requestId, user.id, decision, reviewNote.trim() || undefined);
      setReviewNote('');
      await loadDelegations();
      if (onChanged) onChanged();
    } catch (err: any) {
      console.error('Error reviewing request:', err);
      alert(err.message || 'Failed to review request.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (!isOpen) return null;

  const modalNode = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />

      {/* Main Dialog */}
      <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col z-10 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shadow-inner">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-extrabold text-slate-900">
                  Question Bank Access & Delegations
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {courseCode} {courseTitle ? `• ${courseTitle}` : ''}
                </span>
                {isAcademicOfficer && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <Shield size={11} /> Academic Officer Authority
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage co-examiners, moderators, and tutors authorized to view or contribute questions.
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Course Custodian Info Banner */}
        <div className="px-6 py-2.5 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between text-xs text-blue-900 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-blue-700">Course Custodian / Lead:</span>
            {assignedLecturerName ? (
              <span className="font-bold flex items-center gap-1.5 text-slate-900">
                {assignedLecturerName} {assignedLecturerEmail && <span className="text-slate-500 font-normal">({assignedLecturerEmail})</span>}
                <Badge variant="success" className="text-[10px]">Owner</Badge>
              </span>
            ) : (
              <span className="italic text-amber-700 font-medium">Unassigned (Under Academic Officer Direct Stewardship)</span>
            )}
          </div>
          <button
            onClick={loadDelegations}
            disabled={loading}
            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-semibold"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 flex items-center gap-2 shrink-0 bg-white">
          <button
            onClick={() => setActiveTab('active')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'active'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users size={15} />
            <span>Active Delegations</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              activeDelegations.length > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {activeDelegations.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('grant')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'grant'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus size={15} />
            <span>Assign Access</span>
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'pending'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock size={15} />
            <span>Pending Requests</span>
            {pendingRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500 text-white animate-pulse">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History size={15} />
            <span>Revocation & Audit Log</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-slate-50/40">
          {/* TAB 1: ACTIVE DELEGATIONS */}
          {activeTab === 'active' && (
            <div className="space-y-4">
              {activeDelegations.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                    <Users size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No External Delegations Active</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Currently, only the designated course lead and institutional academic officers hold access to this course bank.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab('grant')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center gap-1.5 mt-2"
                  >
                    <UserPlus size={14} />
                    <span>Assign Access to a Lecturer</span>
                  </Button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
                  {activeDelegations.map(del => {
                    const expiry = del.expires_at ? new Date(del.expires_at) : null;
                    const diffDays = expiry ? Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

                    return (
                      <div key={del.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{del.requester_name}</span>
                            <Badge variant={del.access_level === 'contributor' ? 'success' : 'warning'}>
                              {del.access_level === 'contributor' ? 'Contributor' : 'Read-Only'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span>{del.requester_email}</span>
                            {del.requester_department && <span>• {del.requester_department}</span>}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                            <Calendar size={12} className="text-slate-400" />
                            {expiry ? (
                              <span>
                                Expires in <strong className={diffDays && diffDays <= 3 ? 'text-rose-600' : 'text-slate-700'}>{diffDays} days</strong> ({expiry.toLocaleDateString()})
                              </span>
                            ) : (
                              <span className="text-slate-700 font-semibold">Permanent Access</span>
                            )}
                            {del.granted_by_name && (
                              <span>• Granted by {del.granted_by_name}</span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={() => handleExtendAccess(del.id, 7)}
                            title="Extend delegation by 7 days"
                            className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                          >
                            +7d
                          </button>
                          <button
                            onClick={() => handleExtendAccess(del.id, 30)}
                            title="Extend delegation by 30 days"
                            className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                          >
                            +30d
                          </button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRevokingReqId(del.id);
                              setRevokeReason('');
                            }}
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 text-xs flex items-center gap-1"
                          >
                            <Ban size={13} />
                            <span>Revoke</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ASSIGN / GRANT ACCESS DIRECTLY */}
          {activeTab === 'grant' && (
            <form onSubmit={handleGrantAccess} className="space-y-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs max-w-2xl mx-auto">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <UserPlus size={16} className="text-indigo-600" />
                  Grant Direct Access to Lecturer
                </h4>
                <p className="text-xs text-slate-500">
                  Select any university lecturer to grant immediate authorization to this course bank without requiring approval.
                </p>
              </div>

              {grantSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{grantSuccessMsg}</span>
                </div>
              )}

              {grantError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{grantError}</span>
                </div>
              )}

              {/* Lecturer Picker */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Select Lecturer <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, email, department..."
                    value={lecturerSearchTerm}
                    onChange={(e) => setLecturerSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl mb-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <select
                  value={selectedLecturerId}
                  onChange={(e) => setSelectedLecturerId(e.target.value)}
                  required
                  disabled={loadingLecturers}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <option value="">
                    {loadingLecturers ? '-- Loading faculty members... --' : `-- Choose a Lecturer (${availableLecturers.length} available) --`}
                  </option>
                  {availableLecturers.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.email}) {l.department ? `[${l.department}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Permission Tier */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Permission Tier <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    onClick={() => setGrantLevel('contributor')}
                    className={`cursor-pointer border-2 rounded-xl p-3 flex items-start gap-2.5 transition-all ${
                      grantLevel === 'contributor'
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="grantLevel"
                      checked={grantLevel === 'contributor'}
                      onChange={() => setGrantLevel('contributor')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-1">
                        Contributor
                        <Badge variant="success" className="text-[9px]">Full Authoring</Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Can author questions, edit existing items, and bulk-upload questions via Word, Excel, and Aiken.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setGrantLevel('read_only')}
                    className={`cursor-pointer border-2 rounded-xl p-3 flex items-start gap-2.5 transition-all ${
                      grantLevel === 'read_only'
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="grantLevel"
                      checked={grantLevel === 'read_only'}
                      onChange={() => setGrantLevel('read_only')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-1">
                        Read-Only / Moderator
                        <Badge variant="warning" className="text-[9px]">Review Only</Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Can inspect questions and pick them into quizzes, but cannot edit or modify bank questions.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Duration Presets */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Access Duration <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { days: 7, label: '7 Days', desc: 'Moderation Window' },
                    { days: 30, label: '30 Days', desc: 'Exam Cycle' },
                    { days: 90, label: '90 Days', desc: 'Full Semester' },
                    { days: 365, label: '365 Days', desc: 'Academic Year' },
                  ].map(preset => (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => setGrantDurationDays(preset.days)}
                      className={`p-2 rounded-xl border text-center transition-all ${
                        grantDurationDays === preset.days
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-bold shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs">{preset.label}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{preset.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Justification Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Institutional Notes / Justification (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Co-examiner for Second Semester 2026 examination cycle"
                  value={grantNotes}
                  onChange={(e) => setGrantNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={isSubmittingGrant || !selectedLecturerId}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                >
                  {isSubmittingGrant ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  <span>{isSubmittingGrant ? 'Granting...' : 'Grant Access Now'}</span>
                </Button>
              </div>
            </form>
          )}

          {/* TAB 3: PENDING REQUESTS */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {pendingRequests.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                    <CheckCircle2 size={24} className="text-emerald-500" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Inbox Clean</h4>
                  <p className="text-xs text-slate-500">
                    There are no pending question bank access requests awaiting academic review.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map(req => (
                    <div key={req.id} className="bg-white rounded-2xl border border-amber-200 p-4 space-y-3 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{req.requester_name}</span>
                            <Badge variant="warning">{req.duration_days} Days ({req.access_level})</Badge>
                          </div>
                          <p className="text-xs text-slate-500">{req.requester_email}</p>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Requested on {new Date(req.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-700 space-y-1">
                        <span className="font-semibold text-slate-500 block text-[11px]">Academic Justification:</span>
                        <p className="italic">"{req.reason}"</p>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100">
                        <input
                          type="text"
                          placeholder="Reviewer note (optional)..."
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isSubmittingReview}
                            onClick={() => handleReviewPending(req.id, 'rejected')}
                            className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            disabled={isSubmittingReview}
                            onClick={() => handleReviewPending(req.id, 'approved')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                          >
                            Approve ({req.duration_days}d)
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: REVOCATION & AUDIT HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {auditHistory.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                    <History size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No Historical Revocations</h4>
                  <p className="text-xs text-slate-500">
                    Past expired and revoked delegations will be permanently audited here.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
                  {auditHistory.map(item => (
                    <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{item.requester_name}</span>
                          <span className="text-slate-500">({item.requester_email})</span>
                          <Badge variant={item.status === 'revoked' ? 'danger' : 'secondary'}>
                            {item.status.toUpperCase()}
                          </Badge>
                        </div>
                        {item.revocation_reason && (
                          <p className="text-[11px] text-red-700 italic">
                            Reason: {item.revocation_reason}
                          </p>
                        )}
                        {item.revoked_by_name && (
                          <p className="text-[10px] text-slate-400">
                            Revoked by {item.revoked_by_name} on {item.revoked_at ? new Date(item.revoked_at).toLocaleDateString() : ''}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {item.expires_at ? `Expired: ${new Date(item.expires_at).toLocaleDateString()}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Inline Revocation Confirmation Modal */}
        {revokingReqId && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-20 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border border-red-200 max-w-md w-full p-5 space-y-4">
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                  <Ban size={22} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">Revoke Question Bank Access?</h4>
                  <p className="text-xs text-slate-500">
                    This lecturer will instantly lose access to this course's questions.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Revocation (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. End of moderation period / Course transfer"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRevokingReqId(null)}
                  disabled={isSubmittingRevoke}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={isSubmittingRevoke}
                  onClick={handleConfirmRevoke}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                >
                  {isSubmittingRevoke ? 'Revoking...' : 'Confirm Revocation'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Academic Security Governance Engine • All grants and revocations are logged</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalNode, document.body)
    : null;
}
