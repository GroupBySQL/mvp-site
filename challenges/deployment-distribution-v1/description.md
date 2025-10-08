# Question: How many of our customers are Cloud, On-Prem, or Hybrid?

**There are 4 tables for this challenges**
- **accounts**
- **customers**  
- **Deployment** - Cloud deployment snapshot. `active_from` is the start and `active_to` is the end. When `active_to` is **NULL**, the deployment is currently active (open-ended period). Customers can have multiple deployment rows over time, but only one **active cloud** per account at a time.
- **Telemetry** - On-prem deployment provided by customers only.

**Customer categories in this dataset:** **Cloud**, **On-Prem**, **Hybrid**.  
Every customer has at least one deployment (cloud and/or on-prem).

## Stage 1 – Signal Check
Find accounts that are OnPrem with no active cloud deployments.  
Expected output: Result has one column `account_id`, sorted ascending.  

Tables: `telemetry`, `deployments`  

---

## Stage 2 – Source Map
Flag active cloud/on-prem per accounts in 'accounts'.  
Expected output: One row per `account_id` with:
- `has_active_cloud` (1 or 0)
- `has_onprem` (1 or 0)

Tables: `accounts`, `telemetry`, `deployments`  

---

## Stage 3 – Customer Roll-Up
Summarize per customer using the following logic: 
Hybrid - if customer has any active cloud AND any on-prem deployment  
Cloud - if customer has any active cloud
OnPrem - if customer has any on-prem deployment

Expected output:  One row per `customer_id` with `deployment_model` {`Hybrid`, `Cloud`, `OnPrem`}.
NOTE: Every customer has at least one deployment (cloud and/or on-prem).

Tables:`customers`, `accounts`, flags you derived in Stage 2 (or equivalent logic)

---

## Bonus Stage – Customer Migration
List customers that migrated from OnPrem to Cloud: they have a **current active cloud** deployment and that cloud’s start date is **later** than their **last** on-prem sighting.  

Tables:`customers`, `accounts`,`telemetry`, `deployments`  

---

## Brief Your Executive
**Mission:** Communicate the takeaway.
**Prompt:** “Based on your roll-up, which segment is larger in this dataset?”
- ☐ Cloud
- ☐ On-Prem
- ☐ Hybrid

*(This unlocks after you pass Stages 1, 2, and 3.)*
