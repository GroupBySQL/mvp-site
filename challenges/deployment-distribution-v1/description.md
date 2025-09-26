# Deployment distribution by customer

**Goal:** “How are our customers deployed — Cloud, On-Prem, or Hybrid?”

**Assumptions (conservative)**
- **Deployment** = current snapshot: use rows where `active_to IS NULL`; if multiple, keep the latest by `active_from`.
- **Telemetry** = historical, on-prem only (opt-in). It never implies Cloud.
- **Precedence:** Deployment > Telemetry.
- Every **customer** has at least one deployment record.

**Tasks**
- **Part 1 — Audit:** Accounts with telemetry but **no current** deployment record.
- **Part 2 — Per-account flags:** one row per account  
  Columns: `account_id, customer_id, has_cloud_flag (0/1), has_onprem_flag (0/1), source_of_truth ('Deployment'|'Telemetry'|'None')`
- **Part 3 — Customer roll-up:** one label per customer  
  `deployment_model ∈ {Cloud, OnPrem, Hybrid, None}`  
  Rule: Any Cloud **and** any On-Prem ⇒ `Hybrid`; else Cloud > On-Prem > None.

*Keep each solution tidy (≈≤20 lines). Order doesn’t matter for grading.*
