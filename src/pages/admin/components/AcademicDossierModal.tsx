import { useState, useEffect, useMemo } from 'react';
import {
  Download,
  Printer,
  CheckCircle2,
  Search,
  ShieldAlert,
} from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { db, ExamResultsTransmission } from '../../../lib/database';
import { useAuth } from '../../../contexts/AuthContext';
import {
  exportAcademicBroadsheetCSV,
  printAcademicDossierReport,
  getLetterGrade,
  AcademicCandidateRow,
  AcademicCourseMetadata,
} from '../../../utils/academicExportUtils';

interface AcademicDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  transmission: ExamResultsTransmission | null;
  onStatusUpdated: () => void;
}

export default function AcademicDossierModal({
  isOpen,
  onClose,
  transmission,
  onStatusUpdated,
}: AcademicDossierModalProps) {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<AcademicCandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [standingFilter, setStandingFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const [actionStatus, setActionStatus] = useState<
    'verified' | 'revision_requested' | 'under_review'
  >('verified');
  const [officerNotes, setOfficerNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (transmission?.quiz_id) {
      loadCandidates(transmission.quiz_id);
      setOfficerNotes(transmission.review_notes || '');
      setActionStatus(
        transmission.status === 'revision_requested'
          ? 'revision_requested'
          : transmission.status === 'under_review'
          ? 'under_review'
          : 'verified'
      );
    }
  }, [transmission]);

  const loadCandidates = async (quizId: string) => {
    setLoading(true);
    try {
      const rows = await db.getDetailedQuizCandidatesForBroadsheet(quizId);
      setCandidates(rows as AcademicCandidateRow[]);
    } catch (error) {
      console.error('Error loading candidates for broadsheet:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtered candidate list
  const filteredCandidates = useMemo(() => {
    let result = candidates;
    if (standingFilter === 'pass') {
      result = result.filter((c) => (c.score || 0) >= 50);
    } else if (standingFilter === 'fail') {
      result = result.filter((c) => (c.score || 0) < 50);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.student_name.toLowerCase().includes(q) ||
          c.student_email.toLowerCase().includes(q) ||
          (c.index_number || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [candidates, standingFilter, searchQuery]);

  const metadata: AcademicCourseMetadata = useMemo(() => {
    return {
      title: transmission?.quiz_title || 'Examination',
      subject: transmission?.quiz_subject || 'General',
      academic_year: transmission?.academic_year || '2025/2026',
      semester: transmission?.semester || 'Semester 1',
      lecturer_name: transmission?.lecturer_name || 'Assigned Lecturer',
      lecturer_email: transmission?.lecturer_email || '',
      reviewer_name: transmission?.reviewer_name || user?.name || 'Academic Affairs Officer',
      status: transmission?.status,
      submitted_at: transmission?.submitted_at,
      reviewed_at: transmission?.reviewed_at,
      submission_notes: transmission?.submission_notes,
      review_notes: officerNotes || transmission?.review_notes,
    };
  }, [transmission, user, officerNotes]);

  const handleExportCSV = () => {
    exportAcademicBroadsheetCSV(metadata, candidates);
  };

  const handlePrintDossier = () => {
    printAcademicDossierReport(metadata, candidates);
  };

  const handleUpdateStatus = async () => {
    if (!transmission || !user) return;
    setIsUpdating(true);
    setStatusMessage(null);

    try {
      await db.updateExamTransmissionStatus(
        transmission.id,
        actionStatus,
        user.id,
        officerNotes.trim() || undefined
      );

      await db.createAuditLog(
        user.id,
        actionStatus === 'verified'
          ? 'EXAM_RESULTS_VERIFIED'
          : actionStatus === 'revision_requested'
          ? 'EXAM_RESULTS_REVISION_REQUESTED'
          : 'EXAM_RESULTS_REVIEWED',
        'exam_results_transmission',
        transmission.id,
        {
          quiz_id: transmission.quiz_id,
          quiz_title: transmission.quiz_title,
          status: actionStatus,
          review_notes: officerNotes.trim() || undefined,
        }
      );

      setStatusMessage(
        actionStatus === 'verified'
          ? 'Exam results verified and officially locked for institutional transcripts.'
          : actionStatus === 'revision_requested'
          ? 'Revision request dispatched to lecturer.'
          : 'Package status marked under review.'
      );

      onStatusUpdated();
    } catch (err: any) {
      console.error('Error updating transmission status:', err);
      alert('Failed to update status. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!transmission) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Academic Results Dossier & Broadsheet"
      size="xl"
    >
      <div className="space-y-6">
        {statusMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{statusMessage}</span>
          </div>
        )}

        {/* Dossier Banner Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-5 rounded-2xl text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 border border-blue-400/30">
                {transmission.quiz_subject || 'General'}
              </span>
              <span className="text-xs text-blue-200">
                Term: <b>{transmission.academic_year}</b> • <b>{transmission.semester}</b>
              </span>
            </div>
            <h3 className="text-2xl font-bold text-white">{transmission.quiz_title}</h3>
            <p className="text-xs text-blue-200/80">
              Internal Examiner: <span className="font-semibold text-white">{transmission.lecturer_name}</span> ({transmission.lecturer_email || 'Faculty'})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <Button
              size="sm"
              onClick={handleExportCSV}
              className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1.5"
            >
              <Download size={14} />
              Export Broadsheet (CSV)
            </Button>
            <Button
              size="sm"
              onClick={handlePrintDossier}
              className="bg-blue-600 hover:bg-blue-500 text-white shadow-sm flex items-center gap-1.5"
            >
              <Printer size={14} />
              Print Official Report
            </Button>
          </div>
        </div>

        {/* Statistical Performance Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500">Candidates Sat</span>
            <p className="text-2xl font-extrabold text-slate-900">{transmission.total_candidates}</p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500">Pass Rate</span>
            <p className="text-2xl font-extrabold text-emerald-700">
              {Math.round((transmission.passed_candidates / (transmission.total_candidates || 1)) * 100)}%
            </p>
            <span className="text-[10px] text-slate-500">{transmission.passed_candidates} Passed</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500">Fail Rate</span>
            <p className="text-2xl font-extrabold text-rose-700">
              {Math.round((transmission.failed_candidates / (transmission.total_candidates || 1)) * 100)}%
            </p>
            <span className="text-[10px] text-slate-500">{transmission.failed_candidates} Failed</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500">Mean Score</span>
            <p className="text-2xl font-extrabold text-blue-700">{transmission.average_score}%</p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500">Score Range</span>
            <p className="text-xl font-extrabold text-slate-800">
              {transmission.lowest_score}% - {transmission.highest_score}%
            </p>
          </div>
        </div>

        {/* Lecturer Transmission Notes */}
        {transmission.submission_notes && (
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-950">
            <span className="font-bold block mb-1">Internal Examiner Remarks:</span>
            <p className="italic">{transmission.submission_notes}</p>
          </div>
        )}

        {/* Candidate Roster Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setStandingFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                standingFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All ({candidates.length})
            </button>
            <button
              onClick={() => setStandingFilter('pass')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                standingFilter === 'pass'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Passed ({candidates.filter((c) => (c.score || 0) >= 50).length})
            </button>
            <button
              onClick={() => setStandingFilter('fail')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                standingFilter === 'fail'
                  ? 'bg-rose-700 text-white'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              Failed ({candidates.filter((c) => (c.score || 0) < 50).length})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search student or index..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 py-1.5 text-xs"
            />
          </div>
        </div>

        {/* Candidate Grade Broadsheet Table */}
        <div className="border border-gray-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider sticky top-0">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Index Number</th>
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-3">Score</th>
                <th className="py-2.5 px-3">Grade</th>
                <th className="py-2.5 px-3">Standing</th>
                <th className="py-2.5 px-3">Proctoring Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    Loading student grade records...
                  </td>
                </tr>
              ) : filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No matching candidate records found.
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((c, idx) => {
                  const raw = typeof c.score === 'number' ? Math.round(c.score * 10) / 10 : 0;
                  const { grade, pass } = getLetterGrade(c.score);

                  return (
                    <tr key={idx} className="hover:bg-blue-50/20">
                      <td className="py-2.5 px-3 font-mono text-gray-400">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-gray-800">
                        {c.index_number || 'N/A'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-gray-900">{c.student_name}</div>
                        <div className="text-[10px] text-gray-400">{c.student_email}</div>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-gray-900">{raw}%</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-extrabold ${
                            grade === 'A'
                              ? 'bg-emerald-100 text-emerald-800'
                              : grade === 'B'
                              ? 'bg-blue-100 text-blue-800'
                              : grade === 'C'
                              ? 'bg-purple-100 text-purple-800'
                              : grade === 'D'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {grade}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-bold text-xs ${
                            pass ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {pass ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {c.cheated ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                            <ShieldAlert size={12} />
                            Violation
                          </span>
                        ) : (c.tab_switch_count || 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            {c.tab_switch_count} tab switches
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-medium">Cleared</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Academic Office Sign-Off & Verification Box */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">Academic Office Review & Sign-Off</h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold">Decision:</span>
              <select
                value={actionStatus}
                onChange={(e) => setActionStatus(e.target.value as any)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 bg-white"
              >
                <option value="verified">✓ Verify & Accept Results</option>
                <option value="under_review">⏳ Mark Under Review</option>
                <option value="revision_requested">⚠️ Request Lecturer Revision</option>
              </select>
            </div>
          </div>

          <div>
            <textarea
              rows={2}
              value={officerNotes}
              onChange={(e) => setOfficerNotes(e.target.value)}
              placeholder="Add official verification notes or specific feedback for lecturer..."
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500">
              Acting Officer: <b>{user?.name}</b> ({user?.email})
            </span>
            <Button
              size="sm"
              onClick={handleUpdateStatus}
              disabled={isUpdating}
              className={`text-white shadow-sm font-bold text-xs ${
                actionStatus === 'verified'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : actionStatus === 'revision_requested'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isUpdating ? 'Saving...' : 'Apply Academic Sign-Off'}
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose}>
            Close Dossier
          </Button>
        </div>
      </div>
    </Modal>
  );
}
