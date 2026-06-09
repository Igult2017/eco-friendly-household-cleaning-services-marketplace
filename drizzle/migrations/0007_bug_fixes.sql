-- Add Stripe customer ID to users for off-session recurring payments
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100);

-- Add saved payment method + timezone to recurring schedules
ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS stripe_payment_method_id VARCHAR(100);
ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Europe/Amsterdam';

-- New notification types for rescheduling, service start, and recurring bookings
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'booking_rescheduled';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'booking_started';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'recurring_booking_created';
