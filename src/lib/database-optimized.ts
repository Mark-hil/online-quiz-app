import { neon } from '@neondatabase/serverless';

const neonUrl = import.meta.env.VITE_NEON_DATABASE_URL;

if (!neonUrl) {
  throw new Error('Missing Neon database URL. Please set VITE_NEON_DATABASE_URL in your .env file');
}

export const sql = neon(neonUrl!, {
  fetchOptions: {
    retries: 5,
    retryDelay: 2000,
    timeout: 30000
  }
});

// Optimized database functions with caching and performance improvements
class OptimizedDatabase {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCachedData(key: string, data: any, ttl: number = this.CACHE_TTL): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }

  // Batch operations for better performance
  async getBatchQuizAttempts(attemptIds: string[]) {
    if (attemptIds.length === 0) return [];
    
    const cacheKey = `batch_attempts_${attemptIds.join(',')}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const result = await sql`
      SELECT 
        qa.id,
        qa.quiz_id,
        qa.student_id,
        qa.started_at,
        qa.deadline,
        qa.duration_minutes,
        qa.status,
        qa.last_activity,
        qa.time_remaining,
        qa.original_duration,
        qa.extensions_applied,
        p.name as student_name,
        p.email as student_email,
        q.title as quiz_title
      FROM quiz_attempts qa
      JOIN profiles p ON qa.student_id = p.id
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.id = ANY(${attemptIds})
      ORDER BY qa.last_activity DESC
    `;

    this.setCachedData(cacheKey, result);
    return result;
  }

  // Optimized quiz attempts with pagination
  async getQuizAttemptsPaginated(
    status: string[] = ['in_progress', 'expired'],
    limit: number = 50,
    offset: number = 0
  ) {
    const cacheKey = `quiz_attempts_${status.join('_')}_${limit}_${offset}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const result = await sql`
      SELECT 
        qa.id,
        qa.quiz_id,
        qa.student_id,
        qa.started_at,
        qa.deadline,
        qa.duration_minutes,
        qa.status,
        qa.last_activity,
        qa.time_remaining,
        qa.original_duration,
        qa.extensions_applied,
        p.name as student_name,
        p.email as student_email,
        q.title as quiz_title
      FROM quiz_attempts qa
      JOIN profiles p ON qa.student_id = p.id
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.status = ANY(${status})
      ORDER BY qa.last_activity DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    this.setCachedData(cacheKey, result, 30000); // 30 seconds cache for real-time data
    return result;
  }

  // Optimized extension requests with pagination
  async getExtensionRequestsPaginated(
    status?: string,
    limit: number = 50,
    offset: number = 0
  ) {
    const cacheKey = `extension_requests_${status || 'all'}_${limit}_${offset}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    let result;
    if (status && status !== 'all') {
      result = await sql`
        SELECT 
          er.*,
          p.name as requested_by_name,
          qa.quiz_id,
          q.title as quiz_title,
          p2.name as student_name
        FROM extension_requests er
        JOIN profiles p ON er.requested_by = p.id
        JOIN quiz_attempts qa ON er.attempt_id = qa.id
        JOIN quizzes q ON qa.quiz_id = q.id
        JOIN profiles p2 ON qa.student_id = p2.id
        WHERE er.status = ${status}
        ORDER BY er.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      result = await sql`
        SELECT 
          er.*,
          p.name as requested_by_name,
          qa.quiz_id,
          q.title as quiz_title,
          p2.name as student_name
        FROM extension_requests er
        JOIN profiles p ON er.requested_by = p.id
        JOIN quiz_attempts qa ON er.attempt_id = qa.id
        JOIN quizzes q ON qa.quiz_id = q.id
        JOIN profiles p2 ON qa.student_id = p2.id
        ORDER BY er.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    this.setCachedData(cacheKey, result, 60000); // 1 minute cache
    return result;
  }

  // Optimized user search with indexing
  async searchUsers(query: string, role?: string, limit: number = 100) {
    const cacheKey = `search_users_${query}_${role || 'all'}_${limit}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    let result;
    const searchPattern = `%${query}%`;
    
    if (role && role !== 'all') {
      result = await sql`
        SELECT id, name, email, index_number, role, created_at
        FROM profiles
        WHERE (name ILIKE ${searchPattern} OR email ILIKE ${searchPattern}) AND role = ${role}
        ORDER BY name LIMIT ${limit}
      `;
    } else {
      result = await sql`
        SELECT id, name, email, index_number, role, created_at
        FROM profiles
        WHERE name ILIKE ${searchPattern} OR email ILIKE ${searchPattern}
        ORDER BY name LIMIT ${limit}
      `;
    }

    this.setCachedData(cacheKey, result, 120000); // 2 minutes cache
    return result;
  }

  // Get statistics with caching
  async getSystemStatistics() {
    const cacheKey = 'system_statistics';
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const result = await sql`
      SELECT 
        (SELECT COUNT(*) FROM profiles WHERE role = 'student') as total_students,
        (SELECT COUNT(*) FROM profiles WHERE role = 'lecturer') as total_lecturers,
        (SELECT COUNT(*) FROM profiles WHERE role = 'moderator') as total_moderators,
        (SELECT COUNT(*) FROM profiles WHERE role = 'admin') as total_admins,
        (SELECT COUNT(*) FROM profiles WHERE role = 'super_admin') as total_super_admins,
        (SELECT COUNT(*) FROM quizzes) as total_quizzes,
        (SELECT COUNT(*) FROM quizzes WHERE status = 'published') as published_quizzes,
        (SELECT COUNT(*) FROM quiz_attempts WHERE status = 'in_progress') as active_attempts,
        (SELECT COUNT(*) FROM quiz_attempts WHERE status = 'expired') as expired_attempts,
        (SELECT COUNT(*) FROM extension_requests WHERE status = 'pending') as pending_extensions
    `;

    this.setCachedData(cacheKey, result[0], 60000); // 1 minute cache
    return result[0];
  }

  // Clear cache for specific keys
  clearCache(pattern?: string) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  // Monitor cache performance
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      hitRate: this.cache.size > 0 ? 'Available' : 'Empty'
    };
  }
}

export const optimizedDb = new OptimizedDatabase();
