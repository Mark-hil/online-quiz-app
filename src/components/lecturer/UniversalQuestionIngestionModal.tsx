import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Upload, FileText, CheckCircle2, AlertTriangle, 
  Trash2, Sparkles, Check, FileSpreadsheet, RefreshCw, FileCode
} from 'lucide-react';
import Button from '../ui/Button';
import { AssessmentCategoryItem, AssessmentCategory } from '../../lib/database';
import { 
  ASSESSMENT_CATEGORIES, 
  getCategoryColorBadgeClasses 
} from '../../utils/categoryUtils';
import { 
  ParsedIngestionQuestion, 
  IngestionDefaults, 
  parseAikenFormat, 
  parseSmartText, 
  parseDocxBuffer, 
  parseXlsxBuffer, 
  generateAikenSampleText, 
  generateExcelTemplateBlob 
} from '../../utils/questionIngestionParsers';
import { 
  generateQuestionCSVTemplate, 
  downloadCSVFile 
} from '../../utils/csvQuestionUtils';

interface UniversalQuestionIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseCode?: string;
  courseTitle?: string;
  courseCategories?: AssessmentCategoryItem[];
  onImport: (questions: ParsedIngestionQuestion[]) => Promise<void> | void;
  targetContext?: 'question_bank' | 'quiz';
}

export default function UniversalQuestionIngestionModal({
  isOpen,
  onClose,
  courseCode,
  courseTitle,
  courseCategories = [],
  onImport,
  targetContext = 'question_bank'
}: UniversalQuestionIngestionModalProps) {
  const [activeTab, setActiveTab] = useState<'smart_paste' | 'file_upload'>('smart_paste');

  // Metadata Defaults
  const [defaultTopic, setDefaultTopic] = useState('General');
  const [defaultDifficulty, setDefaultDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [defaultTier, setDefaultTier] = useState<AssessmentCategory>('quiz');
  const [defaultCategoryPrefix, setDefaultCategoryPrefix] = useState('');
  const [defaultMarks, setDefaultMarks] = useState(1);

  // Smart Paste State
  const [pasteText, setPasteText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<ParsedIngestionQuestion[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<string>('smart_text');

  // Lock background body scroll and listen for Escape key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // File Upload State
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isFileParsing, setIsFileParsing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Submitting
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ref to debounce parsing on paste text changes
  const parseTimeoutRef = useRef<any>(null);

  const defaults: IngestionDefaults = useMemo(() => ({
    topic: defaultTopic.trim() || 'General',
    difficulty: defaultDifficulty,
    assessment_tier: defaultTier,
    category_prefix: defaultCategoryPrefix || undefined,
    category: courseCategories.find(c => c.prefix === defaultCategoryPrefix)?.name || 'General',
    defaultMarks: Number(defaultMarks) || 1,
  }), [defaultTopic, defaultDifficulty, defaultTier, defaultCategoryPrefix, defaultMarks, courseCategories]);

  // Real-time debounced parsing for Smart Paste
  useEffect(() => {
    if (activeTab !== 'smart_paste') return;

    if (!pasteText.trim()) {
      setParsedQuestions([]);
      setParseWarnings([]);
      return;
    }

    if (parseTimeoutRef.current) {
      clearTimeout(parseTimeoutRef.current);
    }

    parseTimeoutRef.current = setTimeout(() => {
      const res = parseSmartText(pasteText, defaults);
      setParsedQuestions(res.questions);
      setParseWarnings(res.warnings);
      setDetectedFormat(res.format);
    }, 250);

    return () => {
      if (parseTimeoutRef.current) {
        clearTimeout(parseTimeoutRef.current);
      }
    };
  }, [pasteText, defaults, activeTab]);

  // Load sample Aiken
  const handleLoadSampleAiken = () => {
    const sample = generateAikenSampleText();
    setPasteText(sample);
  };

  // Handle File Upload
  const handleFileUpload = async (file: File) => {
    setUploadedFileName(file.name);
    setIsFileParsing(true);
    setFileError(null);

    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      if (ext === 'docx') {
        const buffer = await file.arrayBuffer();
        const res = await parseDocxBuffer(buffer, defaults);
        setParsedQuestions(res.questions);
        setParseWarnings(res.warnings);
        setDetectedFormat('docx');
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        const res = parseXlsxBuffer(buffer, defaults);
        setParsedQuestions(res.questions);
        setParseWarnings(res.warnings);
        setDetectedFormat('xlsx');
      } else if (ext === 'txt' || ext === 'aiken') {
        const text = await file.text();
        const res = parseAikenFormat(text, defaults);
        setParsedQuestions(res.questions);
        setParseWarnings(res.warnings);
        setDetectedFormat('aiken');
      } else if (ext === 'csv') {
        const text = await file.text();
        const res = parseSmartText(text, defaults);
        setParsedQuestions(res.questions);
        setParseWarnings(res.warnings);
        setDetectedFormat('csv');
      } else {
        setFileError(`Unsupported file format .${ext}. Please upload a .docx, .xlsx, .txt, or .csv file.`);
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      setFileError(`Failed to process file: ${err.message || String(err)}`);
    } finally {
      setIsFileParsing(false);
    }
  };

  // Direct option click to select/fix answer
  const handleSelectCorrectOption = (questionId: string, optionText: string) => {
    setParsedQuestions(prev => prev.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          correct_answer: optionText,
          warnings: q.warnings.filter(w => !w.toLowerCase().includes('answer')),
        };
      }
      return q;
    }));
  };

  // Remove individual question from preview
  const handleRemoveQuestion = (questionId: string) => {
    setParsedQuestions(prev => prev.filter(q => q.id !== questionId));
  };

  // Execute Import
  const handleConfirmImport = async () => {
    if (parsedQuestions.length === 0) return;
    setIsSubmitting(true);
    try {
      await onImport(parsedQuestions);
      onClose();
    } catch (err) {
      console.error('Import error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download templates
  const handleDownloadExcelTemplate = () => {
    const blob = generateExcelTemplateBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${courseCode || 'Course'}_Question_Template.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAikenTemplate = () => {
    const sample = generateAikenSampleText();
    downloadCSVFile(sample, `${courseCode || 'Course'}_Aiken_Template.txt`);
  };

  const handleDownloadCsvTemplate = () => {
    const template = generateQuestionCSVTemplate(courseCode);
    downloadCSVFile(template, `${courseCode || 'Course'}_Question_Template.csv`);
  };

  if (!isOpen) return null;

  const totalMarksCount = parsedQuestions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0);
  const questionsWithWarnings = parsedQuestions.filter(q => q.warnings.length > 0);

  const modalNode = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col z-10 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900">
                  Universal Question Ingestion
                </h2>
                {(courseCode || courseTitle) && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                    {courseCode} {courseTitle ? `• ${courseTitle}` : ''}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Import from Aiken plain text, copy-paste from Microsoft Word / PDF, or upload Word (.docx) and Excel (.xlsx) files.
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

        {/* Global Metadata Strip */}
        <div className="px-6 py-3 bg-indigo-50/30 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-2.5 shrink-0 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-0.5">Classification Tier</label>
            <select
              value={defaultTier}
              onChange={(e) => setDefaultTier(e.target.value as any)}
              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {ASSESSMENT_CATEGORIES.map(cat => (
                <option key={cat.key} value={cat.key}>{cat.shortLabel}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-0.5">Category Prefix</label>
            <select
              value={defaultCategoryPrefix}
              onChange={(e) => setDefaultCategoryPrefix(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">General (No Prefix)</option>
              {courseCategories.map(cat => (
                <option key={cat.id} value={cat.prefix}>[{cat.prefix}] {cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-0.5">Default Topic</label>
            <input
              type="text"
              value={defaultTopic}
              onChange={(e) => setDefaultTopic(e.target.value)}
              placeholder="e.g. Loops, SQL, Optics"
              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-0.5">Default Difficulty</label>
            <select
              value={defaultDifficulty}
              onChange={(e) => setDefaultDifficulty(e.target.value as any)}
              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="easy">🟢 Easy</option>
              <option value="medium">🟡 Medium</option>
              <option value="hard">🔴 Hard</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-0.5">Marks Per Question</label>
            <input
              type="number"
              min="1"
              max="100"
              value={defaultMarks}
              onChange={(e) => setDefaultMarks(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {parseWarnings.length > 0 && (
          <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-medium flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-amber-600" />
              Parsing Note: {parseWarnings[0]}
            </span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('smart_paste')}
              className={`py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'smart_paste'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileCode size={16} />
              <span>Smart Paste & Aiken Parser</span>
            </button>

            <button
              onClick={() => setActiveTab('file_upload')}
              className={`py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'file_upload'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Upload size={16} />
              <span>Document Upload (.docx / .xlsx / .csv / .txt)</span>
            </button>
          </div>

          {/* Template Download Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-medium">Templates:</span>
            <button
              onClick={handleDownloadAikenTemplate}
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline"
            >
              Aiken (.txt)
            </button>
            <span className="text-slate-300">•</span>
            <button
              onClick={handleDownloadExcelTemplate}
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline"
            >
              Excel (.xlsx)
            </button>
            <span className="text-slate-300">•</span>
            <button
              onClick={handleDownloadCsvTemplate}
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline"
            >
              CSV
            </button>
          </div>
        </div>

        {/* Tab Body: Split Screen */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 min-h-0">
          {/* Left Column: Input Source */}
          <div className="flex flex-col h-full overflow-hidden bg-slate-50/30">
            {activeTab === 'smart_paste' ? (
              <div className="flex flex-col h-full p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <FileText size={14} className="text-indigo-600" />
                    Paste Questions Here
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleLoadSampleAiken}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline"
                    >
                      Load Sample Aiken
                    </button>
                    {pasteText && (
                      <button
                        onClick={() => setPasteText('')}
                        className="text-[11px] text-slate-400 hover:text-rose-600"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`Paste questions from Word, PDF, or Aiken format here...\n\nExample Aiken:\nWhat is the output of 2 + 2?\nA. 3\nB. 4\nC. 5\nANSWER: B\n\nExample Numbered:\n1. Which data structure follows FIFO?\nA) Stack\nB) Queue\nAnswer: B`}
                  className="w-full flex-1 p-3 bg-white border border-slate-200 rounded-2xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none shadow-xs"
                />

                <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                  <span>Detected syntax: <strong className="text-slate-800 uppercase">{detectedFormat}</strong></span>
                  <span>{pasteText.length} characters • {pasteText.split('\n').filter(Boolean).length} lines</span>
                </div>
              </div>
            ) : (
              /* File Upload Tab */
              <div className="flex flex-col h-full p-6 space-y-4 overflow-y-auto">
                <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-3xl p-8 text-center transition-colors bg-white">
                  <Upload size={36} className="mx-auto text-indigo-500 mb-3" />
                  <h4 className="font-bold text-slate-800 text-sm">
                    Drag and drop your exam file here
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Supports Microsoft Word (<strong>.docx</strong>), Excel Workbooks (<strong>.xlsx</strong>), Aiken text files (<strong>.txt</strong>, <strong>.aiken</strong>), and CSV.
                  </p>

                  <div className="mt-4">
                    <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-sm">
                      <FileSpreadsheet size={16} />
                      <span>Browse Files</span>
                      <input
                        type="file"
                        accept=".docx,.xlsx,.xls,.csv,.txt,.aiken"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {uploadedFileName && (
                    <div className="mt-3 text-xs font-semibold text-indigo-700 flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={14} />
                      <span>Loaded: {uploadedFileName}</span>
                    </div>
                  )}
                </div>

                {isFileParsing && (
                  <div className="p-4 bg-indigo-50 rounded-2xl text-center text-xs text-indigo-800 font-semibold flex items-center justify-center gap-2">
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Analyzing document structure and extracting questions...</span>
                  </div>
                )}

                {fileError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-medium flex items-center gap-2">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{fileError}</span>
                  </div>
                )}

                {/* Format Guidance Cards */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <span className="font-bold text-slate-800 block mb-1">📄 Word (.docx)</span>
                    <p className="text-[11px] text-slate-500">
                      Standard numbered exam scripts (1., Q1:) with lettered choices (A., B.) and answer keys.
                    </p>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <span className="font-bold text-slate-800 block mb-1">📊 Excel (.xlsx)</span>
                    <p className="text-[11px] text-slate-500">
                      Multi-sheet workbooks where sheet names can automatically become question topics.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Quality Preview */}
          <div className="flex flex-col h-full overflow-hidden bg-white">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Live Parsed Preview
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-indigo-100 text-indigo-700">
                  {parsedQuestions.length} {parsedQuestions.length === 1 ? 'question' : 'questions'}
                </span>
              </div>

              {parsedQuestions.length > 0 && (
                <div className="text-xs text-slate-500 font-medium">
                  {totalMarksCount} total marks
                </div>
              )}
            </div>

            {/* Questions List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {parsedQuestions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                  <FileText size={40} className="text-slate-200 mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No questions detected yet</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                    Paste an exam script on the left or upload a Word/Excel document to preview questions live.
                  </p>
                </div>
              ) : (
                parsedQuestions.map((q, idx) => {
                  const hasWarning = q.warnings.length > 0;
                  return (
                    <div 
                      key={q.id}
                      className={`p-3.5 rounded-2xl border transition-all text-xs ${
                        hasWarning 
                          ? 'border-amber-300 bg-amber-50/30 ring-1 ring-amber-300/50' 
                          : 'border-slate-200 hover:border-slate-300 bg-white shadow-xs'
                      }`}
                    >
                      {/* Top Bar of Card */}
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                            #{idx + 1}
                          </span>
                          <span className="px-2 py-0.5 rounded-md uppercase font-bold text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {q.question_type.toUpperCase()}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {q.topic} • {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
                          </span>
                          {q.category_prefix && (
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border uppercase ${getCategoryColorBadgeClasses(courseCategories.find(c => c.prefix === q.category_prefix)?.color)}`}>
                              [{q.category_prefix}]
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleRemoveQuestion(q.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors"
                          title="Remove this question"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Question Text */}
                      <p className="font-semibold text-slate-900 mb-2 leading-relaxed">
                        {q.question_text}
                      </p>

                      {/* Options with interactive answer selection */}
                      {q.options.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {q.options.map((opt, optIdx) => {
                            const isCorrect = q.correct_answer === opt;
                            const letter = String.fromCharCode(65 + optIdx);
                            return (
                              <div
                                key={optIdx}
                                onClick={() => handleSelectCorrectOption(q.id, opt)}
                                className={`flex items-center gap-2 p-1.5 rounded-xl cursor-pointer transition-colors ${
                                  isCorrect 
                                    ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200' 
                                    : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                  isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {isCorrect ? <Check size={12} /> : letter}
                                </div>
                                <span className="flex-1">{opt}</span>
                                {isCorrect && (
                                  <span className="text-[10px] uppercase font-extrabold text-emerald-700 tracking-wider">
                                    Correct
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Warnings if any */}
                      {hasWarning && (
                        <div className="mt-2 p-2 rounded-xl bg-amber-100/70 text-amber-900 text-[11px] font-medium flex items-center gap-1.5">
                          <AlertTriangle size={14} className="shrink-0 text-amber-700" />
                          <span>{q.warnings.join(' ')}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-3 text-xs">
            {parsedQuestions.length > 0 && (
              <span className="font-semibold text-slate-700">
                Ready to import: <strong className="text-indigo-700 font-bold">{parsedQuestions.length} questions</strong> ({totalMarksCount} marks total)
              </span>
            )}
            {questionsWithWarnings.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 flex items-center gap-1">
                <AlertTriangle size={12} />
                {questionsWithWarnings.length} need verification
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <Button
              onClick={handleConfirmImport}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20"
              disabled={isSubmitting || parsedQuestions.length === 0}
            >
              {isSubmitting ? (
                'Importing...'
              ) : targetContext === 'quiz' ? (
                `Add ${parsedQuestions.length} Questions to Exam`
              ) : (
                `Import ${parsedQuestions.length} Questions to Bank`
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalNode, document.body)
    : null;
}
