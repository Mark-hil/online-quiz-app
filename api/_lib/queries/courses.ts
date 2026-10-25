import { sql } from '../db.js';

export async function getCourses(lecturerId?: string) {
  try {
    const courses = await sql`
      SELECT 
        c.*,
        p.name as assigned_lecturer_name,
        p.email as assigned_lecturer_email,
        COUNT(DISTINCT qb.id) FILTER (WHERE qb.status = 'active') as active_question_count,
        COUNT(DISTINCT qb.id) as question_count,
        COUNT(DISTINCT qz.id) as quiz_count
      FROM courses c
      LEFT JOIN profiles p ON c.assigned_lecturer_id = p.id
      LEFT JOIN question_bank qb ON c.id = qb.course_id
      LEFT JOIN quizzes qz ON c.id = qz.course_id
      GROUP BY c.id, p.name, p.email
      ORDER BY c.code ASC
    `;

    if (!lecturerId) {
      return courses;
    }

    let isAdmin = false;
    const userRes = await sql`SELECT role FROM profiles WHERE id = ${lecturerId}`;
    isAdmin = userRes[0]?.role === 'admin' || userRes[0]?.role === 'super_admin';

    const approvedRequests = await sql`
      SELECT course_id, access_level, expires_at 
      FROM question_bank_access_requests
      WHERE requester_id = ${lecturerId}
        AND status = 'approved'
        AND (expires_at IS NULL OR expires_at > now())
    `;
    const approvedCourseMap = new Map();
    approvedRequests.forEach((r: any) => {
      approvedCourseMap.set(r.course_id, r);
    });

    return courses.map((course: any) => {
      const isUnassigned = !course.assigned_lecturer_id;
      const isAssigned = course.assigned_lecturer_id === lecturerId;
      const activeDelegation = approvedCourseMap.get(course.id);
      const hasAccess = isAdmin || isAssigned || !!activeDelegation;
      const accessLevel = isAdmin
        ? 'admin'
        : isAssigned
          ? 'owner'
          : activeDelegation
            ? activeDelegation.access_level
            : null;

      return {
        ...course,
        isUnassigned,
        hasAccess,
        accessLevel,
        delegationExpiresAt: activeDelegation ? activeDelegation.expires_at : null,
      };
    });
  } catch (error) {
    console.error('Error in getCourses:', error);
    return [];
  }
}

export async function getCourse(id: string) {
  try {
    const result = await sql`
      SELECT 
        c.*,
        p.name as assigned_lecturer_name,
        p.email as assigned_lecturer_email
      FROM courses c
      LEFT JOIN profiles p ON c.assigned_lecturer_id = p.id
      WHERE c.id = ${id}
    `;
    return result[0] || null;
  } catch (error) {
    console.error('Error in getCourse:', error);
    return null;
  }
}

export async function createCourse(course: {
  code: string;
  title: string;
  department?: string;
  assigned_lecturer_id?: string | null;
}) {
  const result = await sql`
    INSERT INTO courses (code, title, department, assigned_lecturer_id, updated_at)
    VALUES (
      ${course.code.trim().toUpperCase()},
      ${course.title.trim()},
      ${course.department || ''},
      ${course.assigned_lecturer_id || null},
      now()
    )
    RETURNING *
  `;
  return result[0];
}

export async function updateCourse(id: string, updates: any) {
  const fields: string[] = ['updated_at = now()'];
  const values: any[] = [id];

  if (updates.code !== undefined) {
    fields.push(`code = $${values.length + 1}`);
    values.push(updates.code.trim().toUpperCase());
  }
  if (updates.title !== undefined) {
    fields.push(`title = $${values.length + 1}`);
    values.push(updates.title.trim());
  }
  if (updates.department !== undefined) {
    fields.push(`department = $${values.length + 1}`);
    values.push(updates.department);
  }
  if (updates.assigned_lecturer_id !== undefined) {
    fields.push(`assigned_lecturer_id = $${values.length + 1}`);
    values.push(updates.assigned_lecturer_id);
  }

  const query = `UPDATE courses SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
  const result = await sql(query, values);
  return result[0];
}

export async function assignCourseLecturer(courseId: string, lecturerId: string | null) {
  const result = await sql`
    UPDATE courses 
    SET assigned_lecturer_id = ${lecturerId}, updated_at = now()
    WHERE id = ${courseId}
    RETURNING *
  `;
  return result[0];
}

export async function checkUserCourseAccess(courseId: string, userId: string) {
  try {
    const userRes = await sql`SELECT role FROM profiles WHERE id = ${userId}`;
    const role = userRes[0]?.role;
    if (role === 'admin' || role === 'super_admin') {
      return { hasAccess: true, accessLevel: 'owner', isExempt: true };
    }

    const courseRes = await sql`SELECT assigned_lecturer_id FROM courses WHERE id = ${courseId}`;
    if (courseRes[0]?.assigned_lecturer_id === userId) {
      return { hasAccess: true, accessLevel: 'owner', isAssigned: true };
    }

    const requestRes = await sql`
      SELECT * FROM question_bank_access_requests
      WHERE course_id = ${courseId}
        AND requester_id = ${userId}
        AND status = 'approved'
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (requestRes.length > 0) {
      return {
        hasAccess: true,
        accessLevel: requestRes[0].access_level,
        isDelegated: true,
        expiresAt: requestRes[0].expires_at,
      };
    }

    return { hasAccess: false, accessLevel: null };
  } catch (error) {
    console.error('Error in checkUserCourseAccess:', error);
    return { hasAccess: false, accessLevel: null };
  }
}

export async function deleteCourse(id: string) {
  try {
    const qCount = await sql`SELECT count(*)::int as count FROM question_bank WHERE course_id = ${id}`;
    const quizCount = await sql`SELECT count(*)::int as count FROM quizzes WHERE course_id = ${id}`;
    
    const questions = qCount[0]?.count || 0;
    const quizzes = quizCount[0]?.count || 0;

    if (questions > 0 || quizzes > 0) {
      throw new Error(`Cannot delete course: it contains ${questions} questions and ${quizzes} quizzes. Archive or reassign these items first.`);
    }

    const result = await sql`DELETE FROM courses WHERE id = ${id} RETURNING *`;
    return result[0] || null;
  } catch (error: any) {
    console.error('Error in deleteCourse:', error);
    throw error;
  }
}

export async function bulkInsertCourses(coursesList: Array<{
  code: string;
  title: string;
  department?: string;
  assigned_lecturer_email?: string;
  assigned_lecturer_id?: string | null;
}>) {
  if (!Array.isArray(coursesList) || coursesList.length === 0) {
    return { inserted: 0, updated: 0, errors: [] };
  }

  const errors: string[] = [];
  let inserted = 0;
  let updated = 0;

  for (const item of coursesList) {
    if (!item.code || !item.title) {
      errors.push(`Skipped row missing code or title`);
      continue;
    }

    const code = item.code.trim().toUpperCase();
    const title = item.title.trim();
    const department = item.department ? item.department.trim() : '';
    let lecturerId: string | null = item.assigned_lecturer_id || null;

    if (!lecturerId && item.assigned_lecturer_email) {
      try {
        const profRes = await sql`
          SELECT id FROM profiles 
          WHERE LOWER(email) = LOWER(${item.assigned_lecturer_email.trim()})
          LIMIT 1
        `;
        if (profRes.length > 0) {
          lecturerId = profRes[0].id;
        }
      } catch (err) {
        // Continue without assigned lecturer
      }
    }

    try {
      const existing = await sql`SELECT id FROM courses WHERE code = ${code}`;
      if (existing.length > 0) {
        await sql`
          UPDATE courses 
          SET title = ${title},
              department = ${department},
              assigned_lecturer_id = COALESCE(${lecturerId}, assigned_lecturer_id),
              updated_at = now()
          WHERE id = ${existing[0].id}
        `;
        updated++;
      } else {
        await sql`
          INSERT INTO courses (code, title, department, assigned_lecturer_id, updated_at)
          VALUES (${code}, ${title}, ${department}, ${lecturerId}, now())
        `;
        inserted++;
      }
    } catch (err: any) {
      errors.push(`Error saving course ${code}: ${err.message || String(err)}`);
    }
  }

  return { inserted, updated, errors };
}
