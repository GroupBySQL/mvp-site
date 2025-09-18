-- Challenge: OS share by customer (latest active key)
-- Return: customer_id, customer_os in ('Windows','Linux','Both','None')
-- Rules:
--  - One active key per account (active_to IS NULL). Keep the latest by active_from.
--  - Normalize OS strings (win* -> Windows, linux*/ubuntu/debian -> Linux).
--  - Roll up across a customer's accounts: Both if they have at least one Windows AND one Linux; None if no active keys.
SELECT /* your solution here */ ;
