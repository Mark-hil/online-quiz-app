-- ============================================================================
-- SMART ONLINE EXAMINATION SYSTEM: DUMMY / TEST DATA CLEANUP SCRIPT
-- ============================================================================
-- PURPOSE:
-- Run this script when you are ready to transition from TESTING/DEMO to 
-- OFFICIAL PRODUCTION LAUNCH.
--
-- WHAT THIS DOES:
-- 1. Clears all test candidate answers and submissions.
-- 2. Clears test broadsheet transmissions and flagged question logs.
-- 3. Resets all quizzes back to 'draft' status so faculty can finalize them.
-- 4. PRESERVES all staff accounts (Lecturers, Moderators, Admins, Super Admins).
-- 5. PRESERVES all Questions in the Question Bank and system configurations.
-- 6. Logs the cleanup event in the permanent audit trail.
--
-- INSTRUCTIONS FOR RUNNING:
-- Paste this script into your Neon PostgreSQL SQL Editor (https://console.neon.tech)
-- or execute via psql CLI.
-- ============================================================================

BEGIN;

-- 1. Remove all candidate question responses
TRUNCATE TABLE student_answers CASCADE;

-- 2. Remove all student exam attempt records and proctoring telemetry
TRUNCATE TABLE quiz_attempts CASCADE;

-- 3. Clear test academic transmissions
TRUNCATE TABLE exam_results_transmissions CASCADE;

-- 5. Reset all published/approved/archived quizzes back to 'draft' status
UPDATE quizzes 
SET status = 'draft', updated_at = NOW()
WHERE status IN ('published', 'approved', 'archived');

-- 6. OPTIONAL: Delete test student user accounts (Uncomment if you want to clear test students)
-- DELETE FROM profiles WHERE role = 'student';

-- 7. Record an official entry in the audit trail
INSERT INTO audit_logs (
    action, 
    entity_type, 
    details, 
    created_at
) VALUES (
    'SYSTEM_TEST_DATA_PURGED', 
    'system', 
    '{"type": "Pre-Production Factory Launch Reset", "executed_at": "' || NOW() || '"}', 
    NOW()
);

COMMIT;

-- 8. Optimize and reclaim PostgreSQL disk pages
VACUUM ANALYZE;
