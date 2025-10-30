-- TTLS Complete Database Setup - SIMPLIFIED VERSION
-- Run: npx supabase db reset --linked

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing objects if they exist
DROP TABLE IF EXISTS user_positions CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS reset_user_positions CASCADE;
DROP FUNCTION IF EXISTS mark_user_offline CASCADE;

-- Create user_positions table with initial and current positions
CREATE TABLE user_positions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    initial_x FLOAT NOT NULL DEFAULT 0.5,
    initial_y FLOAT NOT NULL DEFAULT 0.5,
    current_x FLOAT NOT NULL DEFAULT 0.5,
    current_y FLOAT NOT NULL DEFAULT 0.5,
    luminosity FLOAT NOT NULL DEFAULT 0.5,
    is_online BOOLEAN DEFAULT true,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX idx_user_positions_user_id ON user_positions(user_id);
CREATE INDEX idx_user_positions_is_online ON user_positions(is_online);
CREATE INDEX idx_user_positions_last_seen ON user_positions(last_seen);

-- Enable Row Level Security
ALTER TABLE user_positions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view user positions" ON user_positions
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own position" ON user_positions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own position" ON user_positions
    FOR UPDATE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_user_positions_updated_at
    BEFORE UPDATE ON user_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to mark user as offline
CREATE OR REPLACE FUNCTION mark_user_offline(user_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE user_positions 
    SET 
        is_online = false, 
        luminosity = 0.1,
        last_seen = NOW()
    WHERE user_id = user_uuid;
    
    -- Check if any rows were affected
    IF NOT FOUND THEN
        RAISE NOTICE 'No user found with ID: %', user_uuid;
    ELSE
        RAISE NOTICE 'Successfully marked user % as offline', user_uuid;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to reset all positions (for debugging)
CREATE OR REPLACE FUNCTION reset_user_positions()
RETURNS void AS $$
BEGIN
    UPDATE user_positions 
    SET 
        current_x = initial_x,
        current_y = initial_y,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Enable real-time
ALTER TABLE user_positions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE user_positions;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON user_positions TO postgres, service_role;
GRANT SELECT ON user_positions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON user_positions TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT EXECUTE ON FUNCTION reset_user_positions() TO authenticated;
GRANT EXECUTE ON FUNCTION mark_user_offline(UUID) TO authenticated;

SELECT 'TTLS Database Setup Complete - Ready for real-time users' AS result;