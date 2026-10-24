import { sql } from '../db.js';

export async function getUserActivityStats(days: number = 30) {
  return await sql`
    SELECT
      DATE(created_at)::text as date,
      COUNT(DISTINCT user_id) as active_users,
      COUNT(*) as total_actions
    FROM audit_logs
    WHERE created_at >= NOW() - (${days} * INTERVAL '1 day')
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `;
}

export async function getQuizStats() {
  return await sql`
    SELECT
      COUNT(*) as total_quizzes,
      COUNT(CASE WHEN status = 'published' THEN 1 END) as published_quizzes,
      COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_quizzes,
      COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived_quizzes
    FROM quizzes
  `;
}

export async function getQuizAttemptStats(days: number = 30) {
  return await sql`
    SELECT
      DATE(started_at)::text as date,
      COUNT(*) as total_attempts,
      COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted,
      COUNT(CASE WHEN status = 'graded' THEN 1 END) as graded,
      AVG(score) as avg_score
    FROM quiz_attempts
    WHERE started_at >= NOW() - (${days} * INTERVAL '1 day')
    GROUP BY DATE(started_at)
    ORDER BY date DESC
  `;
}

export async function getExecutiveAcademicStats() {
  try {
    const [benchmarks, distribution] = await Promise.all([
      sql`
        SELECT 
          q.id as quiz_id,
          q.title,
          q.subject,
          COUNT(qa.id) as total_attempts,
          COUNT(CASE WHEN qa.status IN ('submitted', 'graded') THEN 1 END) as completed_attempts,
          ROUND(AVG(CASE WHEN qa.score IS NOT NULL THEN qa.score END)::numeric, 1) as avg_score,
          COUNT(CASE WHEN qa.score >= 50 THEN 1 END) as pass_count,
          COUNT(CASE WHEN qa.score < 50 AND qa.score IS NOT NULL THEN 1 END) as fail_count,
          MAX(qa.score) as highest_score,
          MIN(qa.score) as lowest_score
        FROM quizzes q
        LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id
        GROUP BY q.id, q.title, q.subject
        ORDER BY total_attempts DESC
        LIMIT 50
      `,
      sql`
        SELECT
          COUNT(CASE WHEN score >= 80 THEN 1 END) as grade_a,
          COUNT(CASE WHEN score >= 70 AND score < 80 THEN 1 END) as grade_b,
          COUNT(CASE WHEN score >= 60 AND score < 70 THEN 1 END) as grade_c,
          COUNT(CASE WHEN score >= 50 AND score < 60 THEN 1 END) as grade_d,
          COUNT(CASE WHEN score < 50 AND score IS NOT NULL THEN 1 END) as grade_f,
          COUNT(CASE WHEN score IS NOT NULL THEN 1 END) as total_graded
        FROM quiz_attempts
        WHERE score IS NOT NULL
      `
    ]);

    const dist = (distribution && distribution[0]) ? (distribution[0] as any) : {};
    const totalGraded = Number(dist.total_graded || 0);
    const gradeTiers = [
      { grade: 'A (80-100%)', count: Number(dist.grade_a || 0), color: '#10b981' },
      { grade: 'B (70-79%)', count: Number(dist.grade_b || 0), color: '#3b82f6' },
      { grade: 'C (60-69%)', count: Number(dist.grade_c || 0), color: '#8b5cf6' },
      { grade: 'D (50-59%)', count: Number(dist.grade_d || 0), color: '#f59e0b' },
      { grade: 'F (<50%)', count: Number(dist.grade_f || 0), color: '#ef4444' },
    ];

    const passCount =
      Number(dist.grade_a || 0) +
      Number(dist.grade_b || 0) +
      Number(dist.grade_c || 0) +
      Number(dist.grade_d || 0);
    const failCount = Number(dist.grade_f || 0);

    return {
      benchmarks: benchmarks || [],
      gradeTiers,
      totalGraded,
      passCount,
      failCount,
      passRate: totalGraded > 0 ? Math.round((passCount / totalGraded) * 100) : 0,
    };
  } catch (err) {
    console.error('Error fetching executive academic stats:', err);
    return {
      benchmarks: [],
      gradeTiers: [
        { grade: 'A (80-100%)', count: 0, color: '#10b981' },
        { grade: 'B (70-79%)', count: 0, color: '#3b82f6' },
        { grade: 'C (60-69%)', count: 0, color: '#8b5cf6' },
        { grade: 'D (50-59%)', count: 0, color: '#f59e0b' },
        { grade: 'F (<50%)', count: 0, color: '#ef4444' },
      ],
      totalGraded: 0,
      passCount: 0,
      failCount: 0,
      passRate: 0,
    };
  }
}

export async function getExecutiveItemDiagnostics() {
  try {
    const [itemFailureRates, completionOutliers] = await Promise.all([
      sql`
        SELECT
          q.id as question_id,
          q.question_text,
          q.question_type,
          qz.title as quiz_title,
          qz.subject,
          COUNT(sa.id) as total_responses,
          COUNT(CASE WHEN sa.is_correct = true THEN 1 END) as correct_count,
          COUNT(CASE WHEN sa.is_correct = false THEN 1 END) as incorrect_count,
          ROUND((COUNT(CASE WHEN sa.is_correct = false THEN 1 END)::numeric / NULLIF(COUNT(sa.id), 0) * 100), 1) as failure_rate,
          ROUND((COUNT(CASE WHEN sa.is_correct = true THEN 1 END)::numeric / NULLIF(COUNT(sa.id), 0) * 100), 1) as success_rate
        FROM questions q
        JOIN quizzes qz ON q.quiz_id = qz.id
        LEFT JOIN student_answers sa ON q.id = sa.question_id
        GROUP BY q.id, q.question_text, q.question_type, qz.title, qz.subject
        HAVING COUNT(sa.id) > 0
        ORDER BY failure_rate DESC
        LIMIT 25
      `,
      sql`
        SELECT
          qa.id as attempt_id,
          p.name as student_name,
          p.email as student_email,
          q.title as quiz_title,
          q.duration_minutes as allowed_duration,
          ROUND((EXTRACT(EPOCH FROM (qa.submitted_at - qa.started_at))/60)::numeric, 1) as time_spent_minutes,
          qa.score,
          qa.started_at::text,
          qa.submitted_at::text
        FROM quiz_attempts qa
        JOIN profiles p ON qa.student_id = p.id
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE qa.submitted_at IS NOT NULL AND qa.started_at IS NOT NULL
        ORDER BY qa.submitted_at DESC
        LIMIT 25
      `
    ]);

    return {
      itemFailureRates: itemFailureRates || [],
      completionOutliers: completionOutliers || [],
    };
  } catch (err) {
    console.error('Error fetching executive item diagnostics:', err);
    return { itemFailureRates: [], completionOutliers: [] };
  }
}

export async function getExecutiveSecurityStats() {
  try {
    const [violations, failedLogins, extensionReqs, summary] = await Promise.all([
      sql`
        SELECT
          qa.id as attempt_id,
          p.name as student_name,
          p.email as student_email,
          q.title as quiz_title,
          COALESCE(qa.tab_switch_count, 0) as tab_switch_count,
          COALESCE(qa.copy_attempts, 0) as copy_attempts,
          COALESCE(qa.right_click_count, 0) as right_click_count,
          qa.cheated,
          qa.cheating_reason,
          qa.started_at::text,
          qa.score
        FROM quiz_attempts qa
        JOIN profiles p ON qa.student_id = p.id
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE (qa.tab_switch_count > 0 OR qa.copy_attempts > 0 OR qa.right_click_count > 0 OR qa.cheated = true)
        ORDER BY (COALESCE(qa.tab_switch_count, 0) + COALESCE(qa.copy_attempts, 0) + COALESCE(qa.right_click_count, 0)) DESC, qa.started_at DESC
        LIMIT 30
      `,
      sql`
        SELECT id, email, ip_address, error_message, created_at::text
        FROM login_attempts
        WHERE success = false
        ORDER BY created_at DESC
        LIMIT 30
      `,
      sql`
        SELECT 
          er.id,
          er.extension_minutes,
          er.reason,
          er.status,
          er.created_at::text,
          p.name as student_name,
          q.title as quiz_title
        FROM extension_requests er
        JOIN quiz_attempts qa ON er.attempt_id = qa.id
        JOIN profiles p ON qa.student_id = p.id
        JOIN quizzes q ON qa.quiz_id = q.id
        ORDER BY er.created_at DESC
        LIMIT 20
      `,
      sql`
        SELECT
          COALESCE(SUM(tab_switch_count), 0) as total_tab_switches,
          COALESCE(SUM(copy_attempts), 0) as total_copy_attempts,
          COALESCE(SUM(right_click_count), 0) as total_right_clicks,
          COUNT(CASE WHEN cheated = true THEN 1 END) as total_flagged_cheated
        FROM quiz_attempts
      `
    ]);

    const sum = (summary && summary[0]) ? (summary[0] as any) : {};

    return {
      violations: violations || [],
      failedLogins: failedLogins || [],
      extensionRequests: extensionReqs || [],
      totalTabSwitches: Number(sum.total_tab_switches || 0),
      totalCopyAttempts: Number(sum.total_copy_attempts || 0),
      totalRightClicks: Number(sum.total_right_clicks || 0),
      totalFlaggedCheated: Number(sum.total_flagged_cheated || 0),
    };
  } catch (err) {
    console.error('Error fetching executive security stats:', err);
    return {
      violations: [],
      failedLogins: [],
      extensionRequests: [],
      totalTabSwitches: 0,
      totalCopyAttempts: 0,
      totalRightClicks: 0,
      totalFlaggedCheated: 0,
    };
  }
}

export async function getExecutiveCohortStats() {
  try {
    const studentMetrics = await sql`
      SELECT
        p.id as student_id,
        p.name as student_name,
        p.email as student_email,
        p.index_number,
        COUNT(qa.id) as attempts_count,
        ROUND(AVG(qa.score)::numeric, 1) as avg_score,
        COUNT(CASE WHEN qa.score < 50 AND qa.score IS NOT NULL THEN 1 END) as failed_attempts,
        COUNT(CASE WHEN qa.score >= 80 THEN 1 END) as high_scores,
        MAX(qa.started_at)::text as last_attempt_date
      FROM profiles p
      JOIN quiz_attempts qa ON p.id = qa.student_id
      WHERE p.role = 'student' AND qa.score IS NOT NULL
      GROUP BY p.id, p.name, p.email, p.index_number
      HAVING COUNT(qa.id) > 0
      ORDER BY avg_score ASC
    `;

    const list = (studentMetrics as any[]) || [];
    const atRisk = list.filter((s: any) => parseFloat(s.avg_score || '0') < 50 || parseInt(s.failed_attempts || '0', 10) >= 2);
    const honorRoll = list.filter((s: any) => parseFloat(s.avg_score || '0') >= 80).sort((a: any, b: any) => parseFloat(b.avg_score) - parseFloat(a.avg_score));

    return {
      allStudents: list,
      atRisk,
      honorRoll,
      totalEvaluated: list.length,
      atRiskCount: atRisk.length,
      honorRollCount: honorRoll.length,
    };
  } catch (err) {
    console.error('Error fetching executive cohort stats:', err);
    return {
      allStudents: [],
      atRisk: [],
      honorRoll: [],
      totalEvaluated: 0,
      atRiskCount: 0,
      honorRollCount: 0,
    };
  }
}

export async function getSystemDataStats() {
  try {
    const [
      totalAttemptsRes,
      totalAnswersRes,
      totalTransmissionsRes,
      totalQuizzesRes,
      publishedQuizzesRes,
      archivedQuizzesRes,
      draftQuizzesRes,
      studentsRes,
    ] = await Promise.all([
      sql`SELECT COUNT(*)::int as count FROM quiz_attempts`,
      sql`SELECT COUNT(*)::int as count FROM student_answers`,
      sql`SELECT COUNT(*)::int as count FROM exam_results_transmissions`,
      sql`SELECT COUNT(*)::int as count FROM quizzes`,
      sql`SELECT COUNT(*)::int as count FROM quizzes WHERE status = 'published'`,
      sql`SELECT COUNT(*)::int as count FROM quizzes WHERE status = 'archived'`,
      sql`SELECT COUNT(*)::int as count FROM quizzes WHERE status = 'draft'`,
      sql`SELECT COUNT(*)::int as count FROM profiles WHERE role = 'student'`,
    ]);

    return {
      totalAttempts: (totalAttemptsRes[0] as any)?.count || 0,
      totalAnswers: (totalAnswersRes[0] as any)?.count || 0,
      totalTransmissions: (totalTransmissionsRes[0] as any)?.count || 0,
      totalQuizzes: (totalQuizzesRes[0] as any)?.count || 0,
      publishedQuizzes: (publishedQuizzesRes[0] as any)?.count || 0,
      archivedQuizzes: (archivedQuizzesRes[0] as any)?.count || 0,
      draftQuizzes: (draftQuizzesRes[0] as any)?.count || 0,
      totalStudents: (studentsRes[0] as any)?.count || 0,
    };
  } catch (error) {
    console.error('Error getting system data stats:', error);
    return {
      totalAttempts: 0,
      totalAnswers: 0,
      totalTransmissions: 0,
      totalQuizzes: 0,
      publishedQuizzes: 0,
      archivedQuizzes: 0,
      draftQuizzes: 0,
      totalStudents: 0,
    };
  }
}

export async function purgeTestData(options: {
  purgeAttempts: boolean;
  purgeTransmissions: boolean;
  resetQuizzesToDraft: boolean;
  deleteStudentAccounts: boolean;
  performedByUserId: string;
}) {
  try {
    const report: Record<string, any> = {};

    if (options.purgeAttempts) {
      const answersDeleted = await sql`DELETE FROM student_answers RETURNING id`;
      const attemptsDeleted = await sql`DELETE FROM quiz_attempts RETURNING id`;
      report.answersDeleted = (answersDeleted as any[]).length;
      report.attemptsDeleted = (attemptsDeleted as any[]).length;
    }

    if (options.purgeTransmissions) {
      const transDeleted = await sql`DELETE FROM exam_results_transmissions RETURNING id`;
      report.transmissionsDeleted = (transDeleted as any[]).length;
    }

    if (options.resetQuizzesToDraft) {
      const quizzesReset = await sql`
        UPDATE quizzes 
        SET status = 'draft', updated_at = now() 
        WHERE status IN ('published', 'approved', 'archived')
        RETURNING id
      `;
      report.quizzesResetToDraft = (quizzesReset as any[]).length;
    }

    if (options.deleteStudentAccounts) {
      const studentsDeleted = await sql`
        DELETE FROM profiles 
        WHERE role = 'student' 
        RETURNING id
      `;
      report.studentsDeleted = (studentsDeleted as any[]).length;
    }

    // Create permanent audit log entry of this maintenance event
    await sql`
      INSERT INTO audit_logs (
        user_id, action, entity_type, details, created_at
      ) VALUES (
        ${options.performedByUserId},
        'SYSTEM_TEST_DATA_PURGED',
        'system',
        ${JSON.stringify({
          timestamp: new Date().toISOString(),
          options,
          report,
        })},
        now()
      )
    `;

    return report;
  } catch (error) {
    console.error('Error purging test data:', error);
    throw error;
  }
}
