import { useState, useEffect } from 'react';
import {
  Archive,
  GraduationCap,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Layers,
  RefreshCw,
  Eye,
  Download,
  Search,
  BookOpen,
} from 'lucide-react';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import Modal from '../../../components/ui/Modal';
import { db } from '../../../lib/database';
import { useAuth } from '../../../contexts/AuthContext';
import { exportAcademicBroadsheetCSV, AcademicCandidateRow } from '../../../utils/academicExportUtils';

export default function DataLifecycleManagement() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalAttempts: 0,
    totalAnswers: 0,
    totalTransmissions: 0,
    totalQuizzes: 0,
    publishedQuizzes: 0,
    archivedQuizzes: 0,
    draftQuizzes: 0,
    totalStudents: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Archive modal state
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveIncludeDrafts, setArchiveIncludeDrafts] = useState(false);

  // Archived viewer state
  const [isArchivedViewerOpen, setIsArchivedViewerOpen] = useState(false);
  const [archivedQuizzesList, setArchivedQuizzesList] = useState<any[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [downloadingQuizId, setDownloadingQuizId] = useState<string | null>(null);

  // Purge modal state
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [purgeAttempts, setPurgeAttempts] = useState(true);
  const [purgeTransmissions, setPurgeTransmissions] = useState(true);
  const [resetQuizzesToDraft, setResetQuizzesToDraft] = useState(true);
  const [deleteStudentAccounts, setDeleteStudentAccounts] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [isPurging, setIsPurging] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await db.getSystemDataStats();
      setStats(data);
    } catch (err) {
      console.error('Error fetching data stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadArchivedQuizzes = async () => {
    setLoadingArchived(true);
    try {
      const data = await db.getArchivedQuizzes();
      setArchivedQuizzesList(data || []);
    } catch (err) {
      console.error('Error loading archived quizzes:', err);
    } finally {
      setLoadingArchived(false);
    }
  };

  const handleDownloadBroadsheet = async (quiz: any) => {
    try {
      setDownloadingQuizId(quiz.id);
      const candidates = await db.getDetailedQuizCandidatesForBroadsheet(quiz.id);
      exportAcademicBroadsheetCSV(
        {
          title: quiz.title || 'Examination',
          subject: quiz.subject || 'General',
          academic_year: 'Historical Archive',
          semester: 'Archived Term',
          lecturer_name: quiz.lecturer_name || 'Faculty Lecturer',
          lecturer_email: quiz.lecturer_email,
          status: 'Archived Record',
          submitted_at: quiz.updated_at || quiz.created_at,
        },
        candidates as any as AcademicCandidateRow[]
      );
    } catch (err: any) {
      alert(`Could not export broadsheet: ${err.message || 'Unknown error'}`);
    } finally {
      setDownloadingQuizId(null);
    }
  };

  const handleArchiveConfirm = async () => {
    setIsArchiving(true);
    try {
      const archived = await db.archiveQuizzes({
        includeDrafts: archiveIncludeDrafts || stats.publishedQuizzes === 0,
      });
      if (user?.id) {
        await db.createAuditLog(
          user.id,
          'ACADEMIC_SEMESTER_ARCHIVED',
          'system',
          'quizzes',
          {
            quizzesArchived: archived.length,
            includeDrafts: archiveIncludeDrafts || stats.publishedQuizzes === 0,
            timestamp: new Date().toISOString(),
          }
        );
      }
      setActionSuccess(
        `Successfully archived ${archived.length} exam(s). They are now stored in the permanent Historical Archive and viewable in Browse Archive.`
      );
      setIsArchiveModalOpen(false);
      await loadStats();
      await loadArchivedQuizzes();
    } catch (err: any) {
      alert(`Failed to archive exams: ${err.message || 'Unknown error'}`);
    } finally {
      setIsArchiving(false);
    }
  };

  const handlePurgeConfirm = async () => {
    if (confirmInput.trim() !== 'CONFIRM PURGE') {
      setPurgeError('Please type CONFIRM PURGE exactly as shown to proceed.');
      return;
    }

    if (!user?.id) return;

    setIsPurging(true);
    setPurgeError(null);

    try {
      const report = await db.purgeTestData({
        purgeAttempts,
        purgeTransmissions,
        resetQuizzesToDraft,
        deleteStudentAccounts,
        performedByUserId: user.id,
      });

      const summaryParts: string[] = [];
      if (report.attemptsDeleted) summaryParts.push(`${report.attemptsDeleted} attempts`);
      if (report.answersDeleted) summaryParts.push(`${report.answersDeleted} answers`);
      if (report.transmissionsDeleted) summaryParts.push(`${report.transmissionsDeleted} broadsheets`);
      if (report.quizzesResetToDraft) summaryParts.push(`${report.quizzesResetToDraft} exams reset to draft`);
      if (report.studentsDeleted) summaryParts.push(`${report.studentsDeleted} student accounts`);

      setActionSuccess(
        `Test data successfully purged: ${summaryParts.join(', ') || 'No records affected'}. System is clean and ready for production launch!`
      );

      setIsPurgeModalOpen(false);
      setConfirmInput('');
      await loadStats();
    } catch (err: any) {
      setPurgeError(err.message || 'An error occurred during cleanup.');
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="text-indigo-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">
              Academic Session Lifecycle & Data Maintenance
            </h2>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Safely close semesters, archive historical broadsheets, or prepare the platform for fresh production launch.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={loadStats} disabled={loading}>
          <RefreshCw size={14} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </Button>
      </div>

      {actionSuccess && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start justify-between gap-3 text-emerald-900 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold px-2 py-0.5 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Live Data Inventory Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Published Exams</span>
          <p className="text-2xl font-black text-indigo-700">{stats.publishedQuizzes}</p>
          <span className="text-xs text-slate-500">Active in Student Room</span>
        </div>
        <div
          onClick={() => {
            loadArchivedQuizzes();
            setIsArchivedViewerOpen(true);
          }}
          className="p-3 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 border border-slate-200 rounded-xl text-center cursor-pointer transition-all group"
          title="Click to view archived exams"
        >
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Archived Exams</span>
          <p className="text-2xl font-black text-slate-700 group-hover:text-indigo-600 transition-colors">{stats.archivedQuizzes}</p>
          <span className="text-xs text-indigo-600 font-semibold flex items-center justify-center gap-1 mt-0.5">
            <Eye size={12} /> Browse Archive
          </span>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Student Attempts</span>
          <p className="text-2xl font-black text-blue-700">{stats.totalAttempts}</p>
          <span className="text-xs text-slate-500">{stats.totalAnswers} Answers Recorded</span>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Official Broadsheets</span>
          <p className="text-2xl font-black text-emerald-700">{stats.totalTransmissions}</p>
          <span className="text-xs text-slate-500">Academic Transmissions</span>
        </div>
      </div>

      {/* Operational Options Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Safe End-of-Semester Archival */}
        <div className="p-5 border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-blue-50/30 rounded-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <GraduationCap size={20} />
                </div>
                <h3 className="font-bold text-gray-900 text-base">
                  Archive Semester (Recommended Practice)
                </h3>
              </div>
              <Badge variant="primary">Term Turnover</Badge>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Closes the active academic semester. All published exams transition to <b>Archived</b> status so candidates' active dashboards are completely clean for the next semester.
            </p>

            <div className="p-3 bg-white/80 rounded-lg border border-indigo-100 space-y-1 text-xs text-indigo-950">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                <CheckCircle2 size={14} /> Zero data loss guarantee
              </div>
              <div>• All student scores and historical transcripts remain accessible</div>
              <div>• All Academic Office broadsheets and audit logs remain intact</div>
              <div>• Lecturers keep their Question Banks and reusable exam material</div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-indigo-100 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-indigo-800 font-medium">
              {stats.publishedQuizzes > 0 ? (
                <><b>{stats.publishedQuizzes}</b> active exam(s) ready to archive</>
              ) : (
                <><b>{stats.totalQuizzes}</b> total exam(s) in system ({stats.draftQuizzes} in Draft)</>
              )}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  loadArchivedQuizzes();
                  setIsArchivedViewerOpen(true);
                }}
                className="flex items-center gap-1.5 font-medium text-xs border-indigo-200 text-indigo-800 hover:bg-indigo-50"
              >
                <Eye size={13} />
                Browse Archive ({stats.archivedQuizzes})
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (stats.publishedQuizzes === 0) {
                    setArchiveIncludeDrafts(true);
                  }
                  setIsArchiveModalOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm font-semibold"
              >
                <Archive size={14} />
                Archive Semester Exams
              </Button>
            </div>
          </div>
        </div>

        {/* Card 2: Pre-Launch Factory Wipe */}
        <div className="p-5 border border-rose-200 bg-gradient-to-br from-rose-50/40 to-amber-50/20 rounded-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
                  <Trash2 size={20} />
                </div>
                <h3 className="font-bold text-gray-900 text-base">
                  Pre-Launch Test Data Cleanup
                </h3>
              </div>
              <Badge variant="danger">Factory Clean</Badge>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Wipes demo and trial data accumulated during testing. Resets student submissions and exam states back to initial factory setup for official institutional rollout.
            </p>

            <div className="p-3 bg-white/80 rounded-lg border border-rose-100 space-y-1 text-xs text-rose-950">
              <div className="flex items-center gap-1.5 font-semibold text-rose-700">
                <ShieldAlert size={14} /> Safe Pre-Launch Reset
              </div>
              <div>• Preserves Super Admin, Admin, and Lecturer accounts</div>
              <div>• Preserves all Questions in the Question Bank</div>
              <div>• Requires typing "CONFIRM PURGE" to prevent accidents</div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-rose-100 flex items-center justify-between">
            <span className="text-xs text-rose-800 font-medium">
              For initial deployment clean-slate
            </span>
            <Button
              size="sm"
              variant="danger"
              onClick={() => setIsPurgeModalOpen(true)}
              className="flex items-center gap-1.5 shadow-sm font-semibold"
            >
              <Trash2 size={14} />
              Clean Test Data...
            </Button>
          </div>
        </div>
      </div>

      {/* Archive Modal */}
      <Modal
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        title="Confirm Semester Archival"
        size="md"
      >
        <div className="space-y-4">
          {stats.publishedQuizzes === 0 ? (
            <div className="space-y-3">
              <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-950 flex items-start gap-2.5">
                <GraduationCap size={20} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-sm text-indigo-900">
                    Archive Existing Exams ({stats.totalQuizzes} total in database)
                  </p>
                  <p className="text-indigo-800 leading-relaxed">
                    There are currently 0 exams in 'Published' status, but there are <b>{stats.draftQuizzes} exams in Draft</b> with <b>{stats.totalAttempts} student attempts</b> in the database.
                  </p>
                  <p className="text-slate-600">
                    You can archive all current exams now so they are safely stored in the permanent Historical Archive and become viewable in "Browse Archive".
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer text-xs font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={archiveIncludeDrafts}
                  onChange={(e) => setArchiveIncludeDrafts(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span>Archive all {stats.totalQuizzes} existing exams (including Drafts & Approved)</span>
              </label>
            </div>
          ) : (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3 text-blue-900 text-sm">
              <GraduationCap size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-1">Archiving {stats.publishedQuizzes} Published Exam(s)</p>
                <p className="text-xs text-blue-800 leading-relaxed">
                  This will transition all active published exams to <b>Archived</b> status. They will be removed from the active student room, creating a fresh, clean portal for the new term.
                </p>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-600">
            ✓ <b>No student data is deleted.</b> Past attempts, candidate broadsheets, and question banks will remain permanently stored and searchable in historical transcripts.
          </p>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setIsArchiveModalOpen(false)} disabled={isArchiving}>
              Cancel
            </Button>
            <Button
              onClick={handleArchiveConfirm}
              disabled={isArchiving || (stats.publishedQuizzes === 0 && !archiveIncludeDrafts && stats.totalQuizzes === 0)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              <Archive size={15} />
              {isArchiving
                ? 'Archiving...'
                : stats.publishedQuizzes > 0
                ? `Yes, Archive ${stats.publishedQuizzes} Active Exam(s)`
                : `Yes, Archive All ${stats.totalQuizzes} Existing Exam(s)`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Pre-Launch Purge Modal */}
      <Modal
        isOpen={isPurgeModalOpen}
        onClose={() => setIsPurgeModalOpen(false)}
        title="Pre-Launch Test Data Cleanup"
        size="lg"
      >
        <div className="space-y-5">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-900 text-sm">
            <AlertTriangle size={20} className="text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-0.5">Permanent Data Deletion Notice</p>
              <p className="text-xs text-rose-800 leading-relaxed">
                This operation will delete dummy test attempts and demo records to prepare your installation for genuine students. <b>This cannot be undone.</b>
              </p>
            </div>
          </div>

          {purgeError && (
            <div className="p-3 bg-red-100 text-red-800 text-xs rounded-lg font-medium">
              {purgeError}
            </div>
          )}

          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
              Select What to Purge:
            </label>

            <div className="space-y-2 text-sm bg-gray-50 p-4 rounded-xl border border-gray-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={purgeAttempts}
                  onChange={(e) => setPurgeAttempts(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded text-rose-600 focus:ring-rose-500 border-gray-300"
                />
                <div>
                  <span className="font-semibold text-gray-900">
                    Purge Test Submissions & Answers
                  </span>
                  <p className="text-xs text-gray-500">
                    Clears {stats.totalAttempts} student attempts and {stats.totalAnswers} individual answers.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-gray-200">
                <input
                  type="checkbox"
                  checked={purgeTransmissions}
                  onChange={(e) => setPurgeTransmissions(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded text-rose-600 focus:ring-rose-500 border-gray-300"
                />
                <div>
                  <span className="font-semibold text-gray-900">
                    Purge Test Academic Transmissions
                  </span>
                  <p className="text-xs text-gray-500">
                    Clears {stats.totalTransmissions} broadsheet transmission records sent during testing.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-gray-200">
                <input
                  type="checkbox"
                  checked={resetQuizzesToDraft}
                  onChange={(e) => setResetQuizzesToDraft(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded text-rose-600 focus:ring-rose-500 border-gray-300"
                />
                <div>
                  <span className="font-semibold text-gray-900">
                    Reset Quizzes back to 'Draft' Status
                  </span>
                  <p className="text-xs text-gray-500">
                    Resets all {stats.totalQuizzes} quizzes so lecturers can schedule and review them fresh.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-gray-200">
                <input
                  type="checkbox"
                  checked={deleteStudentAccounts}
                  onChange={(e) => setDeleteStudentAccounts(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded text-rose-600 focus:ring-rose-500 border-gray-300"
                />
                <div>
                  <span className="font-semibold text-gray-900 text-rose-700">
                    Delete Test Student Accounts ({stats.totalStudents} accounts)
                  </span>
                  <p className="text-xs text-gray-500">
                    Removes student test logins only. Staff (Lecturers, Moderators, Admins, Super Admins) will NOT be touched.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
            <label className="text-xs font-bold text-amber-900 block">
              Type <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300 text-rose-700 font-extrabold">CONFIRM PURGE</span> to unlock:
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="CONFIRM PURGE"
              className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm font-mono tracking-wider focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setIsPurgeModalOpen(false)} disabled={isPurging}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handlePurgeConfirm}
              disabled={isPurging || confirmInput.trim() !== 'CONFIRM PURGE'}
              className="font-bold flex items-center gap-1.5"
            >
              <Trash2 size={15} />
              {isPurging ? 'Purging Test Data...' : 'Permanently Purge Selected Test Data'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Archived Exams Explorer Modal */}
      <Modal
        isOpen={isArchivedViewerOpen}
        onClose={() => setIsArchivedViewerOpen(false)}
        title="Archived Semester Exams & Historical Terms"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search archived exams by course, title, or lecturer..."
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={loadArchivedQuizzes}
              disabled={loadingArchived}
              className="flex items-center gap-1.5 text-xs whitespace-nowrap"
            >
              <RefreshCw size={13} className={loadingArchived ? 'animate-spin' : ''} />
              Refresh Archive
            </Button>
          </div>

          {loadingArchived ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-600" />
              Loading archived exams...
            </div>
          ) : archivedQuizzesList.length === 0 ? (
            <div className="text-center py-10 px-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <Archive size={36} className="mx-auto text-slate-400" />
              <h4 className="font-bold text-slate-800 text-base">No Archived Exams Yet</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No exams have been archived yet ({stats.totalQuizzes} exams are currently in system). Click <b>"Archive Semester Exams"</b> to transition your exams into the archive.
              </p>
              {stats.totalQuizzes > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    setIsArchivedViewerOpen(false);
                    setArchiveIncludeDrafts(true);
                    setIsArchiveModalOpen(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                >
                  <Archive size={13} className="mr-1.5" />
                  Archive Current Exams Now ({stats.totalQuizzes})
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {archivedQuizzesList
                .filter((quiz) => {
                  const q = archiveSearch.toLowerCase().trim();
                  if (!q) return true;
                  return (
                    (quiz.title || '').toLowerCase().includes(q) ||
                    (quiz.subject || '').toLowerCase().includes(q) ||
                    (quiz.lecturer_name || '').toLowerCase().includes(q) ||
                    (quiz.lecturer_email || '').toLowerCase().includes(q)
                  );
                })
                .map((quiz) => (
                  <div
                    key={quiz.id}
                    className="p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-all shadow-sm space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-900 text-base">{quiz.title}</h4>
                          <Badge variant="secondary">Archived Term</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
                          <span className="flex items-center gap-1 font-medium text-slate-700">
                            <BookOpen size={13} className="text-indigo-600" />
                            {quiz.subject || 'General'}
                          </span>
                          <span>•</span>
                          <span>Lecturer: {quiz.lecturer_name || 'N/A'}</span>
                          {quiz.duration_minutes && (
                            <>
                              <span>•</span>
                              <span>{quiz.duration_minutes} mins</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDownloadBroadsheet(quiz)}
                          disabled={downloadingQuizId === quiz.id}
                          className="text-xs flex items-center gap-1.5 border-slate-300 hover:bg-slate-50 font-semibold"
                        >
                          <Download size={13} />
                          {downloadingQuizId === quiz.id ? 'Exporting...' : 'Export Broadsheet'}
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-slate-900">
                          {quiz.attempts_count || 0} candidate attempt(s)
                        </span>
                        {quiz.average_score !== null && quiz.average_score !== undefined && (
                          <span className="text-indigo-700 font-bold">
                            Avg Score: {quiz.average_score}%
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Archived: {new Date(quiz.updated_at || quiz.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <span className="text-xs text-gray-500">
              Archived exams preserve question banks, candidate answers, and broadsheet exports permanently.
            </span>
            <Button variant="secondary" size="sm" onClick={() => setIsArchivedViewerOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
