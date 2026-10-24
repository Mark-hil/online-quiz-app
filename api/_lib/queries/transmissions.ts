import { sql } from '../db.js';

export async function createExamTransmission(data: {
  quiz_id: string;
  lecturer_id: string;
  academic_year: string;
  semester: string;
  submission_notes?: string;
  total_candidates: number;
  passed_candidates: number;
  failed_candidates: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  grade_counts?: Record<string, number>;
}) {
  const result = await sql`
    INSERT INTO exam_results_transmissions (
      quiz_id, lecturer_id, academic_year, semester,
      submission_notes, total_candidates, passed_candidates,
      failed_candidates, average_score, highest_score, lowest_score,
      grade_counts, status
    )
    VALUES (
      ${data.quiz_id}, ${data.lecturer_id}, ${data.academic_year}, ${data.semester},
      ${data.submission_notes || null}, ${data.total_candidates}, ${data.passed_candidates},
      ${data.failed_candidates}, ${data.average_score}, ${data.highest_score}, ${data.lowest_score},
      ${JSON.stringify(data.grade_counts || {})}, 'submitted'
    )
    ON CONFLICT (quiz_id, academic_year, semester)
    DO UPDATE SET
      submission_notes = EXCLUDED.submission_notes,
      total_candidates = EXCLUDED.total_candidates,
      passed_candidates = EXCLUDED.passed_candidates,
      failed_candidates = EXCLUDED.failed_candidates,
      average_score = EXCLUDED.average_score,
      highest_score = EXCLUDED.highest_score,
      lowest_score = EXCLUDED.lowest_score,
      grade_counts = EXCLUDED.grade_counts,
      status = 'submitted',
      submitted_at = now(),
      updated_at = now()
    RETURNING *
  `;
  return result[0];
}

export async function getExamTransmissions() {
  try {
    return await sql`
      SELECT 
        ert.*,
        q.title as quiz_title,
        q.subject as quiz_subject,
        q.duration_minutes,
        lp.name as lecturer_name,
        lp.email as lecturer_email,
        rp.name as reviewer_name
      FROM exam_results_transmissions ert
      JOIN quizzes q ON ert.quiz_id = q.id
      JOIN profiles lp ON ert.lecturer_id = lp.id
      LEFT JOIN profiles rp ON ert.reviewer_id = rp.id
      ORDER BY ert.submitted_at DESC
    `;
  } catch (error) {
    console.error('Error fetching exam transmissions:', error);
    return [];
  }
}

export async function getExamTransmissionsByLecturer(lecturerId: string) {
  try {
    return await sql`
      SELECT 
        ert.*,
        q.title as quiz_title,
        q.subject as quiz_subject,
        rp.name as reviewer_name
      FROM exam_results_transmissions ert
      JOIN quizzes q ON ert.quiz_id = q.id
      LEFT JOIN profiles rp ON ert.reviewer_id = rp.id
      WHERE ert.lecturer_id = ${lecturerId}
      ORDER BY ert.submitted_at DESC
    `;
  } catch (error) {
    console.error('Error fetching lecturer exam transmissions:', error);
    return [];
  }
}

export async function getExamTransmissionByQuiz(quizId: string) {
  try {
    const result = await sql`
      SELECT ert.*, rp.name as reviewer_name
      FROM exam_results_transmissions ert
      LEFT JOIN profiles rp ON ert.reviewer_id = rp.id
      WHERE ert.quiz_id = ${quizId}
      ORDER BY ert.submitted_at DESC
      LIMIT 1
    `;
    return result[0] || null;
  } catch (error) {
    console.error('Error fetching transmission by quiz:', error);
    return null;
  }
}

export async function updateExamTransmissionStatus(
  id: string,
  status: 'under_review' | 'verified' | 'revision_requested',
  reviewerId: string,
  reviewNotes?: string
) {
  const result = await sql`
    UPDATE exam_results_transmissions
    SET 
      status = ${status},
      reviewer_id = ${reviewerId},
      review_notes = ${reviewNotes || null},
      reviewed_at = now(),
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0];
}
