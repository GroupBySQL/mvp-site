-- SCHEMA
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS deployments;
DROP TABLE IF EXISTS telemetry;

CREATE TABLE customers (
  customer_id INTEGER PRIMARY KEY,
  name TEXT
);

CREATE TABLE accounts (
  account_id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id)
);

-- Cloud deployments only in this table.
-- active_to NULL = currently active deployment.
CREATE TABLE deployments (
  account_id INTEGER NOT NULL REFERENCES accounts(account_id),
  deployment_type TEXT NOT NULL, -- 'cloud'
  active_from DATE NOT NULL,
  active_to DATE
);

-- On-prem signals (historical sightings).
CREATE TABLE telemetry (
  account_id INTEGER NOT NULL REFERENCES accounts(account_id),
  seen_at DATE NOT NULL
);

-- DATA
INSERT INTO customers(customer_id, name) VALUES
 (1,'Acme'), (2,'Beta Corp'), (3,'Citrus LLC'),
 (4,'Delta Inc'), (5,'Everest'), (6,'Futura'),
 (7,'Giga Co'), (8,'Horizon'), (9,'Ionis'), (10,'Juno');

-- Accounts (some customers have multiple)
INSERT INTO accounts(account_id, customer_id) VALUES
 (1001,1),(1002,1),
 (2001,2),
 (3001,3),(3002,3),
 (4001,4),
 (5001,5),
 (6001,6),
 (7001,7),
 (8001,8),
 (9001,9),
 (10001,10);

-- TELEMETRY (on-prem signals)
INSERT INTO telemetry(account_id, seen_at) VALUES
 -- Hybrid C1: on-prem on 1001, later moves to cloud on 1002
 (1001,'2025-02-15'),
 (1001,'2025-04-01'),

 -- Hybrid C2: same account has telemetry, then cloud
 (2001,'2025-01-10'),

 -- Hybrid C3: telemetry on 3001, cloud on 3002
 (3001,'2025-03-15'),

 -- OnPrem-only customers
 (8001,'2025-04-20'),
 (9001,'2025-05-05'),
 (10001,'2025-02-28');

-- DEPLOYMENTS (cloud). Use active_to NULL for current.
INSERT INTO deployments(account_id, deployment_type, active_from, active_to) VALUES
 -- C1: active cloud on a different account (1002)
 (1002,'cloud','2025-06-01',NULL),

 -- C2: same account becomes cloud-active
 (2001,'cloud','2025-05-05',NULL),

 -- C3: cloud-active on 3002
 (3002,'cloud','2025-09-10',NULL),

 -- C4–C7: Cloud-only customers
 (4001,'cloud','2025-03-20',NULL),
 (5001,'cloud','2025-07-01',NULL),
 (6001,'cloud','2025-01-15',NULL),
 (7001,'cloud','2025-08-08',NULL);

-- Optional: a historical (ended) cloud before current for C4 (illustration)
INSERT INTO deployments(account_id, deployment_type, active_from, active_to) VALUES
 (4001,'cloud','2024-10-01','2025-03-19');
