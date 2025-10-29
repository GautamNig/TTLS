-- TTLS Database Schema
-- This file sets up the complete database structure for the TTLS application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_positions table to store user locations and luminosity
CREATE TABLE IF NOT EXISTS user_positions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    relative_x FLOAT NOT NULL DEFAULT 0.5,
    relative_y FLOAT NOT NULL DEFAULT 0.5,
    luminosity FLOAT NOT NULL DEFAULT 0.5,
    screen_width INTEGER,
    screen_height INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_positions_user_id ON user_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_positions_email ON user_positions(email);
CREATE INDEX IF NOT EXISTS idx_user_positions_created_at ON user_positions(created_at);
CREATE INDEX IF NOT EXISTS idx_user_positions_updated_at ON user_positions(updated_at);

-- Enable Row Level Security
ALTER TABLE user_positions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Allow anyone to view all user positions (for the night sky visualization)
DROP POLICY IF EXISTS "Anyone can view user positions" ON user_positions;
CREATE POLICY "Anyone can view user positions" ON user_positions
    FOR SELECT USING (true);

-- Allow users to insert their own position
DROP POLICY IF EXISTS "Users can insert their own position" ON user_positions;
CREATE POLICY "Users can insert their own position" ON user_positions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own position
DROP POLICY IF EXISTS "Users can update their own position" ON user_positions;
CREATE POLICY "Users can update their own position" ON user_positions
    FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete their own position
DROP POLICY IF EXISTS "Users can delete their own position" ON user_positions;
CREATE POLICY "Users can delete their own position" ON user_positions
    FOR DELETE USING (auth.uid() = user_id);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at when a row is modified
DROP TRIGGER IF EXISTS update_user_positions_updated_at ON user_positions;
CREATE TRIGGER update_user_positions_updated_at
    BEFORE UPDATE ON user_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to get total user count
CREATE OR REPLACE FUNCTION get_user_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM user_positions);
END;
$$ LANGUAGE plpgsql;

-- Function to get active users (last 24 hours)
CREATE OR REPLACE FUNCTION get_active_users_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM user_positions WHERE updated_at >= NOW() - INTERVAL '24 hours');
END;
$$ LANGUAGE plpgsql;

-- View for active users (last 24 hours)
CREATE OR REPLACE VIEW active_users AS
SELECT 
    user_id,
    email,
    relative_x,
    relative_y,
    luminosity,
    updated_at
FROM user_positions
WHERE updated_at >= NOW() - INTERVAL '24 hours';

-- Function to clean up old positions (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_positions()
RETURNS void AS $$
BEGIN
    DELETE FROM user_positions 
    WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant table permissions
GRANT ALL ON user_positions TO postgres, service_role;
GRANT SELECT ON user_positions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON user_positions TO authenticated;

-- Grant sequence permissions
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION get_user_count() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_active_users_count() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_positions() TO service_role;

-- Grant view permissions
GRANT SELECT ON active_users TO anon, authenticated;

-- Insert sample test data for development
INSERT INTO user_positions (user_id, email, relative_x, relative_y, luminosity, screen_width, screen_height) VALUES
    ('11111111-1111-1111-1111-111111111111', 'test_user_1@example.com', 0.2, 0.3, 0.8, 1920, 1080),
    ('22222222-2222-2222-2222-222222222222', 'test_user_2@example.com', 0.7, 0.5, 0.6, 1920, 1080),
    ('33333333-3333-3333-3333-333333333333', 'test_user_3@example.com', 0.4, 0.8, 0.9, 1920, 1080),
    ('44444444-4444-4444-4444-444444444444', 'test_user_4@example.com', 0.1, 0.6, 0.7, 1920, 1080),
    ('55555555-5555-5555-5555-555555555555', 'test_user_5@example.com', 0.9, 0.2, 0.5, 1920, 1080)
ON CONFLICT (user_id) DO NOTHING;

-- Create a function to handle new user signups
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
    -- When a new user signs up via Supabase Auth, automatically create a position for them
    INSERT INTO public.user_positions (user_id, email, relative_x, relative_y, luminosity, screen_width, screen_height)
    VALUES (
        NEW.id,
        NEW.email,
        random() * 0.8 + 0.1,  -- random x between 0.1 and 0.9
        random() * 0.8 + 0.1,  -- random y between 0.1 and 0.9
        random() * 0.4 + 0.3,  -- random luminosity between 0.3 and 0.7
        1920,                  -- default screen width
        1080                   -- default screen height
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: The trigger for handle_new_user would need to be set up in the Supabase dashboard
-- for the auth.users table. This is just the function definition.

-- Output confirmation message
DO $$ 
BEGIN
    RAISE NOTICE '🎉 TTLS Database Schema Setup Complete!';
    RAISE NOTICE '📊 Tables created: user_positions';
    RAISE NOTICE '🔐 RLS Policies: View(all), Insert/Update/Delete(own)';
    RAISE NOTICE '📈 Sample data: 5 test users inserted';
    RAISE NOTICE '⚡ Indexes: user_id, email, timestamps';
    RAISE NOTICE '🕒 Auto-update: updated_at trigger active';
END $$;