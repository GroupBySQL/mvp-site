# Challenge 1: Deployment distribution by customer

**Business question:** How many of our customers are Cloud, On-Prem, or Hybrid?

**Conservative rules**
- **Deployment** = Cloud snapshot. Use rows where `active_to IS NULL`. If multiple, keep the latest by `active_from`.
- **Telemetry** = On-prem historical sightings (opt-in). It never implies Cloud.
- **Precedence** for final label (per customer):  
  Any **Cloud** **and** any **On-Prem** ⇒ **Hybrid**; else **Cloud**; else **On-Prem**; else **None**.
- Every customer has at least one deployment record (may be non-current).

**Tasks**
1. **Part 1 — Audit:** accounts that have telemetry but **no current** deployment.
2. **Part 2 — Flags:** per-account booleans: `has_cloud_flag`, `has_onprem_flag`, plus a `source_of_truth` note.
3. **Part 3 — Roll-up:** one row per customer with final `deployment_model ∈ {Cloud, OnPrem, Hybrid, None}`.

Keep each part tidy (~≤20 lines). Order of rows doesn’t matter when grading.
