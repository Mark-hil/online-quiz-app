import { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap,
  Download,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  ChevronRight,
  User,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import { db, ExamResultsTransmission } from '../../lib/database';
import AcademicDossierModal from './components/AcademicDossierModal';
import { exportAcademicBroadsheetCSV, AcademicCandidateRow } from '../../utils/academicExportUtils';

export default function AcademicResults() {
  const [transmissions, setTransmissions] = useState<ExamResultsTransmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [selectedTransmission, setSelectedTransmission] = useState<ExamResultsTransmission | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  useEffect(() => {
    loadTransmissions();
  }, []);

  const loadTransmissions = async () => {
    setIsRefreshing(true);
    try {
      const data = await db.getExamTransmissions();
      setTransmissions((data as ExamResultsTransmission[]) || []);
    } catch (error) {
      console.error('Error loading exam transmissions:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // KPI calculations
  const totalCount = transmissions.length;
  const pendingCount = transmissions.filter(
    (t) => t.status === 'submitted' || t.status === 'under_review'
  ).length;
  const verifiedCount = transmissions.filter((t) => t.status === 'verified').length;
  const revisionCount = transmissions.filter((t) => t.status === 'revision_requested').length;

  // Filter options
  const academicYears = useMemo(() => {
    const years = new Set(transmissions.map((t) => t.academic_year));
    return Array.from(years);
  }, [transmissions]);

  // Filtered list
  const filteredTransmissions = useMemo(() => {
    return transmissions.filter((t) => {
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesYear = yearFilter === 'all' || t.academic_year === yearFilter;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (t.quiz_title || '').toLowerCase().includes(q) ||
        (t.quiz_subject || '').toLowerCase().includes(q) ||
        (t.lecturer_name || '').toLowerCase().includes(q) ||
        (t.lecturer_email || '').toLowerCase().includes(q);

      return matchesStatus && matchesYear && matchesSearch;
    });
  }, [transmissions, statusFilter, yearFilter, searchQuery]);

  const handleOpenDossier = (transmission: ExamResultsTransmission) => {
    setSelectedTransmission(transmission);
    setIsDossierOpen(true);
  };

  const handleQuickCSV = async (transmission: ExamResultsTransmission) => {
    try {
      const candidates = await db.getDetailedQuizCandidatesForBroadsheet(transmission.quiz_id);
      exportAcademicBroadsheetCSV(
        {
          title: transmission.quiz_title || 'Course',
          subject: transmission.quiz_subject || 'General',
          academic_year: transmission.academic_year,
          semester: transmission.semester,
          lecturer_name: transmission.lecturer_name || 'Lecturer',
          lecturer_email: transmission.lecturer_email,
          reviewer_name: transmission.reviewer_name,
          status: transmission.status,
          submitted_at: transmission.submitted_at,
          reviewed_at: transmission.reviewed_at,
        },
        candidates as AcademicCandidateRow[]
      );
    } catch (err) {
      console.error('Error exporting quick CSV broadsheet:', err);
      alert('Failed to generate CSV broadsheet.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-gray-500 animate-pulse">
          Loading Academic Office Examination Records...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Header & System Banner ───────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-blue-500/20 text-blue-300">
                <GraduationCap size={16} />
              </span>
              <span className="text-xs uppercase font-bold tracking-widest text-blue-300">
                Academic Affairs & Examination Records
              </span>
              <Badge variant="primary" className="bg-blue-500/20 text-blue-200 border-blue-400/30 text-[10px]">
                Official Registry
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Academic Results & Broadsheet Records
            </h1>
            <p className="text-sm text-blue-200/80 max-w-xl">
              Official institutional inbox for finalized examination results transmitted by course lecturers. Inspect candidate rosters, audit integrity, verify packages, and export academic broadsheets.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadTransmissions}
              disabled={isRefreshing}
              className="bg-white/10 text-white hover:bg-white/20 border-white/20 backdrop-blur-md"
            >
              <RefreshCw size={14} className={`mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Sync Records
            </Button>
          </div>
        </div>
      </div>

      {/* ─── KPI Summary Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Total Transmissions
              </span>
              <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
              <p className="text-xs text-blue-600 font-medium">Exam packages on record</p>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <FileSpreadsheet size={20} />
            </div>
          </div>
        </Card>

        <Card className="border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Pending Verification
              </span>
              <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
              <p className="text-xs text-amber-600 font-medium">Awaiting officer sign-off</p>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Clock size={20} />
            </div>
          </div>
        </Card>

        <Card className="border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Verified & Locked
              </span>
              <p className="text-2xl font-bold text-emerald-700">{verifiedCount}</p>
              <p className="text-xs text-emerald-600 font-medium">Certified for transcripts</p>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 size={20} />
            </div>
          </div>
        </Card>

        <Card className="border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Revisions Requested
              </span>
              <p className="text-2xl font-bold text-rose-700">{revisionCount}</p>
              <p className="text-xs text-rose-600 font-medium">Returned to faculty</p>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <AlertCircle size={20} />
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Search & Filters Bar ─────────────────────────────────────────── */}
      <Card className="p-4 border border-gray-200">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search course title, subject, or lecturer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 py-1.5 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Academic Year Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 font-semibold">Term:</span>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 bg-white"
              >
                <option value="all">All Academic Years</option>
                {academicYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 font-semibold">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted (New)</option>
                <option value="under_review">Under Review</option>
                <option value="verified">Verified & Locked</option>
                <option value="revision_requested">Revision Requested</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* ─── Master Transmissions Table ───────────────────────────────────── */}
      <Card className="border border-gray-200 p-0 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="font-bold text-gray-900">Transmitted Examination Result Packages</h3>
            <p className="text-xs text-gray-500">
              Showing {filteredTransmissions.length} of {transmissions.length} institutional submissions
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Course / Assessment</th>
                <th className="py-3 px-4">Internal Examiner</th>
                <th className="py-3 px-4">Academic Term</th>
                <th className="py-3 px-4 text-center">Candidates</th>
                <th className="py-3 px-4">Pass Rate</th>
                <th className="py-3 px-4">Mean Score</th>
                <th className="py-3 px-4">Transmitted Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTransmissions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500">
                    <GraduationCap size={36} className="text-gray-300 mx-auto mb-2" />
                    No examination result transmissions match the current filters.
                  </td>
                </tr>
              ) : (
                filteredTransmissions.map((t) => {
                  const passPct = Math.round(
                    (t.passed_candidates / (t.total_candidates || 1)) * 100
                  );

                  return (
                    <tr key={t.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 text-sm max-w-xs truncate">
                          {t.quiz_title}
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {t.quiz_subject || 'General'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-800 flex items-center gap-1">
                          <User size={13} className="text-gray-400" />
                          {t.lecturer_name}
                        </div>
                        <div className="text-[10px] text-gray-400">{t.lecturer_email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-gray-700">{t.academic_year}</span>
                        <span className="block text-[11px] text-gray-500">{t.semester}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-bold text-gray-900 text-xs">
                          {t.total_candidates}
                        </span>
                        <span className="block text-[10px] text-gray-500">
                          {t.passed_candidates}P / {t.failed_candidates}F
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full ${
                                passPct >= 70
                                  ? 'bg-emerald-500'
                                  : passPct >= 50
                                  ? 'bg-blue-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${passPct}%` }}
                            />
                          </div>
                          <span className="font-bold text-gray-700">{passPct}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                            Number(t.average_score) >= 70
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : Number(t.average_score) >= 50
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {Number(t.average_score).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">
                        {new Date(t.submitted_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={
                            t.status === 'verified'
                              ? 'primary'
                              : t.status === 'revision_requested'
                              ? 'danger'
                              : 'warning'
                          }
                          className="uppercase text-[10px]"
                        >
                          {t.status.replace('_', ' ')}
                        </Badge>
                        {t.reviewer_name && (
                          <span className="block text-[9px] text-gray-400 mt-0.5 truncate max-w-[100px]">
                            by {t.reviewer_name}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleQuickCSV(t)}
                            title="Download Official Broadsheet CSV"
                            className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Download size={15} />
                          </button>
                          <Button
                            size="sm"
                            onClick={() => handleOpenDossier(t)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 text-xs px-2.5 py-1"
                          >
                            <Eye size={13} />
                            Dossier
                            <ChevronRight size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── Inspection Dossier Modal ─────────────────────────────────────── */}
      <AcademicDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        transmission={selectedTransmission}
        onStatusUpdated={loadTransmissions}
      />
    </div>
  );
}
