-- === Schema ===
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
  customer_id INTEGER NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- Cloud snapshot: current = rows where active_to IS NULL
CREATE TABLE deployments (
  account_id INTEGER NOT NULL,
  active_from DATE NOT NULL,
  active_to   DATE,                  -- NULL = current
  provider    TEXT NOT NULL,         -- 'Cloud' (conservative rule: deployments only imply Cloud)
  FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

-- On-prem signal: historical sightings (opt-in)
CREATE TABLE telemetry (
  account_id INTEGER NOT NULL,
  seen_at DATE NOT NULL,
  source TEXT NOT NULL,              -- 'onprem' here
  FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

-- === Data ===
INSERT INTO customers (customer_id, name) VALUES
  (1,'Acme Corp'),
  (2,'Bright Foods'),
  (3,'Cloudy Labs'),
  (4,'Delta Retail');

INSERT INTO accounts (account_id, customer_id) VALUES
  (10,1), (11,1),  -- two accounts for customer 1
  (20,2),
  (30,3),
  (40,4);

-- Deployments (Cloud). NULL active_to = current.
-- cust 1, acct 10: current Cloud
INSERT INTO deployments VALUES (10,'2025-01-10',NULL,'Cloud');

-- cust 1, acct 11: past Cloud (ended) -> not current
INSERT INTO deployments VALUES (11,'2023-01-01','2023-12-31','Cloud');

-- cust 2, acct 20: past Cloud (ended) -> not current
INSERT INTO deployments VALUES (20,'2024-02-01','2024-12-31','Cloud');

-- cust 3, acct 30: current Cloud
INSERT INTO deployments VALUES (30,'2025-03-01',NULL,'Cloud');

-- cust 4, acct 40: past Cloud (ended) -> not current
INSERT INTO deployments VALUES (40,'2024-05-01','2024-10-31','Cloud');

-- Telemetry (On-Prem)
-- cust 1, acct 11: on-prem sighting -> makes customer 1 potentially Hybrid (has current Cloud on acct 10)
INSERT INTO telemetry VALUES (11,'2024-05-01','onprem');

-- cust 2, acct 20: on-prem only -> OnPrem
INSERT INTO telemetry VALUES (20,'2025-03-01','onprem');

-- cust 3, acct 30: no telemetry -> Cloud only
-- cust 4, acct 40: no telemetry and no current -> None

-- Optional helpers
CREATE INDEX IF NOT EXISTS idx_deploy_current ON deployments(account_id, active_to);
CREATE INDEX IF NOT EXISTS idx_tel_account ON telemetry(account_id, seen_at);
