-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table to broadcast new friendships for real-time sync
CREATE TABLE friendship_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1 UUID NOT NULL,
  user2 UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable realtime
ALTER TABLE friendship_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE friendship_events;

-- Allow everyone to see it
ALTER TABLE friendship_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view friendship events" ON friendship_events
  FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert friendship events" ON friendship_events
  FOR INSERT WITH CHECK (true);


-- Create user_positions table
CREATE TABLE user_positions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,  -- ✅ make it UNIQUE
    email TEXT NOT NULL UNIQUE,
    initial_x FLOAT DEFAULT (random()),
    initial_y FLOAT DEFAULT (random()),
    current_x FLOAT,
    current_y FLOAT,
    luminosity FLOAT DEFAULT 0.8,
    is_online BOOLEAN DEFAULT true,
    is_twinkle BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);


-- Create chat_messages table
CREATE TABLE chat_messages (
    id BIGSERIAL PRIMARY KEY,
    sender_id UUID NOT NULL,
    sender_email TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable real-time for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE user_positions;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- Create indexes for performance
CREATE INDEX idx_user_positions_email ON user_positions(email);
CREATE INDEX idx_user_positions_online ON user_positions(is_online);
CREATE INDEX idx_user_positions_last_seen ON user_positions(last_seen DESC);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX idx_chat_messages_type ON chat_messages(type);

-- =========================================
-- FOLLOW SYSTEM
-- =========================================
CREATE TABLE user_follows (
    id BIGSERIAL PRIMARY KEY,
    follower_id UUID NOT NULL REFERENCES user_positions(user_id) ON DELETE CASCADE,
    followee_id UUID NOT NULL REFERENCES user_positions(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (follower_id, followee_id)
);


-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE user_follows;

-- Index for faster lookups
CREATE INDEX idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_user_follows_followee ON user_follows(followee_id);

-- RLS
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view follows" ON user_follows
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert follows" ON user_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- =========================================
-- FUNCTIONS
-- =========================================

-- Add a follow
CREATE OR REPLACE FUNCTION follow_user(p_follower UUID, p_followee UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO user_follows(follower_id, followee_id)
  VALUES (p_follower, p_followee)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Check if mutual follow (friendship)
CREATE OR REPLACE FUNCTION check_friendship(p_user1 UUID, p_user2 UUID)
RETURNS BOOLEAN
LANGUAGE sql
AS $$
  SELECT EXISTS(
    SELECT 1 FROM user_follows a
    JOIN user_follows b
      ON a.follower_id = b.followee_id
     AND a.followee_id = b.follower_id
    WHERE a.follower_id = p_user1
      AND a.followee_id = p_user2
  );
$$;

-- Enable RLS
ALTER TABLE user_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_positions
CREATE POLICY "Allow all operations for authenticated users" ON user_positions
    FOR ALL USING (true);

-- RLS Policies for chat_messages
CREATE POLICY "Allow insert for all users" ON chat_messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow read for all users" ON chat_messages
    FOR SELECT USING (true);

-- Functions for user management
CREATE OR REPLACE FUNCTION get_or_create_user_position(p_user_id UUID, p_email TEXT)
RETURNS SETOF user_positions
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO user_positions (user_id, email, is_online, last_seen, luminosity)
    VALUES (p_user_id, p_email, true, NOW(), 0.8)
    ON CONFLICT (email) 
    DO UPDATE SET 
        is_online = true,
        last_seen = NOW(),
        luminosity = 0.8
    WHERE user_positions.email = p_email;
    
    RETURN QUERY SELECT * FROM user_positions WHERE email = p_email;
END;
$$;

CREATE OR REPLACE FUNCTION mark_user_offline_by_email(user_email TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE user_positions 
    SET is_online = false, luminosity = 0.1, last_seen = NOW()
    WHERE email = user_email;
END;
$$;

CREATE OR REPLACE FUNCTION update_user_position(p_email TEXT, p_x FLOAT, p_y FLOAT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE user_positions 
    SET current_x = p_x, current_y = p_y, last_seen = NOW()
    WHERE email = p_email;
END;
$$;

-- Auto-clean offline users after 5 minutes
CREATE OR REPLACE FUNCTION clean_offline_users()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM user_positions 
    WHERE is_online = false 
    AND last_seen < NOW() - INTERVAL '5 minutes';
END;
$$;

GRANT EXECUTE ON FUNCTION follow_user(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_friendship(UUID, UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION cleanup_old_friendships()
RETURNS void AS $$
BEGIN
  DELETE FROM friendship_events WHERE created_at < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql;



-- Create a cron job to clean offline users (optional - run manually or set up pg_cron)
-- SELECT cron.schedule('clean-offline-users', '*/5 * * * *', 'SELECT clean_offline_users()');