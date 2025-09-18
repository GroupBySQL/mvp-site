PRAGMA foreign_keys = ON;

CREATE TABLE customers (
  customer_id INTEGER PRIMARY KEY,
  customer_name TEXT
);

CREATE TABLE accounts (
  account_id INTEGER PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(customer_id)
);

CREATE TABLE keys (
  key_id INTEGER PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(account_id),
  os_raw TEXT,
  active_from TEXT,
  active_to   TEXT
);

INSERT INTO customers VALUES
 (1,'Acme'), (2,'Globex'), (3,'Umbrella'), (4,'Initech');

INSERT INTO accounts VALUES
 (10,1), (11,1), (20,2), (30,3), (40,4);

-- Active/inactive + messy OS strings
INSERT INTO keys VALUES
 (1001,10,'windows 11','2025-06-10',NULL),
 (1002,10,'linux-ubuntu','2025-06-15',NULL),
 (1003,11,'linux','2024-12-01','2025-02-01'),
 (1004,20,'win','2024-01-01',NULL),
 (1005,30,'unknown-os','2025-01-01',NULL),
 (1006,40,'LINUX','2025-08-15',NULL);
