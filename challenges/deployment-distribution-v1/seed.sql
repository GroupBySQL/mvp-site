DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS deployments;
DROP TABLE IF EXISTS telemetry;

CREATE TABLE customers (customer_id INTEGER PRIMARY KEY, customer_name TEXT);
CREATE TABLE accounts  (account_id  INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL);

CREATE TABLE deployments (
  deployment_id INTEGER PRIMARY KEY,
  account_id    INTEGER NOT NULL,
  model_raw     TEXT,          -- 'cloud','saas','hosted','server','onprem','on-prem','datacenter'
  active_from   TEXT,          -- YYYY-MM-DD
  active_to     TEXT,          -- NULL => current snapshot
  FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

CREATE TABLE telemetry (
  signal_id   INTEGER PRIMARY KEY,
  account_id  INTEGER NOT NULL,
  source      TEXT,            -- telemetry/support/license
  signal_type TEXT,            -- heartbeat/ticket_env
  value       TEXT,            -- on-prem context values (never cloud)
  seen_at     TEXT,            -- YYYY-MM-DD
  FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

-- Customers
INSERT INTO customers VALUES (1,'Acme'),(2,'Globex'),(3,'Umbrella'),(4,'Initech'),(5,'Soylent');

-- Accounts
INSERT INTO accounts (account_id, customer_id) VALUES (10,1),(11,1),(20,2),(30,3),(40,4),(50,5);

-- Deployments (current & historical)
-- C1: a10 current Cloud; a11 historical On-Prem (no current)
INSERT INTO deployments VALUES (1000,10,'cloud','2024-01-01',NULL);
INSERT INTO deployments VALUES (1100,11,'on-prem','2023-01-01','2023-12-31');

-- C2: a20 current On-Prem
INSERT INTO deployments VALUES (2000,20,'server','2022-05-01',NULL);

-- C3: a30 historical Cloud, no current
INSERT INTO deployments VALUES (3000,30,'hosted','2022-02-01','2022-10-31');

-- C4: a40 current On-Prem
INSERT INTO deployments VALUES (4000,40,'datacenter','2021-07-01',NULL);

-- C5: a50 historical On-Prem, no current
INSERT INTO deployments VALUES (5000,50,'onprem','2020-03-01','2020-12-31');

-- Telemetry (on-prem only; presence implies on-prem; never cloud)
INSERT INTO telemetry VALUES
 (1,11,'telemetry','heartbeat','datacenter','2025-03-10'),
 (2,30,'support','ticket_env','onprem','2025-02-01'),
 (3,50,'license','activation','on-prem','2025-04-15'),
 (4,20,'telemetry','heartbeat','server','2025-05-20');
