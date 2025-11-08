// src/hooks/useAuth.js
import { useEffect, useRef, useState } from "react";
import { supabase, supabaseService } from "../supabaseClient";

/**
 * Authentication hook for managing user session and online status
 * 
 * @returns {Object} Auth state and methods
 * @returns {Object} return.user - Current authenticated user
 * @returns {Function} return.setUser - Set user state
 * @returns {boolean} return.loading - Authentication loading state
 * @returns {Function} return.setLoading - Set loading state
 * @returns {Object} return.isSigningOutRef - Ref to track sign-out state
 * @returns {Object} return.hasSentJoinMessageRef - Ref to track join message
 * @returns {Function} return.markUserOnline - Mark user as online in database
 * @returns {Function} return.markUserOfflineViaService - Mark user as offline
 * @returns {Function} return.sendSystemMessage - Send system chat message
 */

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const isSigningOutRef = useRef(false);
  const hasSentJoinMessageRef = useRef(false);

  // System message function
  const sendSystemMessage = async (content, type = 'info') => {
    try {
      await supabase
        .from('chat_messages')
        .insert({
          sender_email: 'system',
          sender_id: '00000000-0000-0000-0000-000000000000',
          content: content,
          type: type,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error sending system message:', error);
    }
  };

  // Mark user online function - NOTE: This needs fetchAllUsers from App.jsx
  const markUserOnline = async (authUser, fetchAllUsers) => {
    try {
      const email = (authUser.email || "").toLowerCase();
      const { error } = await supabase.rpc("get_or_create_user_position", {
        p_user_id: authUser.id,
        p_email: email,
      });
      if (error) throw error;
      
      // fetchAllUsers will be passed from App.jsx
      if (fetchAllUsers) {
        await fetchAllUsers();
      }

      if (!hasSentJoinMessageRef.current) {
        await sendSystemMessage(`${authUser.email} joined the chat`, 'join');
        hasSentJoinMessageRef.current = true;
      }
    } catch (e) {
      console.error("markUserOnline error", e);
    }
  };

  // Mark user offline function - NOTE: This needs fetchAllUsers from App.jsx
  const markUserOfflineViaService = async (email, fetchAllUsers) => {
    try {
      await supabaseService.rpc("mark_user_offline_by_email", { user_email: email });
      
      // fetchAllUsers will be passed from App.jsx
      if (fetchAllUsers) {
        await fetchAllUsers();
      }
    } catch (e) {
      console.error("markUserOfflineViaService error", e);
    }
  };

  return {
    user,
    setUser,
    loading,
    setLoading,
    isSigningOutRef,
    hasSentJoinMessageRef,
    markUserOnline,
    markUserOfflineViaService,
    sendSystemMessage
  };
}