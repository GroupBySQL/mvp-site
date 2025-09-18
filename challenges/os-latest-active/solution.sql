WITH latest AS (
  SELECT
    k.account_id,
    CASE
      WHEN LOWER(k.os_raw) LIKE '%win%'            THEN 'Windows'
      WHEN LOWER(k.os_raw) LIKE '%linux%'          THEN 'Linux'
      WHEN LOWER(k.os_raw) LIKE '%ubuntu%'         THEN 'Linux'
      WHEN LOWER(k.os_raw) LIKE '%debian%'         THEN 'Linux'
      ELSE NULL
    END AS os_clean,
    ROW_NUMBER() OVER (PARTITION BY k.account_id ORDER BY k.active_from DESC) AS rn
  FROM keys k
  WHERE k.active_to IS NULL
),
acct AS (
  SELECT
    account_id,
    CASE WHEN os_clean IS NULL THEN 'None' ELSE os_clean END AS account_os
  FROM latest
  WHERE rn = 1
),
cust AS (
  SELECT
    c.customer_id,
    CASE
      WHEN SUM(CASE WHEN acct.account_os='Windows' THEN 1 END) > 0
       AND SUM(CASE WHEN acct.account_os='Linux'   THEN 1 END) > 0 THEN 'Both'
      WHEN SUM(CASE WHEN acct.account_os='Windows' THEN 1 END) > 0 THEN 'Windows'
      WHEN SUM(CASE WHEN acct.account_os='Linux'   THEN 1 END) > 0 THEN 'Linux'
      ELSE 'None'
    END AS customer_os
  FROM customers c
  LEFT JOIN accounts a ON a.customer_id = c.customer_id
  LEFT JOIN acct       ON acct.account_id = a.account_id
  GROUP BY c.customer_id
)
SELECT customer_id, customer_os
FROM cust
ORDER BY customer_id;
