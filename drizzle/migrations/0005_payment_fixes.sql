-- Bug 2: pending_capture status for bookings awaiting Inngest payment capture
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending_capture';

-- Bug 9: cancelled status for authorized payments that are voided (no charge)
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Bug 3: link each payment row to the payout that settled it; used to prevent double-payout on Inngest retry
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES payouts(id);
CREATE INDEX IF NOT EXISTS payments_payout_idx ON payments (payout_id);
