-- Starter (no answers) — write your own queries under each section.
-- You can run any SELECTs you need to explore (e.g., SELECT * FROM accounts LIMIT 5;).

-- ===== Part 1 — Audit =====
-- Goal: accounts that have telemetry but NO current deployment row (active_to IS NULL).
-- Write your SELECT here:


-- ===== Part 2 — Per-account flags =====
-- Goal: one row per account with:
--   account_id, customer_id, has_cloud_flag (0/1), has_onprem_flag (0/1), source_of_truth
-- Rule (conservative): use current deployment if present (active_to IS NULL); else fall back to telemetry (on-prem only).
-- Write your SELECT here:


-- ===== Part 3 — Customer roll-up =====
-- Goal: one label per customer: Cloud / OnPrem / Hybrid / None.
-- Hint: aggregate flags from Part 2 by customer.
-- Write your SELECT here:
