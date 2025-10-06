# Business question: How many of our customers are Cloud, On-Prem, or Hybrid?

**Conservative rules**
- **Deployment** = Cloud snapshot. Use rows where `active_to IS NULL`. If multiple, keep the latest by `active_from`.
- **Telemetry** = On-prem historical sightings (opt-in). It never implies Cloud.
- **Precedence** for final label (per customer):  
  Any **Cloud** **and** any **On-Prem** ⇒ **Hybrid**; else **Cloud**; else **On-Prem**; else **None**.
- Every customer has at least one deployment record (may be non-current).

## Stage 1 – Signal Check
**Mission:** Find accounts sending on-prem signals without an active cloud footprint.  
**Goal:** List `account_id` that appear in `telemetry` but are **absent** from active `deployments`.  
**Tables:** `telemetry`, `deployments`  
**Define done:** Result has one column `account_id`, sorted ascending.  
**Hint:** “Active cloud” means `deployments.active_to IS NULL`.

---

## Stage 2 – Source Map
**Mission:** For each account, set flags for cloud/on-prem and the source classification.  
**Goal:** One row per `account_id` with:
- `has_cloud_flag` (1/0)
- `has_onprem_flag` (1/0)
- `source_of_truth` ∈ {`cloud_only`, `onprem_only`, `both`, `none`}

**Tables:** `accounts`, `telemetry`, `deployments`  
**Define done:** Exactly 3 columns above (+ `account_id`) and one row for every account in `accounts`.

**Rules (conservative):**
- **Cloud** = active deployment (`active_to IS NULL`) — latest by `active_from` if multiple.
- **On-Prem** = any record in `telemetry` (opt-in, historical).
- Precedence per *account*: both signals → `both`; else cloud → `cloud_only`; else on-prem → `onprem_only`; else `none`.

---

## Stage 3 – Customer Roll-Up
**Mission:** Summarize deployment per customer.  
**Goal:** One row per `customer_id` with `deployment_model` ∈ {`Hybrid`, `Cloud`, `OnPrem`, `None`}.  
**Tables:** `customers`, `accounts`, flags you derived in Stage 2 (or equivalent logic)

**Precedence per *customer*:**
- Any cloud + any on-prem → `Hybrid`
- Else any cloud → `Cloud`
- Else any on-prem → `OnPrem`
- Else → `None`

**Define done:** Columns `customer_id`, `deployment_model`, sorted by `customer_id`.

---

## Brief Your Executive
**Mission:** Communicate the takeaway.
**Prompt:** “Based on your roll-up, which segment is larger in this dataset?”
- ☐ Cloud
- ☐ On-Prem
- ☐ Hybrid
- ☐ None

*(This unlocks after you pass Stages 1, 2, and 3.)*
