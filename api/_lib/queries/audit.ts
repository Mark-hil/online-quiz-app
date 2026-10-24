import { sql } from '../db.js';

export async function createAuditLog(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: any,
  ipAddress?: string,
  userAgent?: string
) {
  return await sql`
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
    VALUES (${userId}, ${action}, ${entityType}, ${entityId}, ${JSON.stringify(details)}, ${ipAddress || null}, ${userAgent || null})
    RETURNING id
  `;
}

export async function getAuditLogs(limit: number = 100, offset: number = 0) {
  return await sql`
    SELECT al.*, p.name, p.email, p.role
    FROM audit_logs al
    LEFT JOIN profiles p ON al.user_id = p.id
    ORDER BY al.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function getLoginAttempts(limit: number = 100, offset: number = 0) {
  return await sql`
    SELECT * FROM login_attempts
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function getFailedLoginAttempts(limit: number = 50) {
  return await sql`
    SELECT * FROM login_attempts
    WHERE success = false
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

export async function getSystemSetting(key: string) {
  const result = await sql`
    SELECT setting_value FROM system_settings
    WHERE setting_key = ${key}
  `;
  return result[0]?.setting_value || null;
}

export async function setSystemSetting(key: string, value: any, description?: string, updatedBy?: string) {
  return await sql`
    INSERT INTO system_settings (setting_key, setting_value, description, updated_by)
    VALUES (${key}, ${JSON.stringify(value)}, ${description || null}, ${updatedBy || null})
    ON CONFLICT (setting_key)
    DO UPDATE SET
      setting_value = ${JSON.stringify(value)},
      description = ${description || null},
      updated_by = ${updatedBy || null},
      updated_at = now()
    RETURNING id
  `;
}

export async function getAllSystemSettings() {
  return await sql`
    SELECT ss.*, p.name as updated_by_name
    FROM system_settings ss
    LEFT JOIN profiles p ON ss.updated_by = p.id
    ORDER BY ss.setting_key
  `;
}

export async function recordHealthMetric(metricName: string, metricValue: string, status: string) {
  return await sql`
    INSERT INTO system_health (metric_name, metric_value, status)
    VALUES (${metricName}, ${metricValue}, ${status})
    RETURNING id
  `;
}

export async function getRecentHealthMetrics(metricName?: string, limit: number = 50) {
  if (metricName) {
    return await sql`
      SELECT * FROM system_health
      WHERE metric_name = ${metricName}
      ORDER BY checked_at DESC
      LIMIT ${limit}
    `;
  }
  return await sql`
    SELECT * FROM system_health
    ORDER BY checked_at DESC
    LIMIT ${limit}
  `;
}
