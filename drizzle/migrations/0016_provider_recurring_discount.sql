-- Cleaner-set loyalty discount (%) applied to their recurring bookings.
ALTER TABLE providers ADD COLUMN IF NOT EXISTS recurring_discount_pct integer NOT NULL DEFAULT 0;
