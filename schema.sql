-- TTLS Database Setup - simple, robust
-- Run: npx supabase db reset --linked

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

DROP TABLE IF EXISTS user_positions CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS reset_user_positions CASCADE;
DROP FUNCTION IF EXISTS get_or_create_user_position CASCADE;
DROP FUNCTION IF EXISTS mark_user_offline_by_email CASCADE;

CREATE TABLE user_positions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL,
  email CITEXT NOT NULL,
  initial_x FLOAT NOT NULL DEFAULT 0.5,
  initial_y FLOAT NOT NULL DEFAULT 0.5,
  current_x FLOAT NOT NULL DEFAULT 0.5,
  current_y FLOAT NOT NULL DEFAULT 0.5,
  luminosity FLOAT NOT NULL DEFAULT 0.5,
  is_online BOOLEAN DEFAULT true,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(email)
);

CREATE INDEX idx_user_positions_user_id ON user_positions(user_id);
CREATE INDEX idx_user_positions_email ON user_positions(email);

ALTER TABLE user_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view user positions" ON user_positions
  FOR SELECT USING (true);

CREATE POLICY "Users can insert positions" ON user_positions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update positions" ON user_positions
  FOR UPDATE USING (true);

CREATE OR REPLACE FUNCTION update_user_position(
  p_email TEXT,
  p_x FLOAT,
  p_y FLOAT
)
RETURNS void AS $$
BEGIN
  p_email := lower(p_email);
  UPDATE user_positions
  SET current_x = p_x,
      current_y = p_y,
      updated_at = now()
  WHERE email = p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_user_position(TEXT, FLOAT, FLOAT) TO authenticated;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_positions_updated_at
  BEFORE UPDATE ON user_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION get_or_create_user_position(
  p_user_id UUID,
  p_email TEXT
) RETURNS user_positions AS $$
DECLARE
  new_x FLOAT := random();
  new_y FLOAT := random();
  result_row user_positions%ROWTYPE;
BEGIN
  p_email := lower(p_email);

  INSERT INTO user_positions (
    user_id, email, initial_x, initial_y, current_x, current_y, is_online, luminosity
  )
  VALUES (
    p_user_id, p_email, new_x, new_y, new_x, new_y, true, 1.0
  )
  ON CONFLICT (email) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    is_online = true,
    luminosity = 1.0,
    last_seen = now(),
    current_x = user_positions.current_x,
    current_y = user_positions.current_y,
    updated_at = now()
  RETURNING * INTO result_row;

  RETURN result_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION reset_user_positions()
RETURNS void AS $$
BEGIN
  UPDATE user_positions
  SET current_x = initial_x, current_y = initial_y, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_user_offline_by_email(user_email TEXT)
RETURNS void AS $$
BEGIN
  user_email := lower(user_email);
  UPDATE user_positions
  SET is_online = false, luminosity = 0.1, last_seen = now(), updated_at = now()
  WHERE email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure publication exists and table is added (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END$$;

ALTER TABLE user_positions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_positions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_positions';
  END IF;
END$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON user_positions TO postgres, service_role;
GRANT SELECT ON user_positions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON user_positions TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_user_position(UUID, TEXT) TO authenticated
