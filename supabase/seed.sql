-- ===========================================================
-- Demo Seed — Enterprise RAG Knowledge Base
-- ===========================================================
-- Requirements:
--   • All 8 migrations must be applied before running this seed.
--   • documents + chunks are seeded without a user reference (uploaded_by IS NULL).
--   • workspace_members, conversations, and messages FK to auth.users.
--     Uncomment and update the DO $$ block at the bottom after creating a
--     demo user in Supabase Auth (dashboard or CLI).
--
-- Usage:
--   npx supabase db seed           (supabase CLI)
--   psql "$DATABASE_URL" -f supabase/seed.sql
-- ===========================================================

-- Guard against re-seeding
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM organizations WHERE id = '10000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE NOTICE 'Seed data already present — skipping.';
    RETURN;
  END IF;
END $$;

-- ── Organization ─────────────────────────────────────────────
INSERT INTO organizations (id, name) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Acme Corporation')
ON CONFLICT (id) DO NOTHING;

-- ── Workspaces ───────────────────────────────────────────────
INSERT INTO workspaces (id, org_id, name, system_prompt) VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'HR Workspace',
    'You are an expert HR assistant for Acme Corporation. Answer questions about company policies, benefits, and procedures based solely on the provided documents. Always cite your sources with [N] inline.'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Engineering Workspace',
    'You are a technical documentation assistant for Acme Engineering. Answer questions about system architecture, APIs, and operational procedures based solely on the provided documentation. Be precise and technical.'
  )
ON CONFLICT (id) DO NOTHING;

-- ── Documents — HR Workspace (4 docs) ────────────────────────
INSERT INTO documents
  (id, workspace_id, title, source_type, status, chunk_count, page_count, version)
VALUES
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Employee Handbook 2024',  'pdf',  'ready', 8, 42, 1),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'PTO & Leave Policy',      'pdf',  'ready', 6, 18, 2),
  ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Benefits Guide Q1 2025',  'pdf',  'ready', 7, 26, 1),
  ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'Remote Work Guidelines',  'docx', 'ready', 5, 12, 1)
ON CONFLICT (id) DO NOTHING;

-- ── Documents — Engineering Workspace (4 docs) ───────────────
INSERT INTO documents
  (id, workspace_id, title, source_type, status, chunk_count, page_count, version)
VALUES
  ('40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 'Architecture Runbook',     'pdf',  'ready', 9, 34, 3),
  ('40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', 'API Reference Guide',      'pdf',  'ready', 8, 28, 1),
  ('40000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002', 'Deployment Checklist',     'docx', 'ready', 5, 10, 4),
  ('40000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000002', 'On-Call Escalation Guide', 'pdf',  'ready', 6, 15, 2)
ON CONFLICT (id) DO NOTHING;

-- ── Chunks — Employee Handbook 2024 ──────────────────────────
INSERT INTO chunks
  (id, document_id, workspace_id, content, heading_context, chunk_index, token_count, page_number)
VALUES
  ('50000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'Acme Corporation was founded in 1998 with a mission to build world-class software. We believe employees are our greatest asset. This handbook outlines the policies, procedures, and benefits that define the Acme workplace experience.',
   'Introduction', 0, 52, 1),
  ('50000000-0000-0000-0000-000000000002',
   '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'Acme operates a hybrid work model. Employees are expected to be present in the office a minimum of two days per week, Tuesday and Thursday, unless otherwise agreed with their manager. Remote work is permitted on all other business days.',
   'Work Model & Attendance', 1, 48, 5),
  ('50000000-0000-0000-0000-000000000003',
   '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'All employees are subject to a 90-day probationary period upon hire. During this period, performance is closely monitored and either party may terminate the employment relationship with one week written notice.',
   'Probationary Period', 2, 46, 8),
  ('50000000-0000-0000-0000-000000000004',
   '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'Acme''s Code of Conduct requires all employees to act with honesty, respect, and integrity in every interaction. Violations including harassment, discrimination, or misuse of company resources may result in immediate termination.',
   'Code of Conduct', 3, 50, 14),
  ('50000000-0000-0000-0000-000000000005',
   '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'Salary reviews are conducted annually in Q4. Merit increases are based on performance ratings from the preceding year. Exceptional performers (rating 4.5/5 or above) are eligible for a discretionary bonus of up to 15% of base salary.',
   'Compensation & Reviews', 4, 53, 22),
  ('50000000-0000-0000-0000-000000000006',
   '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'All employees must complete mandatory training in data security, unconscious bias, and workplace safety within 30 days of hire. Training is delivered via the Acme Learning Portal at learn.acme.internal.',
   'Mandatory Training', 5, 51, 31),
  ('50000000-0000-0000-0000-000000000007',
   '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'Employees experiencing a workplace grievance or ethical concern should speak with their direct manager first. If unresolved within 5 business days, the matter may be escalated to People Operations at hr@acme.example.com.',
   'Grievance Procedure', 6, 49, 38),
  ('50000000-0000-0000-0000-000000000008',
   '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'Upon voluntary resignation, employees must provide a minimum of two weeks written notice to their manager and HR. Company property including laptops, access cards, and software licenses must be returned on the final working day.',
   'Offboarding', 7, 47, 41)
ON CONFLICT (id) DO NOTHING;

-- ── Chunks — PTO & Leave Policy ───────────────────────────────
INSERT INTO chunks
  (id, document_id, workspace_id, content, heading_context, chunk_index, token_count, page_number)
VALUES
  ('50000000-0000-0000-0000-000000000009',
   '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
   'Full-time employees accrue 15 days of paid time off (PTO) per year in their first two years. After 2 years, accrual increases to 20 days per year. After 5 years, employees receive 25 days annually.',
   'PTO Accrual Schedule', 0, 54, 2),
  ('50000000-0000-0000-0000-000000000010',
   '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
   'PTO requests must be submitted via BambooHR at least 5 business days in advance for requests of 3 days or fewer. Requests of 4 or more consecutive days require 10 business days advance notice and manager approval.',
   'Requesting PTO', 1, 52, 4),
  ('50000000-0000-0000-0000-000000000011',
   '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
   'Acme provides up to 12 weeks of paid parental leave for the primary caregiver and 4 weeks for the secondary caregiver following the birth, adoption, or foster placement of a child. Leave must be taken within 12 months of the qualifying event.',
   'Parental Leave', 2, 58, 8),
  ('50000000-0000-0000-0000-000000000012',
   '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
   'Under the Family and Medical Leave Act (FMLA), eligible employees may take up to 12 weeks of unpaid, job-protected leave per year. To be eligible, employees must have worked at Acme for at least 12 months and 1,250 hours in the preceding period.',
   'FMLA Leave', 3, 61, 11),
  ('50000000-0000-0000-0000-000000000013',
   '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
   'Unused PTO up to a maximum of 10 days may be carried over into the following calendar year. Any balance above 10 days is forfeited on December 31st. Employees may not take unpaid leave in lieu of PTO without manager and HR approval.',
   'PTO Carryover & Forfeiture', 4, 56, 15),
  ('50000000-0000-0000-0000-000000000014',
   '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
   'Bereavement leave of up to 5 paid days is provided for the death of an immediate family member (spouse, child, parent, or sibling). Up to 3 paid days are provided for extended family members. Additional unpaid leave may be granted at manager discretion.',
   'Bereavement Leave', 5, 57, 17)
ON CONFLICT (id) DO NOTHING;

-- ── Chunks — Benefits Guide Q1 2025 ───────────────────────────
INSERT INTO chunks
  (id, document_id, workspace_id, content, heading_context, chunk_index, token_count, page_number)
VALUES
  ('50000000-0000-0000-0000-000000000015',
   '40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
   'Acme offers three health plan tiers: Basic (HDHP with HSA), Standard (PPO, $500 individual deductible), and Premium (PPO, $0 deductible). Premiums are deducted pre-tax from bi-weekly payroll. Open enrollment occurs every October.',
   'Health Insurance', 0, 59, 3),
  ('50000000-0000-0000-0000-000000000016',
   '40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
   'Acme matches 401(k) contributions up to 5% of base salary — 100% match on the first 3%, 50% match on the next 2%. Vesting is immediate on employee contributions; employer match vests over 3 years (33% per year). Plan administrator: Fidelity Investments.',
   '401(k) Retirement Plan', 1, 57, 8),
  ('50000000-0000-0000-0000-000000000017',
   '40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
   'All employees receive a $150/month wellness stipend reimbursable for gym memberships, fitness equipment, meditation apps, or sports leagues. Submit receipts via Expensify with the tag "Wellness" within 60 days of the expense date.',
   'Wellness Stipend', 2, 54, 12),
  ('50000000-0000-0000-0000-000000000018',
   '40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
   'Acme provides $3,000 per year in professional development funding for conferences, courses, certifications, or books. Requires pre-approval from your manager via the PD Request Form in BambooHR. Unused funds do not carry over.',
   'Professional Development', 3, 56, 16),
  ('50000000-0000-0000-0000-000000000019',
   '40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
   'Dental coverage (Delta Dental) includes 100% preventive, 80% basic restorative, and 50% major restorative care up to an annual maximum of $2,000 per person. Orthodontia is covered at 50% up to a lifetime maximum of $1,500.',
   'Dental & Vision', 4, 55, 19),
  ('50000000-0000-0000-0000-000000000020',
   '40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
   'Acme provides up to $5,000 per year in financial assistance for adoption expenses including agency fees, legal costs, and travel. Employees must have completed 12 months of continuous service at Acme to be eligible.',
   'Adoption Assistance', 5, 52, 23),
  ('50000000-0000-0000-0000-000000000021',
   '40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
   'The Employee Assistance Program (EAP) provides 8 free confidential counseling sessions per year through Lyra Health. Services include mental health support, financial coaching, legal consultation, and childcare referrals.',
   'Employee Assistance Program', 6, 58, 25)
ON CONFLICT (id) DO NOTHING;

-- ── Chunks — Remote Work Guidelines ───────────────────────────
INSERT INTO chunks
  (id, document_id, workspace_id, content, heading_context, chunk_index, token_count, page_number)
VALUES
  ('50000000-0000-0000-0000-000000000022',
   '40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001',
   'Remote employees must maintain a dedicated, distraction-free workspace with reliable internet (minimum 25 Mbps down / 10 Mbps up). Acme provides a one-time $500 home office setup stipend for full-time remote employees hired after January 1, 2024.',
   'Workspace Requirements', 0, 57, 1),
  ('50000000-0000-0000-0000-000000000023',
   '40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001',
   'Remote employees are expected to be available during core hours of 10:00–15:00 in their local time zone, Monday through Friday. Outside of core hours, asynchronous communication via Slack is preferred with a 4-hour response SLA within the same business day.',
   'Core Hours & Availability', 1, 58, 3),
  ('50000000-0000-0000-0000-000000000024',
   '40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001',
   'All company data accessed remotely must be handled per Acme''s Data Classification Policy. Employees must connect via the corporate VPN (GlobalProtect) when accessing internal systems. Storing company data on personal devices or unapproved cloud storage is strictly prohibited.',
   'Security Requirements', 2, 59, 6),
  ('50000000-0000-0000-0000-000000000025',
   '40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001',
   'International remote work requests must be submitted 30 days in advance via the International Work Request form in BambooHR. Approval depends on tax implications, visa status, and local labor law compliance. Stays over 90 days require Legal and Finance review.',
   'International Remote Work', 3, 60, 9),
  ('50000000-0000-0000-0000-000000000026',
   '40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001',
   'Remote employees are eligible for the same career advancement opportunities as in-office staff. Managers must create equitable visibility for remote team members in meetings, project assignments, and performance discussions.',
   'Career & Equity', 4, 61, 11)
ON CONFLICT (id) DO NOTHING;

-- ── Chunks — Architecture Runbook ─────────────────────────────
INSERT INTO chunks
  (id, document_id, workspace_id, content, heading_context, chunk_index, token_count, page_number)
VALUES
  ('50000000-0000-0000-0000-000000000027',
   '40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002',
   'The Acme platform is built on a microservices architecture deployed to AWS us-east-1. Core services include the API Gateway (Kong), Auth Service (Cognito-backed), Product Catalog Service, Order Management Service, and Notification Service.',
   'System Overview', 0, 55, 2),
  ('50000000-0000-0000-0000-000000000028',
   '40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002',
   'All inter-service communication uses gRPC for synchronous calls and AWS SQS for asynchronous event-driven workflows. Message schemas are defined in Protocol Buffers (proto3) and versioned in the platform-schemas monorepo.',
   'Service Communication', 1, 52, 6),
  ('50000000-0000-0000-0000-000000000029',
   '40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002',
   'The primary database is PostgreSQL 16 on RDS Multi-AZ with read replicas in us-west-2 for disaster recovery. Connection pooling is handled by PgBouncer. The automated backup window is 03:00–04:00 UTC daily.',
   'Database Architecture', 2, 57, 11),
  ('50000000-0000-0000-0000-000000000030',
   '40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002',
   'Kubernetes (EKS 1.29) manages all containerized workloads across 3 node groups: general (m6i.large), compute (c6i.2xlarge for ML inference), and spot (mixed instance policy for batch jobs). Deployments use ArgoCD with automated rollback.',
   'Kubernetes & Deployments', 3, 59, 15),
  ('50000000-0000-0000-0000-000000000031',
   '40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002',
   'The observability stack consists of Prometheus + Grafana for metrics, Jaeger for distributed tracing, and Loki for log aggregation. All services expose /metrics on port 9090. SLO dashboards are in grafana.acme.example.com.',
   'Observability Stack', 4, 58, 20),
  ('50000000-0000-0000-0000-000000000032',
   '40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002',
   'Horizontal Pod Autoscaler (HPA) is configured on all production deployments: minimum 2 replicas, maximum 20. Scale-up triggers at 70% CPU or 80% memory. Scale-down requires 5 consecutive minutes below 30% to prevent thrashing.',
   'Auto-Scaling Policy', 5, 56, 24),
  ('50000000-0000-0000-0000-000000000033',
   '40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002',
   'The CI/CD pipeline runs in GitHub Actions. Feature branches trigger lint + unit tests. Merges to main trigger integration tests + build + push to ECR. Deployments to staging are automatic; production requires a manual approval gate.',
   'CI/CD Pipeline', 6, 57, 29),
  ('50000000-0000-0000-0000-000000000034',
   '40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002',
   'Incident response follows a 4-severity model. P0 (service down) requires on-call response within 5 minutes via PagerDuty. P1 (degraded) requires 15 minutes. P2 and P3 are handled in normal business hours.',
   'Incident Response', 7, 60, 32),
  ('50000000-0000-0000-0000-000000000035',
   '40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002',
   'All production changes require a change request in Jira project INFRA, approval from 2 senior engineers + team lead, and scheduling in the maintenance window (Saturdays 02:00–06:00 UTC). A post-mortem is required within 48 hours if anything goes wrong.',
   'Change Management', 8, 62, 33)
ON CONFLICT (id) DO NOTHING;

-- ── Chunks — API Reference Guide ───────────────────────────────
INSERT INTO chunks
  (id, document_id, workspace_id, content, heading_context, chunk_index, token_count, page_number)
VALUES
  ('50000000-0000-0000-0000-000000000036',
   '40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002',
   'The Acme Platform API uses REST over HTTPS. Base URL: https://api.acme.example.com/v2. All requests must include Authorization: Bearer <token>. Tokens expire after 1 hour; use /v2/auth/refresh to obtain a new token without re-authenticating.',
   'Authentication', 0, 58, 1),
  ('50000000-0000-0000-0000-000000000037',
   '40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002',
   'Rate limits: 1,000 requests/minute for standard tier, 10,000/minute for enterprise. Every response includes X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers. Exceeding limits returns HTTP 429 with Retry-After.',
   'Rate Limiting', 1, 55, 3),
  ('50000000-0000-0000-0000-000000000038',
   '40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002',
   'GET /v2/products returns a paginated list of products. Query parameters: limit (default 20, max 100), cursor (pagination token), category (filter by slug), status (active|archived|draft). Response includes items array and next_cursor.',
   'Products API — List', 2, 57, 8),
  ('50000000-0000-0000-0000-000000000039',
   '40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002',
   'POST /v2/orders creates a new order. Required body fields: customer_id (UUID), line_items (array of {sku, quantity}), shipping_address (object). Returns 201 with the created order including order_id, status: pending, and estimated_delivery_date.',
   'Orders API — Create', 3, 58, 14),
  ('50000000-0000-0000-0000-000000000040',
   '40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002',
   'Webhooks are delivered via HTTPS POST to your registered endpoint. Events: order.created, order.shipped, order.delivered, payment.failed. Each request includes X-Acme-Signature (HMAC-SHA256). Acknowledge with HTTP 200 within 5 seconds to prevent retries.',
   'Webhooks', 4, 62, 19),
  ('50000000-0000-0000-0000-000000000041',
   '40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002',
   'Error responses follow RFC 7807 Problem Details. Body fields: type (error URI), title, status (HTTP code), detail (description), instance (trace ID). Common codes: 400 (validation), 401 (invalid token), 403 (scope), 429 (rate limited), 503 (unavailable).',
   'Error Handling', 5, 64, 22),
  ('50000000-0000-0000-0000-000000000042',
   '40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002',
   'Idempotent requests use the Idempotency-Key header (UUID v4). Include on POST and PATCH to safely retry without duplicate operations. Keys are retained for 24 hours. The response for a duplicate key returns the original result with HTTP 200.',
   'Idempotency', 6, 52, 26),
  ('50000000-0000-0000-0000-000000000043',
   '40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002',
   'SDKs are available for Node.js (npm install @acme/sdk), Python (pip install acme-sdk), and Go (go get github.com/acme/acme-go). All SDKs auto-handle token refresh, exponential backoff retries, and typed error objects.',
   'SDKs & Client Libraries', 7, 60, 27)
ON CONFLICT (id) DO NOTHING;

-- ── Chunks — Deployment Checklist ─────────────────────────────
INSERT INTO chunks
  (id, document_id, workspace_id, content, heading_context, chunk_index, token_count, page_number)
VALUES
  ('50000000-0000-0000-0000-000000000044',
   '40000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002',
   'Pre-deployment: confirm all unit, integration, and E2E tests pass in CI (green build required). Run lint with zero warnings. Verify environment variables are set in production — use vercel env ls to confirm. Ensure database migrations are backward-compatible.',
   'Pre-Deployment Checks', 0, 60, 1),
  ('50000000-0000-0000-0000-000000000045',
   '40000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002',
   'Database migrations must be applied before deploying new application code. Use supabase db push to apply pending migrations. After applying, verify with supabase db diff — expected output is "no schema changes detected". Never deploy code requiring an unapplied migration.',
   'Database Migration Protocol', 1, 58, 3),
  ('50000000-0000-0000-0000-000000000046',
   '40000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002',
   'Production deployments use Vercel Rolling Releases. Traffic shifts 10% → 25% → 50% → 100% over 20 minutes with automatic health-check gates. If error rate exceeds 2% at any stage, the deployment halts and traffic rolls back automatically.',
   'Rolling Deployment Process', 2, 59, 5),
  ('50000000-0000-0000-0000-000000000047',
   '40000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002',
   'Post-deployment smoke tests: (1) GET /api/health returns 200. (2) Upload a test PDF — status reaches ready within 60 seconds. (3) Send a test chat message — streaming response received. (4) Verify Sentry receives no new P0 errors within 5 minutes.',
   'Post-Deployment Smoke Tests', 3, 61, 7),
  ('50000000-0000-0000-0000-000000000048',
   '40000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002',
   'Rollback: in Vercel dashboard, go to Deployments, select the last stable deployment, click Promote to Production. This takes under 30 seconds. For database rollbacks, apply the corresponding down migration. Document the rollback in the #deployments Slack channel.',
   'Rollback Procedure', 4, 60, 9)
ON CONFLICT (id) DO NOTHING;

-- ── Chunks — On-Call Escalation Guide ─────────────────────────
INSERT INTO chunks
  (id, document_id, workspace_id, content, heading_context, chunk_index, token_count, page_number)
VALUES
  ('50000000-0000-0000-0000-000000000049',
   '40000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000002',
   'The on-call rotation covers Platform, Backend, and Data teams in 7-day windows (Monday 09:00 → Monday 09:00 UTC). Schedules are managed in PagerDuty. New engineers join after completing two full rotations as secondary on-call.',
   'On-Call Rotation', 0, 58, 1),
  ('50000000-0000-0000-0000-000000000050',
   '40000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000002',
   'P0 incidents require acknowledgment within 5 minutes and an initial status update in #incidents within 10 minutes. A war room is opened in Slack immediately. Engineering VP must be notified if the incident persists beyond 30 minutes.',
   'P0 Incident Response', 1, 60, 3),
  ('50000000-0000-0000-0000-000000000051',
   '40000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000002',
   'Escalation path: (1) Primary on-call → (2) Secondary on-call if unresponsive after 5 min → (3) Team lead → (4) Engineering Manager → (5) Engineering VP. Use the PagerDuty "Platform-Primary" escalation policy. Never skip levels without explicit permission.',
   'Escalation Path', 2, 59, 6),
  ('50000000-0000-0000-0000-000000000052',
   '40000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000002',
   'All P0 and P1 incidents require a post-mortem document within 48 hours of resolution. Include: timeline, root cause, contributing factors, impact assessment, and action items with owners and due dates. Template: notion.acme.example.com/post-mortem-template.',
   'Post-Mortem Requirements', 3, 61, 9),
  ('50000000-0000-0000-0000-000000000053',
   '40000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000002',
   'On-call compensation: $200/rotation stipend paid in the following month''s payroll. Engineers paged outside business hours (before 09:00 or after 18:00 local time) receive an additional $50 per page, capped at $150 per incident.',
   'On-Call Compensation', 4, 60, 12),
  ('50000000-0000-0000-0000-000000000054',
   '40000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000002',
   'Common runbook links: DB CPU spike → runbooks/db-cpu-spike.md. API latency spike → runbooks/api-latency.md. Inngest job backlog → runbooks/inngest-backlog.md. Memory OOM → runbooks/oom-recovery.md. All runbooks are in the acme/runbooks GitHub repo.',
   'Runbook Index', 5, 58, 14)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- USER-DEPENDENT SEED (workspace_members, conversations, messages)
-- These tables FK to auth.users — they require a real Supabase Auth user.
--
-- Steps:
--   1. Create a user in Supabase Auth:
--      supabase auth create --email demo@example.com (CLI)
--      OR use the Supabase dashboard → Authentication → Users → Invite
--   2. Copy the resulting user UUID
--   3. Replace '44444444-4444-4444-4444-444444444444' below with that UUID
--   4. Uncomment the block and re-run the seed
-- ══════════════════════════════════════════════════════════════

/*
DO $$ DECLARE
  DEMO_USER_ID uuid := '44444444-4444-4444-4444-444444444444'; -- REPLACE THIS
BEGIN

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('20000000-0000-0000-0000-000000000001', DEMO_USER_ID, 'owner'),
  ('20000000-0000-0000-0000-000000000002', DEMO_USER_ID, 'owner')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO conversations (id, workspace_id, user_id, title) VALUES
  ('60000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', DEMO_USER_ID, 'Parental Leave Policy'),
  ('60000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000002', DEMO_USER_ID, 'API Rate Limiting Setup')
ON CONFLICT (id) DO NOTHING;

-- Conversation 1: Parental Leave
INSERT INTO messages
  (id, conversation_id, role, content, cited_chunk_ids, faithfulness_score, relevance_score, input_tokens, output_tokens)
VALUES
  ('70000000-0000-0000-0000-000000000001',
   '60000000-0000-0000-0000-000000000001',
   'user', 'How much parental leave does Acme offer?',
   '{}', NULL, NULL, NULL, NULL),
  ('70000000-0000-0000-0000-000000000002',
   '60000000-0000-0000-0000-000000000001',
   'assistant',
   'Acme provides generous parental leave benefits [1]. The primary caregiver receives up to **12 weeks of fully paid parental leave**, while the secondary caregiver receives **4 weeks** [1]. Leave must be taken within 12 months of a qualifying event such as birth, adoption, or foster placement [2].',
   ARRAY[
     '50000000-0000-0000-0000-000000000011'::uuid,
     '50000000-0000-0000-0000-000000000012'::uuid
   ],
   0.940, 0.970, 1240, 87),
  ('70000000-0000-0000-0000-000000000003',
   '60000000-0000-0000-0000-000000000001',
   'user', 'What about FMLA eligibility requirements?',
   '{}', NULL, NULL, NULL, NULL),
  ('70000000-0000-0000-0000-000000000004',
   '60000000-0000-0000-0000-000000000001',
   'assistant',
   'To qualify for FMLA at Acme, you must meet two criteria [1]: you must have worked here for **at least 12 months** and logged **at least 1,250 hours** in the preceding year [1]. FMLA provides up to 12 weeks of unpaid, job-protected leave for qualifying family and medical reasons.',
   ARRAY['50000000-0000-0000-0000-000000000012'::uuid],
   0.970, 0.950, 1380, 94)
ON CONFLICT (id) DO NOTHING;

-- Conversation 2: API Rate Limiting
INSERT INTO messages
  (id, conversation_id, role, content, cited_chunk_ids, faithfulness_score, relevance_score, input_tokens, output_tokens)
VALUES
  ('70000000-0000-0000-0000-000000000005',
   '60000000-0000-0000-0000-000000000002',
   'user', 'What rate limits does the Acme API enforce?',
   '{}', NULL, NULL, NULL, NULL),
  ('70000000-0000-0000-0000-000000000006',
   '60000000-0000-0000-0000-000000000002',
   'assistant',
   'The Acme Platform API enforces rate limits per API key [1]. Standard tier clients are limited to **1,000 requests per minute**, while enterprise clients receive **10,000 requests per minute** [1]. Every response includes three rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` [1].',
   ARRAY['50000000-0000-0000-0000-000000000037'::uuid],
   0.980, 0.960, 1310, 91),
  ('70000000-0000-0000-0000-000000000007',
   '60000000-0000-0000-0000-000000000002',
   'user', 'How do I handle rate limit errors in my integration?',
   '{}', NULL, NULL, NULL, NULL),
  ('70000000-0000-0000-0000-000000000008',
   '60000000-0000-0000-0000-000000000002',
   'assistant',
   'Rate limit errors are returned as HTTP 429 following the RFC 7807 Problem Details format [1]. The response includes a `detail` field and an `instance` trace ID [1]. The official SDKs for Node.js, Python, and Go automatically handle retries with **exponential backoff** for 429 responses [2], so using an Acme SDK is strongly recommended for production integrations.',
   ARRAY[
     '50000000-0000-0000-0000-000000000041'::uuid,
     '50000000-0000-0000-0000-000000000043'::uuid
   ],
   0.910, 0.940, 1520, 112)
ON CONFLICT (id) DO NOTHING;

END $$;
*/
