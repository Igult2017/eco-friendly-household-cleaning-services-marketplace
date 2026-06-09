-- Remove the EU-specific default from providers.country.
-- The column remains NOT NULL; country must now be supplied explicitly during onboarding.
-- This supports both European and USA markets without a EU-biased fallback.
ALTER TABLE providers ALTER COLUMN country DROP DEFAULT;
