-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geography column to providers for geo search
ALTER TABLE providers ADD COLUMN IF NOT EXISTS location geography(Point, 4326);
CREATE INDEX IF NOT EXISTS providers_location_gist ON providers USING GIST(location);

-- Add geography column to job_posts for job proximity search
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS service_location geography(Point, 4326);
CREATE INDEX IF NOT EXISTS job_posts_location_gist ON job_posts USING GIST(service_location);

-- Trigger: keep providers.location in sync with lat/lng columns
CREATE OR REPLACE FUNCTION sync_provider_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location = ST_SetSRID(
      ST_MakePoint(NEW.longitude, NEW.latitude),
      4326
    )::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER provider_location_sync
BEFORE INSERT OR UPDATE ON providers
FOR EACH ROW EXECUTE FUNCTION sync_provider_location();

-- Trigger: keep job_posts.service_location in sync
CREATE OR REPLACE FUNCTION sync_job_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.service_latitude IS NOT NULL AND NEW.service_longitude IS NOT NULL THEN
    NEW.service_location = ST_SetSRID(
      ST_MakePoint(NEW.service_longitude, NEW.service_latitude),
      4326
    )::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER job_location_sync
BEFORE INSERT OR UPDATE ON job_posts
FOR EACH ROW EXECUTE FUNCTION sync_job_location();
