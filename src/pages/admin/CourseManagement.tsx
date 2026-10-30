import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, Plus, Search, Upload, Download, RefreshCw, 
  Users, CheckCircle2, AlertTriangle, Trash2, Edit2, UserCheck, 
  GraduationCap, Building, Layers, X, FileSpreadsheet, ShieldCheck
} from 'lucide-react';
import BankAccessManagementModal from '../../components/lecturer/BankAccessManagementModal';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { db, Course } from '../../lib/database';
import { 
  parseCoursesCSV, 
  generateCourseCSVTemplate, 
  exportCoursesToCSVString, 
  downloadCSVFile,
  ParsedCourseRow
} from '../../utils/courseCsvUtils';

interface LecturerProfile {
  id: string;
  name: string;
  email: string;
}

export default function CourseManagement() {

  // Courses state
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [lecturers, setLecturers] = useState<LecturerProfile[]>([]);
  const [selectedCourseForAccess, setSelectedCourseForAccess] = useState<Course | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState({
    code: '',
    title: '',
    department: '',
    assigned_lecturer_id: ''
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Assign Lecturer Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [targetCourseForAssign, setTargetCourseForAssign] = useState<Course | null>(null);
  const [selectedLecturerIdForAssign, setSelectedLecturerIdForAssign] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Bulk Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedImportRows, setParsedImportRows] = useState<ParsedCourseRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Delete Confirmation Modal
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Load courses & lecturers
  const loadData = async () => {
    setLoading(true);
    try {
      const [coursesData, lecturersData] = await Promise.all([
        db.getCourses(),
        db.getUsersByRole('lecturer').catch(() => [])
      ]);
      setCourses(coursesData as Course[]);
      setLecturers(lecturersData as LecturerProfile[]);
    } catch (err) {
      console.error('Failed to load courses:', err);
      showToast('Failed to load course registry.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute departments list
  const departments = useMemo(() => {
    const set = new Set<string>();
    courses.forEach(c => {
      if (c.department && c.department.trim()) {
        set.add(c.department.trim());
      }
    });
    return Array.from(set).sort();
  }, [courses]);

  // Key metrics
  const stats = useMemo(() => {
    const total = courses.length;
    const assigned = courses.filter(c => !!c.assigned_lecturer_id).length;
    const unassigned = total - assigned;
    const totalQuestions = courses.reduce((sum, c) => sum + (Number(c.question_count) || 0), 0);
    const activeQuestions = courses.reduce((sum, c) => sum + (Number(c.active_question_count) || 0), 0);
    const totalQuizzes = courses.reduce((sum, c) => sum + (Number(c.quiz_count) || 0), 0);
    return { total, assigned, unassigned, totalQuestions, activeQuestions, totalQuizzes };
  }, [courses]);

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchCode = c.code.toLowerCase().includes(q);
        const matchTitle = c.title.toLowerCase().includes(q);
        const matchDept = (c.department || '').toLowerCase().includes(q);
        const matchLecturer = (c.assigned_lecturer_name || '').toLowerCase().includes(q);
        if (!matchCode && !matchTitle && !matchDept && !matchLecturer) return false;
      }

      if (selectedDepartment !== 'all' && (c.department || '') !== selectedDepartment) {
        return false;
      }

      if (assignmentFilter === 'assigned' && !c.assigned_lecturer_id) {
        return false;
      }
      if (assignmentFilter === 'unassigned' && !!c.assigned_lecturer_id) {
        return false;
      }

      return true;
    });
  }, [courses, searchQuery, selectedDepartment, assignmentFilter]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setIsEditing(false);
    setEditingCourseId(null);
    setCourseForm({
      code: '',
      title: '',
      department: '',
      assigned_lecturer_id: ''
    });
    setFormError('');
    setShowAddEditModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (c: Course) => {
    setIsEditing(true);
    setEditingCourseId(c.id);
    setCourseForm({
      code: c.code,
      title: c.title,
      department: c.department || '',
      assigned_lecturer_id: c.assigned_lecturer_id || ''
    });
    setFormError('');
    setShowAddEditModal(true);
  };

  // Submit Add / Edit Form
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const code = courseForm.code.trim().toUpperCase();
    const title = courseForm.title.trim();
    const department = courseForm.department.trim();
    const assigned_lecturer_id = courseForm.assigned_lecturer_id || null;

    if (!code || !title) {
      setFormError('Course Code and Course Title are required.');
      return;
    }

    setFormSubmitting(true);
    try {
      if (isEditing && editingCourseId) {
        await db.updateCourse(editingCourseId, {
          code,
          title,
          department,
          assigned_lecturer_id
        });
        showToast(`Course ${code} updated successfully.`);
      } else {
        await db.createCourse({
          code,
          title,
          department,
          assigned_lecturer_id
        });
        showToast(`Course ${code} created successfully.`);
      }
      setShowAddEditModal(false);
      await loadData();
    } catch (err: any) {
      console.error('Error saving course:', err);
      setFormError(err.message || 'Failed to save course. Check for duplicate course code.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Quick Assign Modal
  const handleOpenAssignModal = (course: Course) => {
    setTargetCourseForAssign(course);
    setSelectedLecturerIdForAssign(course.assigned_lecturer_id || '');
    setShowAssignModal(true);
  };

  const handleConfirmAssignment = async () => {
    if (!targetCourseForAssign) return;
    setIsAssigning(true);
    try {
      await db.assignCourseLecturer(
        targetCourseForAssign.id, 
        selectedLecturerIdForAssign ? selectedLecturerIdForAssign : null
      );
      showToast(`Lecturer assignment updated for ${targetCourseForAssign.code}.`);
      setShowAssignModal(false);
      await loadData();
    } catch (err: any) {
      console.error('Failed to assign lecturer:', err);
      showToast('Error updating lecturer assignment.', 'error');
    } finally {
      setIsAssigning(false);
    }
  };

  // Delete Course
  const handleConfirmDelete = async () => {
    if (!courseToDelete) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await db.deleteCourse(courseToDelete.id);
      showToast(`Course ${courseToDelete.code} deleted successfully.`);
      setCourseToDelete(null);
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete course:', err);
      setDeleteError(err.message || 'Cannot delete course while active assets are linked.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (courses.length === 0) {
      showToast('No courses available to export.', 'info');
      return;
    }
    const csv = exportCoursesToCSVString(courses);
    downloadCSVFile(csv, `University_Courses_Catalog_${new Date().toISOString().split('T')[0]}.csv`);
    showToast(`Exported ${courses.length} courses to CSV.`);
  };

  // Import CSV handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportErrors([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parseResult = parseCoursesCSV(content);
      setParsedImportRows(parseResult.courses);
      setImportErrors(parseResult.errors);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (parsedImportRows.length === 0) {
      showToast('No valid course rows to import.', 'error');
      return;
    }
    setIsImporting(true);
    try {
      const res = await db.bulkInsertCourses(parsedImportRows);
      showToast(`Import completed: ${res.inserted} created, ${res.updated} updated.`);
      setShowImportModal(false);
      setImportFile(null);
      setParsedImportRows([]);
      setImportErrors([]);
      await loadData();
    } catch (err: any) {
      console.error('Failed to bulk import courses:', err);
      showToast('Error importing courses.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Feedback */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold transition-all ${
          toast.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : toast.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider border border-indigo-500/30">
              Academic Officer Governance
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <GraduationCap className="text-indigo-400" size={28} />
            Institutional Course Registry
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl">
            Centrally oversee university courses, assign Lead Lecturers and Course Coordinators, inspect question bank reserves, and maintain institutional curriculum standards.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={() => setShowImportModal(true)}
            variant="outline"
            size="sm"
            className="border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Upload size={14} />
            <span>Import CSV</span>
          </Button>

          <Button
            onClick={handleExportCSV}
            variant="outline"
            size="sm"
            className="border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </Button>

          <Button
            onClick={handleOpenAddModal}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
          >
            <Plus size={16} />
            <span>New Course</span>
          </Button>
        </div>
      </div>

      {/* Key Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-slate-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Courses</span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <BookOpen size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-slate-900">{stats.total}</span>
            <p className="text-xs text-slate-500 mt-1">Institutional curriculum catalog</p>
          </div>
        </Card>

        <Card className="p-5 border-slate-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Assigned Courses</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <UserCheck size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-emerald-600">{stats.assigned}</span>
            <p className="text-xs text-slate-500 mt-1">Lead Lecturers actively appointed</p>
          </div>
        </Card>

        <Card className="p-5 border-slate-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Unassigned Courses</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-amber-600">{stats.unassigned}</span>
            <p className="text-xs text-slate-500 mt-1">
              {stats.unassigned > 0 ? 'Requires Academic Officer assignment' : 'All courses covered'}
            </p>
          </div>
        </Card>

        <Card className="p-5 border-slate-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Question Bank Reserves</span>
            <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
              <Layers size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-purple-700">{stats.activeQuestions}</span>
            <p className="text-xs text-slate-500 mt-1">{stats.totalQuestions} total banked across {stats.totalQuizzes} exams</p>
          </div>
        </Card>
      </div>

      {/* Filters & Search Toolbar */}
      <Card className="p-4 border-slate-100 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search code, title, lecturer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Departments ({courses.length})</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={assignmentFilter}
              onChange={(e) => setAssignmentFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Assignment Statuses</option>
              <option value="assigned">Assigned to Lecturer ({stats.assigned})</option>
              <option value="unassigned">Unassigned / Orphaned ({stats.unassigned})</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={loadData}
              variant="outline"
              size="sm"
              className="w-full h-full flex items-center justify-center gap-1.5 text-xs text-slate-600 border-slate-200"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Courses Registry Table */}
      <Card className="overflow-hidden border-slate-100 shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 text-sm">Course Directory</span>
            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold">
              {filteredCourses.length} {filteredCourses.length === 1 ? 'course' : 'courses'}
            </span>
          </div>
          <span className="text-xs text-slate-500">
            Click edit to update codes, or assign a Lead Lecturer to govern the question bank.
          </span>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-500">
            <RefreshCw size={28} className="animate-spin mx-auto text-indigo-600 mb-2" />
            <p className="text-sm">Loading course directory...</p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <BookOpen size={40} className="mx-auto text-slate-300 mb-3" />
            <h4 className="text-base font-semibold text-slate-800">No courses match your filter</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery || selectedDepartment !== 'all' || assignmentFilter !== 'all'
                ? 'Try clearing your search query or department filter.'
                : 'Click "New Course" or "Import CSV" to populate the institutional course registry.'}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button onClick={handleOpenAddModal} size="sm" className="bg-indigo-600 text-white text-xs">
                <Plus size={14} className="mr-1" /> Add Course
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Course Code & Title</th>
                  <th className="py-3 px-4">Department / Faculty</th>
                  <th className="py-3 px-4">Appointed Lead Lecturer</th>
                  <th className="py-3 px-4 text-center">Exam Reserves</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCourses.map((c) => {
                  const hasLecturer = !!c.assigned_lecturer_id;
                  const activeQ = Number(c.active_question_count) || 0;
                  const totalQ = Number(c.question_count) || 0;
                  const quizCount = Number(c.quiz_count) || 0;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Code & Title */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <span className="font-extrabold text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 tracking-wide">
                            {c.code}
                          </span>
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">{c.title}</span>
                            <span className="text-[11px] text-slate-400">ID: {c.id.slice(0, 8)}...</span>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4">
                        {c.department ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                            <Building size={14} className="text-slate-400 shrink-0" />
                            <span>{c.department}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Unspecified</span>
                        )}
                      </td>

                      {/* Appointed Lecturer */}
                      <td className="py-3.5 px-4">
                        {hasLecturer ? (
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
                              {(c.assigned_lecturer_name || 'L').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-800 text-xs block truncate">
                                {c.assigned_lecturer_name || 'Assigned Lecturer'}
                              </span>
                              <span className="text-[11px] text-slate-400 block truncate">
                                {c.assigned_lecturer_email}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                              <AlertTriangle size={12} />
                              Unassigned
                            </span>
                            <button
                              onClick={() => handleOpenAssignModal(c)}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline ml-1"
                            >
                              Assign
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Exam Assets */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {activeQ} Active Questions
                          </span>
                          <span className="text-[11px] text-slate-400 mt-0.5">
                            {totalQ} banked • {quizCount} {quizCount === 1 ? 'quiz' : 'quizzes'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedCourseForAccess(c)}
                            title="Manage Question Bank Access & Delegations"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          >
                            <ShieldCheck size={16} />
                          </button>

                          <button
                            onClick={() => handleOpenAssignModal(c)}
                            title="Assign / Reassign Lecturer"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <Users size={16} />
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(c)}
                            title="Edit Course Details"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>

                          <button
                            onClick={() => {
                              setCourseToDelete(c);
                              setDeleteError('');
                            }}
                            title="Delete Course"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Course Modal */}
      <Modal
        isOpen={showAddEditModal}
        onClose={() => setShowAddEditModal(false)}
        title={isEditing ? 'Edit Institutional Course' : 'Create New Institutional Course'}
      >
        <form onSubmit={handleSaveCourse} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Course Code *
            </label>
            <input
              type="text"
              placeholder="e.g. CSC101, ENG202"
              value={courseForm.code}
              onChange={(e) => setCourseForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Unique institutional identifier (uppercase letters and numbers).
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Course Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Introduction to Programming & Algorithms"
              value={courseForm.title}
              onChange={(e) => setCourseForm(prev => ({ ...prev, title: e.target.value }))}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Department / Faculty
            </label>
            <input
              type="text"
              placeholder="e.g. Computer Science & Software Engineering"
              value={courseForm.department}
              onChange={(e) => setCourseForm(prev => ({ ...prev, department: e.target.value }))}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Appointed Lead Lecturer (Optional)
            </label>
            <select
              value={courseForm.assigned_lecturer_id}
              onChange={(e) => setCourseForm(prev => ({ ...prev, assigned_lecturer_id: e.target.value }))}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- No Lecturer Appointed (Unassigned) --</option>
              {lecturers.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.email})
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Lead Lecturer gains full authoring and management authority over this course bank.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddEditModal(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              disabled={formSubmitting}
            >
              {formSubmitting ? 'Saving...' : isEditing ? 'Update Course' : 'Create Course'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Quick Assign Lecturer Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title={`Appoint Lead Lecturer • ${targetCourseForAssign?.code || ''}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Designate the primary instructor or course coordinator responsible for authoring questions and setting exams for <strong>{targetCourseForAssign?.title}</strong>.
          </p>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Select Lecturer
            </label>
            <select
              value={selectedLecturerIdForAssign}
              onChange={(e) => setSelectedLecturerIdForAssign(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Remove Appointed Lecturer (Set Unassigned) --</option>
              {lecturers.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.email})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setShowAssignModal(false)}
              disabled={isAssigning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAssignment}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              disabled={isAssigning}
            >
              {isAssigning ? 'Updating...' : 'Confirm Assignment'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk CSV Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportFile(null);
          setParsedImportRows([]);
          setImportErrors([]);
        }}
        title="Institutional Bulk Course Import"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Upload a standardized CSV file to import multiple institutional courses in bulk. Existing course codes will be updated with the latest details.
          </p>

          <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-900 text-xs font-semibold">
              <FileSpreadsheet size={18} className="text-indigo-600" />
              <span>Standard Course Import Template</span>
            </div>
            <button
              onClick={() => {
                const template = generateCourseCSVTemplate();
                downloadCSVFile(template, 'Courses_Import_Template.csv');
              }}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline"
            >
              Download Template
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Select CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
            {importFile && (
              <span className="text-[11px] text-indigo-700 font-semibold block mt-1">
                Selected file: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>

          {importErrors.length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
              <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                <AlertTriangle size={14} /> Validation Warnings ({importErrors.length}):
              </span>
              <ul className="text-[11px] text-rose-700 list-disc list-inside max-h-24 overflow-y-auto">
                {importErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {parsedImportRows.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">
                Preview ({parsedImportRows.length} courses detected):
              </span>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                {parsedImportRows.map((r, i) => (
                  <div key={i} className="p-2 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-indigo-700 mr-2">[{r.code}]</span>
                      <span className="text-slate-800">{r.title}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">{r.department}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => {
                setShowImportModal(false);
                setImportFile(null);
                setParsedImportRows([]);
                setImportErrors([]);
              }}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExecuteImport}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              disabled={isImporting || parsedImportRows.length === 0}
            >
              {isImporting ? 'Importing...' : `Import ${parsedImportRows.length} Courses`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!courseToDelete}
        onClose={() => {
          setCourseToDelete(null);
          setDeleteError('');
        }}
        title="Delete Institutional Course"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-700">
            Are you sure you want to delete course <strong className="text-slate-900">{courseToDelete?.code} ({courseToDelete?.title})</strong>?
          </p>

          {deleteError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
            <span className="font-bold block mb-1">Safety Policy:</span>
            Courses containing banked questions or scheduled exams cannot be deleted. You must delete or reassign those assets prior to removal.
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => {
                setCourseToDelete(null);
                setDeleteError('');
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Question Bank Access & Delegations Governance Modal */}
      {selectedCourseForAccess && (
        <BankAccessManagementModal
          isOpen={!!selectedCourseForAccess}
          onClose={() => setSelectedCourseForAccess(null)}
          courseId={selectedCourseForAccess.id}
          courseCode={selectedCourseForAccess.code}
          courseTitle={selectedCourseForAccess.title}
          assignedLecturerName={selectedCourseForAccess.assigned_lecturer_name || undefined}
          assignedLecturerEmail={selectedCourseForAccess.assigned_lecturer_email || undefined}
          assignedLecturerId={selectedCourseForAccess.assigned_lecturer_id || undefined}
          isAcademicOfficer={true}
          onChanged={loadData}
        />
      )}
    </div>
  );
}
