-- ===== Reset =====
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS deployments;
DROP TABLE IF EXISTS telemetry;

-- ===== Schema =====
CREATE TABLE customers (
  customer_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE accounts (
  account_id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- Cloud snapshot: current = rows where active_to IS NULL
CREATE TABLE deployments (
  account_id INTEGER NOT NULL,
  active_from DATE NOT NULL,
  active_to   DATE,           -- NULL = current
  provider    TEXT NOT NULL,  -- 'Cloud' (conservative rule: deployments imply Cloud only)
  FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

-- On-prem historical signal (opt-in); multiple sightings per account are possible
CREATE TABLE telemetry (
  account_id INTEGER NOT NULL,
  seen_at DATE NOT NULL,
  source TEXT NOT NULL,       -- 'onprem'
  FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

-- ===== Data: customers (10) =====
INSERT INTO customers (customer_id, name) VALUES
  (1,'Acme Corp'),
  (2,'Bright Foods'),
  (3,'Cloudy Labs'),
  (4,'Delta Retail'),
  (5,'Ember Health'),
  (6,'Futura Bank'),
  (7,'Green Logistics'),
  (8,'Horizon Media'),
  (9,'Indigo Travel'),
  (10,'Jetstream AI');

-- ===== Data: accounts (16; full list, some only-deploy, only-telemetry, both, or neither) =====
INSERT INTO accounts (account_id, customer_id) VALUES
  (101,1), (102,1),
  (201,2),
  (301,3), (302,3),
  (401,4),
  (501,5), (502,5), (503,5),
  (601,6),
  (701,7), (702,7),
  (801,8),
  (901,9),
  (1001,10), (1002,10);

-- ===== Data: deployments (14 rows; mix of current/past; ensures each customer has at least one) =====
-- customer 1: 101 current cloud; 102 past cloud
INSERT INTO deployments VALUES (101,'2025-01-10',NULL,'Cloud');
INSERT INTO deployments VALUES (102,'2023-01-01','2023-12-31','Cloud');

-- customer 2: 201 current cloud
INSERT INTO deployments VALUES (201,'2025-04-01',NULL,'Cloud');

-- customer 3: 301 current cloud; 302 past cloud
INSERT INTO deployments VALUES (301,'2025-03-15',NULL,'Cloud');
INSERT INTO deployments VALUES (302,'2024-02-01','2024-10-01','Cloud');

-- customer 4: 401 past cloud (ended)
INSERT INTO deployments VALUES (401,'2024-05-01','2024-08-31','Cloud');

-- customer 5: 503 current cloud; 502 past cloud (501 has none)
INSERT INTO deployments VALUES (503,'2025-06-01',NULL,'Cloud');
INSERT INTO deployments VALUES (502,'2024-03-01','2024-11-30','Cloud');

-- customer 6: 601 current cloud
INSERT INTO deployments VALUES (601,'2025-02-20',NULL,'Cloud');

-- customer 7: 701 current cloud; 702 past cloud
INSERT INTO deployments VALUES (701,'2025-05-10',NULL,'Cloud');
INSERT INTO deployments VALUES (702,'2023-06-01','2024-01-31','Cloud');

-- customer 8: 801 current cloud
INSERT INTO deployments VALUES (801,'2025-03-05',NULL,'Cloud');

-- customer 9: 901 past cloud (ended)
INSERT INTO deployments VALUES (901,'2024-04-01','2024-12-31','Cloud');

-- customer 10: 1002 current cloud (1001 has none)
INSERT INTO deployments VALUES (1002,'2025-06-15',NULL,'Cloud');

-- ===== Data: telemetry (on-prem sightings; 16 rows total) =====
-- hybrid signals (both cloud & on-prem)
INSERT INTO telemetry VALUES (101,'2024-05-01','onprem');
INSERT INTO telemetry VALUES (101,'2025-03-01','onprem');   -- 101 = current cloud + onprem
INSERT INTO telemetry VALUES (701,'2025-03-18','onprem');   -- 701 = current cloud + onprem
INSERT INTO telemetry VALUES (503,'2025-07-01','onprem');   -- 503 = current cloud + onprem

-- only-telemetry (no current cloud; some had past cloud, some never)
INSERT INTO telemetry VALUES (302,'2025-01-05','onprem');   -- had past cloud, now only onprem
INSERT INTO telemetry VALUES (502,'2024-07-20','onprem');   -- had past cloud, now only onprem
INSERT INTO telemetry VALUES (702,'2023-07-01','onprem');   -- had past cloud
INSERT INTO telemetry VALUES (901,'2025-01-12','onprem');   -- past cloud, now onprem
INSERT INTO telemetry VALUES (1001,'2025-02-14','onprem');  -- telemetry only (cust 10 still has 1002 cloud)
INSERT INTO telemetry VALUES (501,'2025-02-01','onprem');   -- telemetry only (same customer has 503 cloud)

-- extra on-prem variety
INSERT INTO telemetry VALUES (102,'2024-06-15','onprem');   -- past cloud + onprem
INSERT INTO telemetry VALUES (401,'2024-06-10','onprem');   -- past cloud + onprem
INSERT INTO telemetry VALUES (301,'2025-07-10','onprem');   -- current cloud + onprem (hybrid for cust 3 overall)
INSERT INTO telemetry VALUES (201,'2025-08-01','onprem');   -- makes cust 2 hybrid
INSERT INTO telemetry VALUES (801,'2025-09-01','onprem');   -- makes cust 8 hybrid

-- ===== Helpful indexes =====
CREATE INDEX IF NOT EXISTS idx_deploy_current ON deployments(account_id, active_to);
CREATE INDEX IF NOT EXISTS idx_deploy_from ON deployments(account_id, active_from);
CREATE INDEX IF NOT EXISTS idx_tel_account ON telemetry(account_id, seen_at);
