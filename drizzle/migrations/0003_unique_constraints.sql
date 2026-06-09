-- Prevent duplicate payout transfers (Inngest retry safety)
CREATE UNIQUE INDEX IF NOT EXISTS payouts_transfer_idx
  ON payouts (stripe_transfer_id)
  WHERE stripe_transfer_id IS NOT NULL;

-- Prevent double-booking: same provider cannot have two bookings at the exact same start time
CREATE UNIQUE INDEX IF NOT EXISTS bookings_provider_scheduled_idx
  ON bookings (provider_id, scheduled_at);
