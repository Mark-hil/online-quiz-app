import { neon } from '@neondatabase/serverless';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Helper to load .env if running standalone
function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadLocalEnv();

const dbUrl = process.env.DATABASE_URL || process.env.VITE_NEON_DATABASE_URL;

if (!dbUrl) {
  console.error('Error: DATABASE_URL (or VITE_NEON_DATABASE_URL) must be set to run migrations.');
  process.exit(1);
}

const sql = neon(dbUrl);

async function runMigrations() {
  console.log('--- Starting Server-Side Database Migrations ---');

  // 1. UUID extension
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  console.log('✓ uuid-ossp extension enabled');

  // 2. Profiles table
  await sql`
    CREATE TABLE IF NOT EXISTS profiles (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      email text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      name text NOT NULL,
      index_number text UNIQUE,
      role text NOT NULL CHECK (role IN ('lecturer', 'student', 'moderator', 'admin', 'super_admin')),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `;
  console.log('✓ profiles table verified');

  // 3. Add password_algo column for seamless bcrypt migration
  await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_algo text DEFAULT 'legacy_sha256'`;
  console.log('✓ profiles.password_algo column verified');

  // 4. Rate limits table for brute-force protection
  await sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key VARCHAR(255) PRIMARY KEY,
      attempts INT DEFAULT 1,
      reset_at TIMESTAMPTZ NOT NULL
    )
  `;
  console.log('✓ rate_limits table verified');

  // 5. Audit logs table
  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id uuid REFERENCES profiles(id),
      action text NOT NULL,
      entity_type text,
      entity_id text,
      details jsonb,
      ip_address text,
      user_agent text,
      created_at timestamptz DEFAULT now()
    )
  `;
  console.log('✓ audit_logs table verified');

  // 6. Login attempts table
  await sql`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      email text NOT NULL,
      success boolean NOT NULL,
      ip_address text,
      user_agent text,
      error_message text,
      created_at timestamptz DEFAULT now()
    )
  `;
  console.log('✓ login_attempts table verified');

  // 7. System settings table
  await sql`
    CREATE TABLE IF NOT EXISTS system_settings (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      setting_key text UNIQUE NOT NULL,
      setting_value jsonb NOT NULL,
      description text,
      updated_by uuid REFERENCES profiles(id),
      updated_at timestamptz DEFAULT now()
    )
  `;
  console.log('✓ system_settings table verified');

  // 8. Extension requests table
  await sql`
    CREATE TABLE IF NOT EXISTS extension_requests (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      attempt_id uuid NOT NULL,
      requested_by uuid NOT NULL REFERENCES profiles(id),
      extension_minutes integer NOT NULL,
      reason text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz DEFAULT now(),
      processed_at timestamptz,
      processed_by uuid REFERENCES profiles(id)
    )
  `;
  console.log('✓ extension_requests table verified');

  // 8b. Password reset tokens table
  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      email text NOT NULL,
      token text NOT NULL,
      expires_at timestamptz NOT NULL,
      created_at timestamptz DEFAULT now()
    )
  `;
  console.log('✓ password_reset_tokens table verified');

  // 9. Time tracking columns in quiz_attempts if table exists
  try {
    await sql`
      ALTER TABLE quiz_attempts 
      ADD COLUMN IF NOT EXISTS time_remaining real,
      ADD COLUMN IF NOT EXISTS original_duration integer,
      ADD COLUMN IF NOT EXISTS extensions_applied integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_activity timestamptz DEFAULT now()
    `;
    console.log('✓ quiz_attempts time tracking columns verified');
  } catch (err: any) {
    console.log('- Note: quiz_attempts table might not exist yet, skipping column additions.');
  }

  // 10. Quizzes category and topic-based draw columns
  try {
    await sql`
      ALTER TABLE quizzes 
      ADD COLUMN IF NOT EXISTS category VARCHAR(30) DEFAULT 'quiz',
      ADD COLUMN IF NOT EXISTS topic_draw_rules JSONB DEFAULT '[]'::jsonb
    `;
    console.log('✓ quizzes.category and quizzes.topic_draw_rules columns verified');
  } catch (err: any) {
    console.log('- Note: quizzes table column additions:', err.message);
  }

  // 11. Performance indexes
  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_quizzes_category_status ON quizzes(category, status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_question_bank_course_status_topic ON question_bank(course_id, status, topic)`;
    console.log('✓ Indexes verified');
  } catch (err: any) {
    console.log('- Indexes note:', err.message);
  }

  // 12. Assessment Categories Table
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS assessment_categories (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        name text NOT NULL,
        prefix text NOT NULL,
        color text DEFAULT 'blue',
        description text DEFAULT '',
        created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE(course_id, prefix)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_assessment_categories_course ON assessment_categories(course_id)`;
    console.log('✓ assessment_categories table and indexes verified');
  } catch (err: any) {
    console.log('- Note: assessment_categories table:', err.message);
  }

  // 13. Question Bank Category and Prefix columns
  try {
    await sql`
      ALTER TABLE question_bank 
      ADD COLUMN IF NOT EXISTS category text DEFAULT 'General',
      ADD COLUMN IF NOT EXISTS category_prefix text DEFAULT NULL
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_question_bank_course_cat_prefix ON question_bank(course_id, category_prefix, status)`;
    console.log('✓ question_bank category and category_prefix columns verified');
  } catch (err: any) {
    console.log('- Note: question_bank category additions:', err.message);
  }

  // 14. Quizzes category_prefix and bank_category_filter columns
  try {
    await sql`
      ALTER TABLE quizzes 
      ADD COLUMN IF NOT EXISTS category_prefix text DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS bank_category_filter text DEFAULT 'all'
    `;
    console.log('✓ quizzes category_prefix and bank_category_filter columns verified');
  } catch (err: any) {
    console.log('- Note: quizzes category_prefix additions:', err.message);
  }

  // 15. Question Bank Access Requests Delegation & Revocation Columns
  try {
    await sql`
      ALTER TABLE question_bank_access_requests 
      ADD COLUMN IF NOT EXISTS granted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS revoked_at timestamptz DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS revocation_reason text DEFAULT NULL
    `;
    console.log('✓ question_bank_access_requests delegation columns verified');
  } catch (err: any) {
    console.log('- Note: question_bank_access_requests delegation additions:', err.message);
  }

  console.log('--- Database Migrations Completed Successfully ---');
}

runMigrations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
