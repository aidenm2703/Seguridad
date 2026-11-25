CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email_hash CHAR(64) NOT NULL UNIQUE, email_enc TEXT NOT NULL,
  name VARCHAR(100) NOT NULL, password_hash TEXT NOT NULL, role VARCHAR(10) NOT NULL CHECK (role IN ('jefe', 'empleado')),
  phone_enc TEXT, address_enc TEXT, position VARCHAR(100), is_active BOOLEAN NOT NULL DEFAULT TRUE,
  failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until TIMESTAMPTZ, created_by UUID REFERENCES users(id), key_version INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS announcements (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title VARCHAR(160) NOT NULL, body TEXT NOT NULL, created_by UUID NOT NULL REFERENCES users(id), pinned BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS activities (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, title_enc TEXT NOT NULL, description_enc TEXT NOT NULL, start_at TIMESTAMPTZ NOT NULL, end_at TIMESTAMPTZ NOT NULL, status VARCHAR(12) NOT NULL DEFAULT 'pendiente', priority VARCHAR(8) NOT NULL DEFAULT 'media', key_version INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS daily_reports (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, report_date DATE NOT NULL, content_enc TEXT NOT NULL, key_version INTEGER NOT NULL DEFAULT 1, UNIQUE(owner_id, report_date));
CREATE TABLE IF NOT EXISTS payments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, amount_enc TEXT NOT NULL, concept_enc TEXT NOT NULL, period DATE NOT NULL, key_version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS documents (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title_enc TEXT NOT NULL, content_enc TEXT NOT NULL, uploaded_by UUID NOT NULL REFERENCES users(id), key_version INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS password_resets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash CHAR(64) NOT NULL, expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS security_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id), event_type VARCHAR(40) NOT NULL, ip INET, user_agent TEXT, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_activities_owner_start ON activities(owner_id, start_at);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);
