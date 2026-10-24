import { sql } from '../../db.js';
import { jsonHandler } from '../../http.js';
import type { ApiRequest, ApiResponse } from '../../types.js';

export default jsonHandler(async (_req: ApiRequest, _res: ApiResponse) => {
  const result = await sql`
    SELECT COUNT(*)::int as count 
    FROM profiles 
    WHERE role = 'super_admin'
  `;
  const count = Number(result[0]?.count || 0);
  return { available: count === 0 };
});
