// ─── Academic Export Utilities ──────────────────────────────────────────────
// Generates official CSV broadsheets and print/PDF institutional examination reports

export interface AcademicCandidateRow {
  student_name: string;
  student_email: string;
  index_number?: string;
  score: number | null;
  status: string;
  started_at?: string;
  submitted_at?: string;
  cheated?: boolean;
  cheating_reason?: string;
  tab_switch_count?: number;
  copy_attempts?: number;
  right_click_count?: number;
}

export interface AcademicCourseMetadata {
  title: string;
  subject?: string;
  academic_year: string;
  semester: string;
  lecturer_name: string;
  lecturer_email?: string;
  reviewer_name?: string;
  status?: string;
  submitted_at?: string;
  reviewed_at?: string;
  submission_notes?: string;
  review_notes?: string;
}

export const getLetterGrade = (score: number | null): { grade: string; remark: string; pass: boolean } => {
  if (score === null || isNaN(score)) return { grade: 'N/A', remark: 'Ungraded', pass: false };
  if (score >= 80) return { grade: 'A', remark: 'Excellent', pass: true };
  if (score >= 70) return { grade: 'B', remark: 'Very Good', pass: true };
  if (score >= 60) return { grade: 'C', remark: 'Good', pass: true };
  if (score >= 50) return { grade: 'D', remark: 'Pass', pass: true };
  return { grade: 'F', remark: 'Fail', pass: false };
};

// ─── Official CSV Broadsheet Export ─────────────────────────────────────────

export function exportAcademicBroadsheetCSV(
  meta: AcademicCourseMetadata,
  candidates: AcademicCandidateRow[]
) {
  const headers = [
    'Index Number',
    'Student Full Name',
    'Email Address',
    'Course Title',
    'Subject',
    'Academic Year',
    'Semester',
    'Raw Score (%)',
    'Letter Grade',
    'Academic Standing',
    'Proctoring Integrity',
    'Submitted At',
  ];

  const rows = candidates.map((c) => {
    const rawScore = typeof c.score === 'number' ? Math.round(c.score * 10) / 10 : 0;
    const { grade, remark, pass } = getLetterGrade(c.score);
    const proctoring = c.cheated
      ? `VIOLATION: ${c.cheating_reason || 'Cheating detected'}`
      : (c.tab_switch_count || 0) > 0
      ? `Flagged (${c.tab_switch_count} tab switches)`
      : 'Clean / Cleared';

    const subDate = c.submitted_at
      ? new Date(c.submitted_at).toLocaleString()
      : 'Not submitted';

    return [
      c.index_number || 'N/A',
      c.student_name,
      c.student_email,
      meta.title,
      meta.subject || 'General',
      meta.academic_year,
      meta.semester,
      `${rawScore}%`,
      grade,
      pass ? `PASS (${remark})` : `FAIL (${remark})`,
      proctoring,
      subDate,
    ];
  });

  const csvContent =
    'data:text/csv;charset=utf-8,\uFEFF' +
    [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) => {
            const str = String(cell ?? '');
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(',')
      ),
    ].join('\n');

  const cleanTitle = (meta.title || 'Course').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Official_Broadsheet_${cleanTitle}_${meta.academic_year.replace(/\//g, '-')}_${meta.semester.replace(/\s+/g, '_')}.csv`;

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ─── Printable Official Examination Dossier (PDF / Print-Ready) ─────────────

export function printAcademicDossierReport(
  meta: AcademicCourseMetadata,
  candidates: AcademicCandidateRow[]
) {
  const total = candidates.length;
  const scores = candidates
    .map((c) => (typeof c.score === 'number' ? c.score : 0))
    .filter((s) => !isNaN(s));
  const passed = candidates.filter((c) => (c.score || 0) >= 50).length;
  const failed = total - passed;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const avgScore =
    total > 0
      ? (scores.reduce((a, b) => a + b, 0) / total).toFixed(1)
      : '0.0';
  const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

  const gradeCounts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  candidates.forEach((c) => {
    const { grade } = getLetterGrade(c.score);
    if (grade in gradeCounts) {
      gradeCounts[grade as keyof typeof gradeCounts]++;
    }
  });

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to generate the printable official grade dossier.');
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Official Academic Dossier - ${meta.title}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #111827;
      background: #ffffff;
      margin: 0;
      padding: 24px;
      font-size: 11pt;
      line-height: 1.4;
    }
    .header {
      border-bottom: 2px solid #1e3a8a;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .inst-title {
      font-size: 18pt;
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: -0.5px;
      margin: 0 0 4px 0;
      text-transform: uppercase;
    }
    .inst-sub {
      font-size: 10pt;
      color: #4b5563;
      font-weight: 600;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px 24px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 14px 18px;
      margin-bottom: 20px;
      font-size: 9.5pt;
    }
    .meta-item {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dotted #cbd5e1;
      padding-bottom: 4px;
    }
    .meta-label {
      color: #64748b;
      font-weight: 600;
    }
    .meta-val {
      color: #0f172a;
      font-weight: 700;
    }
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-bottom: 22px;
    }
    .stat-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      text-align: center;
      background: #ffffff;
    }
    .stat-num {
      font-size: 16pt;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    .stat-lbl {
      font-size: 8pt;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .grade-bar {
      display: flex;
      background: #f1f5f9;
      border-radius: 6px;
      padding: 8px 14px;
      margin-bottom: 22px;
      justify-content: space-between;
      font-size: 9pt;
      font-weight: 700;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
      font-size: 9pt;
    }
    th {
      background: #f1f5f9;
      border-bottom: 2px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
      font-weight: 700;
      color: #334155;
      text-transform: uppercase;
      font-size: 8pt;
    }
    td {
      padding: 7px 10px;
      border-bottom: 1px solid #e2e8f0;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background: #fafafa;
    }
    .grade-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 800;
      font-size: 8.5pt;
    }
    .grade-A { background: #dcfce7; color: #166534; }
    .grade-B { background: #dbeafe; color: #1e40af; }
    .grade-C { background: #f3e8ff; color: #6b21a8; }
    .grade-D { background: #fef3c7; color: #92400e; }
    .grade-F { background: #fee2e2; color: #991b1b; }
    .sign-section {
      margin-top: 40px;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 40px;
      page-break-inside: avoid;
    }
    .sign-box {
      border-top: 1px solid #475569;
      padding-top: 10px;
    }
    .sign-title {
      font-size: 9.5pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .sign-desc {
      font-size: 8.5pt;
      color: #64748b;
    }
    .watermark {
      text-align: center;
      margin-top: 30px;
      font-size: 8pt;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 10px;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; text-align: right;">
    <button onclick="window.print()" style="padding: 8px 16px; background: #2563eb; color: #fff; font-weight: bold; border: none; border-radius: 6px; cursor: pointer;">
      🖨️ Print / Save to PDF
    </button>
  </div>

  <div class="header">
    <div>
      <h1 class="inst-title">Smart Examination Board</h1>
      <p class="inst-sub">Office of Academic Affairs & Examination Records</p>
    </div>
    <div style="text-align: right;">
      <span class="badge">Official Grade Broadsheet</span>
      <p style="margin: 4px 0 0 0; font-size: 8pt; color: #64748b;">Generated: ${new Date().toLocaleDateString()}</p>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <span class="meta-label">Course / Assessment:</span>
      <span class="meta-val">${meta.title}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Academic Term:</span>
      <span class="meta-val">${meta.academic_year} • ${meta.semester}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Subject / Faculty:</span>
      <span class="meta-val">${meta.subject || 'General Studies'}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Course Lecturer:</span>
      <span class="meta-val">${meta.lecturer_name}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Transmission Status:</span>
      <span class="meta-val" style="color: #1e40af; text-transform: uppercase;">${(meta.status || 'Verified').replace('_', ' ')}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Verification Officer:</span>
      <span class="meta-val">${meta.reviewer_name || 'Academic Registrar'}</span>
    </div>
  </div>

  <div class="stats-bar" style="grid-template-columns: repeat(6, 1fr);">
    <div class="stat-card">
      <div class="stat-lbl">Candidates Sat</div>
      <div class="stat-num">${total}</div>
    </div>
    <div class="stat-card">
      <div class="stat-lbl">Passed</div>
      <div class="stat-num" style="color: #166534;">${passed}</div>
    </div>
    <div class="stat-card">
      <div class="stat-lbl">Failed</div>
      <div class="stat-num" style="color: #991b1b;">${failed}</div>
    </div>
    <div class="stat-card">
      <div class="stat-lbl">Pass Rate</div>
      <div class="stat-num" style="color: #166534;">${passRate}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-lbl">Class Mean</div>
      <div class="stat-num" style="color: #1e40af;">${avgScore}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-lbl">Score Range</div>
      <div class="stat-num" style="font-size: 13pt;">${lowestScore}% - ${highestScore}%</div>
    </div>
  </div>

  <div class="grade-bar">
    <span>Grade Curve Summary:</span>
    <span style="color: #166534;">Tier A (≥80%): <b>${gradeCounts.A}</b></span>
    <span style="color: #1e40af;">Tier B (70-79%): <b>${gradeCounts.B}</b></span>
    <span style="color: #6b21a8;">Tier C (60-69%): <b>${gradeCounts.C}</b></span>
    <span style="color: #92400e;">Tier D (50-59%): <b>${gradeCounts.D}</b></span>
    <span style="color: #991b1b;">Tier F (&lt;50%): <b>${gradeCounts.F}</b></span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 35px;">#</th>
        <th>Index Number</th>
        <th>Candidate Name</th>
        <th style="width: 80px;">Score</th>
        <th style="width: 70px;">Grade</th>
        <th style="width: 90px;">Standing</th>
        <th>Proctoring Status</th>
      </tr>
    </thead>
    <tbody>
      ${candidates
        .map((c, i) => {
          const raw = typeof c.score === 'number' ? Math.round(c.score * 10) / 10 : 0;
          const { grade, remark, pass } = getLetterGrade(c.score);
          const proctoring = c.cheated
            ? '⚠️ Cheating Flagged'
            : (c.tab_switch_count || 0) > 0
            ? `⚠️ ${c.tab_switch_count} tab switches`
            : '✓ Cleared';

          return `
            <tr>
              <td>${i + 1}</td>
              <td style="font-family: monospace; font-weight: 700;">${c.index_number || 'N/A'}</td>
              <td style="font-weight: 600;">${c.student_name}</td>
              <td><b>${raw}%</b></td>
              <td><span class="grade-badge grade-${grade}">${grade}</span></td>
              <td style="color: ${pass ? '#166534' : '#991b1b'}; font-weight: 700;">
                ${pass ? `PASS (${remark})` : `FAIL (${remark})`}
              </td>
              <td style="font-size: 8pt; color: ${c.cheated ? '#dc2626' : '#475569'};">${proctoring}</td>
            </tr>
          `;
        })
        .join('')}
    </tbody>
  </table>

  <div class="sign-section">
    <div class="sign-box">
      <div class="sign-title">Internal Examiner / Lecturer Certification</div>
      <div class="sign-desc">Name: <b>${meta.lecturer_name}</b></div>
      <div class="sign-desc" style="margin-top: 14px;">Signature: __________________________  Date: ____________</div>
    </div>
    <div class="sign-box">
      <div class="sign-title">Academic Affairs Officer / Dean Approval</div>
      <div class="sign-desc">Name: <b>${meta.reviewer_name || 'Academic Registrar'}</b></div>
      <div class="sign-desc" style="margin-top: 14px;">Signature: __________________________  Date: ____________</div>
    </div>
  </div>

  <div class="watermark">
    This document constitutes an official certified transcript record of the Smart Online Examination System. Any unauthorized alteration renders it null and void.
  </div>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
