-- Firm billing columns for evaluation → Boutique conversion (also applied on boot).
ALTER TABLE firms
  ADD COLUMN IF NOT EXISTS stripe_customer_id varchar,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id varchar,
  ADD COLUMN IF NOT EXISTS subscription_status varchar,
  ADD COLUMN IF NOT EXISTS subscription_plan varchar,
  ADD COLUMN IF NOT EXISTS subscription_seat_quantity integer,
  ADD COLUMN IF NOT EXISTS converted_at timestamp;
