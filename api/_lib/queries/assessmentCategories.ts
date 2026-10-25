import { sql } from '../db.js';

export interface AssessmentCategoryRecord {
  id: string;
  course_id: string;
  name: string;
  prefix: string;
  color: string;
  description: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export async function getAssessmentCategories(courseId: string) {
  try {
    const rows = await sql`
      SELECT 
        id, 
        course_id, 
        name, 
        prefix, 
        color, 
        description, 
        created_by, 
        created_at, 
        updated_at
      FROM assessment_categories
      WHERE course_id = ${courseId}
      ORDER BY created_at ASC
    `;
    return rows;
  } catch (error) {
    console.error('Error in getAssessmentCategories:', error);
    return [];
  }
}

export async function createAssessmentCategory(data: {
  course_id: string;
  name: string;
  prefix: string;
  color?: string;
  description?: string;
  created_by?: string;
}) {
  const name = data.name.trim();
  const rawPrefix = data.prefix.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().trim();
  const prefix = rawPrefix || 'CAT';
  const color = data.color?.trim() || 'blue';
  const description = data.description?.trim() || '';

  const result = await sql`
    INSERT INTO assessment_categories (
      course_id, name, prefix, color, description, created_by, updated_at
    )
    VALUES (
      ${data.course_id}, ${name}, ${prefix}, ${color}, ${description}, ${data.created_by || null}, now()
    )
    ON CONFLICT (course_id, prefix) DO UPDATE SET
      name = EXCLUDED.name,
      color = EXCLUDED.color,
      description = EXCLUDED.description,
      updated_at = now()
    RETURNING *
  `;
  return result[0];
}

export async function updateAssessmentCategory(id: string, updates: Partial<{
  name: string;
  prefix: string;
  color: string;
  description: string;
}>) {
  const fields: string[] = ['updated_at = now()'];
  const values: any[] = [id];

  if (updates.name !== undefined) {
    fields.push(`name = $${values.length + 1}`);
    values.push(updates.name.trim());
  }
  if (updates.prefix !== undefined) {
    const raw = updates.prefix.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().trim();
    fields.push(`prefix = $${values.length + 1}`);
    values.push(raw || 'CAT');
  }
  if (updates.color !== undefined) {
    fields.push(`color = $${values.length + 1}`);
    values.push(updates.color.trim());
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${values.length + 1}`);
    values.push(updates.description.trim());
  }

  const query = `UPDATE assessment_categories SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
  const result = await sql(query, values);
  return result[0];
}

export async function deleteAssessmentCategory(id: string) {
  try {
    const result = await sql`DELETE FROM assessment_categories WHERE id = ${id} RETURNING id, course_id, prefix`;
    return result[0] || null;
  } catch (error) {
    console.error('Error in deleteAssessmentCategory:', error);
    throw error;
  }
}
