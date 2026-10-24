import { sql } from '../db.js';

export async function getProfile(id: string) {
  try {
    const result = await sql`
      SELECT id, email, name, index_number, role, created_at, updated_at 
      FROM profiles 
      WHERE id = ${id}
    `;
    return result[0] || null;
  } catch (error) {
    console.error('Error in getProfile:', error);
    return null;
  }
}

export async function getProfiles() {
  return await sql`
    SELECT id, email, name, index_number, role, created_at, updated_at 
    FROM profiles 
    ORDER BY created_at DESC
  `;
}

export async function getProfilesByIds(ids: string[]) {
  if (!ids || ids.length === 0) return [];
  try {
    const all = await getProfiles();
    const idSet = new Set(ids);
    return all.filter((p: any) => idSet.has(p.id));
  } catch (error) {
    console.error('Error in getProfilesByIds:', error);
    return [];
  }
}

export async function createProfile(id: string, name: string, role: 'lecturer' | 'student') {
  const result = await sql`
    INSERT INTO profiles (id, name, role)
    VALUES (${id}, ${name}, ${role})
    RETURNING id, name, role, email, created_at
  `;
  return result[0];
}

export async function getUsersByRole(role: string) {
  return await sql`
    SELECT id, name, email, index_number, role, created_at
    FROM profiles
    WHERE role = ${role}
    ORDER BY created_at DESC
  `;
}

export async function getAllUsers() {
  return await sql`
    SELECT id, name, email, index_number, role, created_at
    FROM profiles
    ORDER BY created_at DESC
    LIMIT 1000
  `;
}

export async function updateUserRole(
  userId: string,
  newRole: 'lecturer' | 'student' | 'moderator' | 'admin' | 'super_admin'
) {
  return await sql`
    UPDATE profiles
    SET role = ${newRole}, updated_at = NOW()
    WHERE id = ${userId}
    RETURNING id, name, email, role
  `;
}

export async function deleteUser(userId: string) {
  return await sql`
    DELETE FROM profiles
    WHERE id = ${userId}
    RETURNING id
  `;
}
