-- PostGIS geography columns and sync triggers.
-- Wrapped in exception-safe DO blocks so this migration succeeds even when
-- the postgis extension package is not installed on the database server.
-- Geo search simply falls back to lat/lng distance calculation in that case.

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS postgis;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '[0001] PostGIS not available, skipping: %', SQLERRM;
END $$;

DO $$
BEGIN
  ALTER TABLE providers ADD COLUMN IF NOT EXISTS location geography(Point, 4326);
  CREATE INDEX IF NOT EXISTS providers_location_gist ON providers USING GIST(location);
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '[0001] Could not add providers.location column: %', SQLERRM;
END $$;

DO $$
BEGIN
  ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS service_location geography(Point, 4326);
  CREATE INDEX IF NOT EXISTS job_posts_location_gist ON job_posts USING GIST(service_location);
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '[0001] Could not add job_posts.service_location column: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE OR REPLACE FUNCTION sync_provider_location()
  RETURNS TRIGGER AS $fn$
  BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
      NEW.location = ST_SetSRID(
        ST_MakePoint(NEW.longitude, NEW.latitude),
        4326
      )::geography;
    END IF;
    RETURN NEW;
  END;
  $fn$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS provider_location_sync ON providers;
  CREATE TRIGGER provider_location_sync
  BEFORE INSERT OR UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION sync_provider_location();
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '[0001] Could not create provider location trigger: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE OR REPLACE FUNCTION sync_job_location()
  RETURNS TRIGGER AS $fn$
  BEGIN
    IF NEW.service_latitude IS NOT NULL AND NEW.service_longitude IS NOT NULL THEN
      NEW.service_location = ST_SetSRID(
        ST_MakePoint(NEW.service_longitude, NEW.service_latitude),
        4326
      )::geography;
    END IF;
    RETURN NEW;
  END;
  $fn$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS job_location_sync ON job_posts;
  CREATE TRIGGER job_location_sync
  BEFORE INSERT OR UPDATE ON job_posts
  FOR EACH ROW EXECUTE FUNCTION sync_job_location();
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '[0001] Could not create job_posts location trigger: %', SQLERRM;
END $$;
