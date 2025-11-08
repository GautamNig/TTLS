// src/utils/supabaseHelpers.js
import { supabase, supabaseService } from "../supabaseClient";

// Common Supabase operations that are used across multiple components
export const supabaseHelpers = {
  // User management
  async updateUserPosition(email, x, y) {
    try {
      const { error } = await supabase.rpc("update_user_position", { 
        p_email: email, 
        p_x: x, 
        p_y: y 
      });
      if (error) console.warn("update_user_position error", error);
    } catch (err) {
      console.warn("update_user_position exception", err);
    }
  },

  // Room management
  async sendRoomMessage(roomId, userId, userEmail, content) {
    try {
      await supabase
        .from('room_messages')
        .insert({
          room_id: roomId,
          sender_id: userId,
          sender_email: userEmail,
          content: content.trim(),
          type: 'user',
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error sending room message:', error);
    }
  },

  // Follow system
  async followUser(followerId, followeeId) {
    try {
      const { error } = await supabase.rpc('follow_user', {
        p_follower: followerId,
        p_followee: followeeId,
      });
      return { error };
    } catch (e) {
      return { error: e };
    }
  }
};