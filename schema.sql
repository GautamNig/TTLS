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
  -- Check if users are different
  IF p_follower = p_followee THEN
    RAISE EXCEPTION 'Cannot follow yourself';
  END IF;
  
  -- Insert the follow relationship (rely on foreign key constraints)
  INSERT INTO user_follows(follower_id, followee_id)
  VALUES (p_follower, p_followee)
  ON CONFLICT (follower_id, followee_id) DO NOTHING;
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

-- Add this function to your schema.sql
CREATE OR REPLACE FUNCTION update_room_slots(room_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE chat_rooms 
    SET current_slots = (
        SELECT COUNT(*) 
        FROM user_room_memberships 
        WHERE room_id = chat_rooms.id
    ),
    updated_at = NOW()
    WHERE id = room_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_room_slots(UUID) TO anon, authenticated;

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

-- Add this to your existing schema.sql
-- Private messages table
-- Recreate the table with all policies
CREATE TABLE private_messages (
    id BIGSERIAL PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES user_positions(user_id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES user_positions(user_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    is_read BOOLEAN DEFAULT false
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE private_messages;

-- Indexes for performance
CREATE INDEX idx_private_messages_sender_receiver ON private_messages(sender_id, receiver_id);
CREATE INDEX idx_private_messages_receiver_sender ON private_messages(receiver_id, sender_id);
CREATE INDEX idx_private_messages_created_at ON private_messages(created_at DESC);

-- RLS Policies for private messages
ALTER TABLE private_messages ENABLE ROW LEVEL SECURITY;

-- UPDATE: Users can update messages they received (mark as read)
CREATE POLICY "Users can update their received messages" ON private_messages
    FOR UPDATE USING (auth.uid() = receiver_id);

CREATE POLICY "Users can view their private messages" ON private_messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send private messages" ON private_messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Replace the get_mutual_friends function with this SIMPLE version
DROP FUNCTION IF EXISTS get_mutual_friends(UUID);

CREATE OR REPLACE FUNCTION get_mutual_friends(user_uuid UUID)
RETURNS TABLE (
    friend_id UUID,
    friend_email TEXT,
    is_online BOOLEAN
) 
LANGUAGE sql
AS $$
    -- Simple approach: Find pairs where both users follow each other
    SELECT 
        CASE 
            WHEN uf1.follower_id = user_uuid THEN uf1.followee_id
            ELSE uf1.follower_id
        END as friend_id,
        up.email as friend_email,
        up.is_online
    FROM user_follows uf1
    JOIN user_follows uf2 ON 
        uf1.follower_id = uf2.followee_id 
        AND uf1.followee_id = uf2.follower_id
    JOIN user_positions up ON (
        CASE 
            WHEN uf1.follower_id = user_uuid THEN uf1.followee_id
            ELSE uf1.follower_id
        END
    ) = up.user_id
    WHERE (uf1.follower_id = user_uuid OR uf1.followee_id = user_uuid);
$$;

-- Add this to schema.sql for data consistency
CREATE OR REPLACE FUNCTION cleanup_orphaned_user_data()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Delete follows where either user doesn't exist
    DELETE FROM user_follows 
    WHERE follower_id NOT IN (SELECT user_id FROM user_positions)
       OR followee_id NOT IN (SELECT user_id FROM user_positions);
    
    -- Delete private messages where either user doesn't exist
    DELETE FROM private_messages 
    WHERE sender_id NOT IN (SELECT user_id FROM user_positions)
       OR receiver_id NOT IN (SELECT user_id FROM user_positions);
    
    -- Delete chat messages where user doesn't exist
    DELETE FROM chat_messages 
    WHERE sender_id NOT IN (SELECT user_id FROM user_positions);
END;
$$;

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

-- Update the function to handle edge cases better
-- Update the function to handle edge cases better
CREATE OR REPLACE FUNCTION mark_private_messages_as_read(
    p_user_id UUID,
    p_friend_id UUID
)
RETURNS TABLE (updated_count INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    UPDATE private_messages 
    SET is_read = true
    WHERE receiver_id = p_user_id 
    AND sender_id = p_friend_id
    AND is_read = false;
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN QUERY SELECT affected_rows;
END;
$$;

-- Add this trigger function to automatically update room slots
CREATE OR REPLACE FUNCTION update_room_slots_on_membership_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update slots when membership is inserted
    IF TG_OP = 'INSERT' THEN
        UPDATE chat_rooms 
        SET current_slots = (
            SELECT COUNT(*) 
            FROM user_room_memberships 
            WHERE room_id = NEW.room_id
        )
        WHERE id = NEW.room_id;
    END IF;
    
    -- Update slots when membership is deleted  
    IF TG_OP = 'DELETE' THEN
        UPDATE chat_rooms 
        SET current_slots = (
            SELECT COUNT(*) 
            FROM user_room_memberships 
            WHERE room_id = OLD.room_id
        )
        WHERE id = OLD.room_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;



-- =========================================
-- ROOM SYSTEM TABLES (Phase 1 - Tables Only)
-- =========================================

-- Chat rooms table (optional feature - doesn't affect existing functionality)
CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES user_positions(user_id) ON DELETE CASCADE,
    max_slots INTEGER DEFAULT 10,
    current_slots INTEGER DEFAULT 1,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- User room membership table (optional feature)
CREATE TABLE IF NOT EXISTS user_room_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_positions(user_id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, room_id)
);

-- Room messages table (optional feature)
CREATE TABLE IF NOT EXISTS room_messages (
    id BIGSERIAL PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES user_positions(user_id) ON DELETE CASCADE,
    sender_email TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);


-- Create the trigger
DROP TRIGGER IF EXISTS room_slots_trigger ON user_room_memberships;
CREATE TRIGGER room_slots_trigger
    AFTER INSERT OR DELETE ON user_room_memberships
    FOR EACH ROW
    EXECUTE FUNCTION update_room_slots_on_membership_change();

-- Enable realtime for new tables (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE chat_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE user_room_memberships;
ALTER PUBLICATION supabase_realtime ADD TABLE room_messages;

-- Basic RLS policies for new tables (read-only for now)
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_room_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public chat rooms" ON chat_rooms
    FOR SELECT USING (is_public = true);
    
CREATE POLICY "Anyone can view room memberships" ON user_room_memberships
    FOR SELECT USING (true);
    
CREATE POLICY "Anyone can view room messages" ON room_messages
    FOR SELECT USING (true);

    -- Add these RLS policies to your schema.sql for the room tables

-- Allow authenticated users to create rooms
DROP POLICY IF EXISTS "Authenticated users can create rooms" ON chat_rooms;
CREATE POLICY "Authenticated users can create rooms" ON chat_rooms
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Allow room owners to update their rooms
DROP POLICY IF EXISTS "Room owners can update their rooms" ON chat_rooms;
CREATE POLICY "Room owners can update their rooms" ON chat_rooms
    FOR UPDATE USING (auth.uid() = owner_id);

-- Allow room owners to delete their rooms
DROP POLICY IF EXISTS "Room owners can delete their rooms" ON chat_rooms;
CREATE POLICY "Room owners can delete their rooms" ON chat_rooms
    FOR DELETE USING (auth.uid() = owner_id);

-- Allow users to join rooms (insert into memberships)
DROP POLICY IF EXISTS "Users can join rooms" ON user_room_memberships;
CREATE POLICY "Users can join rooms" ON user_room_memberships
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to leave rooms (delete from memberships)
DROP POLICY IF EXISTS "Users can leave rooms" ON user_room_memberships;
CREATE POLICY "Users can leave rooms" ON user_room_memberships
    FOR DELETE USING (auth.uid() = user_id);

-- Allow room members to send messages
DROP POLICY IF EXISTS "Room members can send messages" ON room_messages;
CREATE POLICY "Room members can send messages" ON room_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM user_room_memberships 
            WHERE user_id = auth.uid() AND room_id = room_messages.room_id
        )
    );

-- Add this to your schema.sql if not already there
DROP POLICY IF EXISTS "Room owners can update their rooms" ON chat_rooms;
CREATE POLICY "Room owners can update their rooms" ON chat_rooms
    FOR UPDATE USING (auth.uid() = owner_id);

-- Also add a policy for anyone to update current_slots (for slot counting)
DROP POLICY IF EXISTS "Anyone can update room slots" ON chat_rooms;
CREATE POLICY "Anyone can update room slots" ON chat_rooms
    FOR UPDATE USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_rooms_public ON chat_rooms(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_chat_rooms_created ON chat_rooms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_room_memberships_user ON user_room_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_room_memberships_room ON user_room_memberships(room_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_room_created ON room_messages(room_id, created_at DESC);

-- Add validation to prevent non-members from sending room messages
-- Add validation to prevent non-members from sending room messages
-- Add this function to prevent non-members from sending room messages
CREATE OR REPLACE FUNCTION validate_room_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the user is a member of the room they're trying to message
  IF NOT EXISTS (
    SELECT 1 FROM user_room_memberships 
    WHERE user_id = NEW.sender_id AND room_id = NEW.room_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of this room';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS room_message_membership_trigger ON room_messages;
CREATE TRIGGER room_message_membership_trigger
  BEFORE INSERT ON room_messages
  FOR EACH ROW
  EXECUTE FUNCTION validate_room_membership();

-- Create a secure function to send room messages
-- Create a secure function to send room messages with membership check
-- Update the send_room_message function to check bans
CREATE OR REPLACE FUNCTION send_room_message(
  p_room_id UUID,
  p_sender_id UUID,
  p_sender_email TEXT,
  p_content TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_member BOOLEAN;
  is_banned BOOLEAN;
BEGIN
  -- Check if user is banned
  SELECT EXISTS (
    SELECT 1 FROM room_bans 
    WHERE room_id = p_room_id 
    AND banned_user_id = p_sender_id
    AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO is_banned;

  IF is_banned THEN
    RETURN json_build_object('success', false, 'error', 'You are banned from this room');
  END IF;

  -- Check if user is a member
  SELECT EXISTS (
    SELECT 1 FROM user_room_memberships 
    WHERE user_id = p_sender_id 
    AND room_id = p_room_id
  ) INTO is_member;

  IF NOT is_member THEN
    RETURN json_build_object('success', false, 'error', 'You are not a member of this room');
  END IF;

  -- Insert the message
  INSERT INTO room_messages (room_id, sender_id, sender_email, content, type, created_at)
  VALUES (p_room_id, p_sender_id, p_sender_email, p_content, 'user', NOW());
  
  RETURN json_build_object('success', true);
EXCEPTION
  WHEN others THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION send_room_message TO authenticated, anon;

-- Allow room owners to kick any user from their room
DROP POLICY IF EXISTS "Room owners can kick users" ON user_room_memberships;
CREATE POLICY "Room owners can kick users" ON user_room_memberships
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM chat_rooms 
    WHERE chat_rooms.id = user_room_memberships.room_id 
    AND chat_rooms.owner_id = auth.uid()
  )
);

-- Create room bans table
CREATE TABLE room_bans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    banned_user_id UUID NOT NULL REFERENCES user_positions(user_id) ON DELETE CASCADE,
    banned_by_user_id UUID NOT NULL REFERENCES user_positions(user_id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(room_id, banned_user_id) -- Prevent duplicate bans
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE room_bans;

-- RLS Policies
ALTER TABLE room_bans ENABLE ROW LEVEL SECURITY;

-- Anyone can view bans
CREATE POLICY "Anyone can view room bans" ON room_bans
    FOR SELECT USING (true);

-- Room owners can manage bans
CREATE POLICY "Room owners can manage bans" ON room_bans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM chat_rooms 
            WHERE chat_rooms.id = room_bans.room_id 
            AND chat_rooms.owner_id = auth.uid()
        )
    );

-- Index for performance
CREATE INDEX idx_room_bans_room_user ON room_bans(room_id, banned_user_id);
CREATE INDEX idx_room_bans_expires ON room_bans(expires_at) WHERE expires_at IS NOT NULL;

CREATE OR REPLACE FUNCTION check_room_ban_before_join()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user is banned from this room
  IF EXISTS (
    SELECT 1 FROM room_bans 
    WHERE room_id = NEW.room_id 
    AND banned_user_id = NEW.user_id
    AND (expires_at IS NULL OR expires_at > NOW())
  ) THEN
    RAISE EXCEPTION 'User is banned from this room';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to prevent banned users from joining
DROP TRIGGER IF EXISTS prevent_banned_join ON user_room_memberships;
CREATE TRIGGER prevent_banned_join
  BEFORE INSERT ON user_room_memberships
  FOR EACH ROW
  EXECUTE FUNCTION check_room_ban_before_join();

-- Function to check if user is banned before sending messages
CREATE OR REPLACE FUNCTION check_room_ban_before_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user is banned from this room
  IF EXISTS (
    SELECT 1 FROM room_bans 
    WHERE room_id = NEW.room_id 
    AND banned_user_id = NEW.sender_id
    AND (expires_at IS NULL OR expires_at > NOW())
  ) THEN
    RAISE EXCEPTION 'User is banned from this room';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to prevent banned users from sending messages
DROP TRIGGER IF EXISTS prevent_banned_messages ON room_messages;
CREATE TRIGGER prevent_banned_messages
  BEFORE INSERT ON room_messages
  FOR EACH ROW
  EXECUTE FUNCTION check_room_ban_before_message();

-- Add constraint to prevent users from being in multiple rooms
-- First remove any existing duplicate memberships
DELETE FROM user_room_memberships 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY user_id 
    ) as rn 
    FROM user_room_memberships
  ) t WHERE t.rn > 1
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE user_room_memberships 
DROP CONSTRAINT IF EXISTS user_room_memberships_single_room;

ALTER TABLE user_room_memberships 
ADD CONSTRAINT user_room_memberships_single_room 
UNIQUE (user_id);

DELETE FROM user_room_memberships 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY user_id ORDER BY joined_at DESC
    ) as rn 
    FROM user_room_memberships
  ) t WHERE t.rn > 1
);