-- Provider → customer reviews (two-way reviews). One per booking.
CREATE TABLE IF NOT EXISTS customer_reviews (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID        NOT NULL REFERENCES bookings(id),
  provider_id UUID        NOT NULL REFERENCES providers(id),
  customer_id TEXT        NOT NULL REFERENCES users(id),
  rating      INTEGER     NOT NULL,
  body        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_reviews_booking_idx   ON customer_reviews(booking_id);
CREATE INDEX        IF NOT EXISTS customer_reviews_customer_idx  ON customer_reviews(customer_id);
CREATE INDEX        IF NOT EXISTS customer_reviews_provider_idx  ON customer_reviews(provider_id);
