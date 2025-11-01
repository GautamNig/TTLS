-- schema.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

DROP TABLE IF EXISTS user_positions CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS get_or_create_user_position CASCADE;
DROP FUNCTION IF EXISTS update_user_position CASCADE;
DROP FUNCTION IF EXISTS mark_user_offline_by_email CASCADE;
DROP FUNCTION IF EXISTS reset_user_positions CASCADE;

CREATE TABLE user_positions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL,
  email CITEXT NOT NULL UNIQUE,
  initial_x FLOAT NOT NULL DEFAULT random(),
  initial_y FLOAT NOT NULL DEFAULT random(),
  current_x FLOAT NOT NULL DEFAULT 0.5,
  current_y FLOAT NOT NULL DEFAULT 0.5,
  luminosity FLOAT NOT NULL DEFAULT 0.8,
  is_online BOOLEAN NOT NULL DEFAULT true,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE user_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view positions" ON user_positions FOR SELECT USING (true);
CREATE POLICY "Users can insert" ON user_positions FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update" ON user_positions FOR UPDATE USING (true);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_user_positions_updated_at
  BEFORE UPDATE ON user_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- get or create (email based)
CREATE OR REPLACE FUNCTION get_or_create_user_position(
  p_user_id UUID,
  p_email TEXT
) RETURNS user_positions AS $$
DECLARE
  r user_positions%ROWTYPE;
  nx FLOAT := random();
  ny FLOAT := random();
BEGIN
  p_email := lower(p_email);
  INSERT INTO user_positions (user_id, email, initial_x, initial_y, current_x, current_y, is_online, luminosity, last_seen)
  VALUES (p_user_id, p_email, nx, ny, nx, ny, true, 1.0, now())
  ON CONFLICT (email) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        is_online = true,
        luminosity = 1.0,
        last_seen = now(),
        updated_at = now()
  RETURNING * INTO r;
  RETURN r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- update position
CREATE OR REPLACE FUNCTION update_user_position(
  p_email TEXT,
  p_x FLOAT,
  p_y FLOAT
) RETURNS VOID AS $$
BEGIN
  p_email := lower(p_email);
  UPDATE user_positions
  SET current_x = p_x,
      current_y = p_y,
      last_seen = now(),
      updated_at = now(),
      is_online = true
  WHERE email = p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- mark offline (called by service-role client)
CREATE OR REPLACE FUNCTION mark_user_offline_by_email(user_email TEXT)
RETURNS VOID AS $$
BEGIN
  user_email := lower(user_email);
  UPDATE user_positions
  SET is_online = false,
      luminosity = 0.1,
      last_seen = now(),
      updated_at = now()
  WHERE email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- reset helper
CREATE OR REPLACE FUNCTION reset_user_positions()
RETURNS VOID AS $$
BEGIN
  UPDATE user_positions
  SET current_x = initial_x,
      current_y = initial_y,
      updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- publication for realtime
ALTER TABLE user_positions REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname='public' AND tablename='user_positions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_positions';
  END IF;
END$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON user_positions TO postgres, service_role;
GRANT SELECT ON user_positions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON user_positions TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_user_position(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_position(TEXT, FLOAT, FLOAT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_user_offline_by_email(TEXT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION reset_user_positions() TO authenticated;


SELECT email, is_online, current_x, current_y, updated_at FROM user_positions;
