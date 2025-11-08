// src/hooks/useUsers.js
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { APP_CONSTANTS } from "../constants/appConstants";

/**
 * Hook for managing users state, real-time positions, and following system
 * 
 * @param {Object} user - Current authenticated user
 * @returns {Object} Users state and methods
 * @returns {Array} return.users - Array of all users with positions
 * @returns {Function} return.setUsers - Update users state
 * @returns {Array} return.followingList - Array of followed user IDs
 * @returns {Function} return.setFollowingList - Update following list
 * @returns {Function} return.fetchAllUsers - Fetch all users from database
 * @returns {Function} return.fetchFollowingList - Fetch user's following list
 */

export default function useUsers(user) {
  const [users, setUsers] = useState([]);
  const [followingList, setFollowingList] = useState([]);

  // Define fetchAllUsers FIRST
  const fetchAllUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("user_positions").select("*");
      if (error) throw error;
      setUsers(data || []);
    } catch (e) {
      console.error("fetchAllUsers error", e);
    }
  }, []);

  // Define fetchFollowingList SECOND
  const fetchFollowingList = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("user_follows")
        .select("followee_id")
        .eq("follower_id", user.id);
      if (error) throw error;
      setFollowingList(data.map((d) => d.followee_id));
    } catch (err) {
      console.error("fetchFollowingList error:", err);
    }
  }, [user]);

  // NOW use them in useEffect
  useEffect(() => {
    fetchAllUsers();
    if (user) {
      fetchFollowingList();
    }
  }, [user, fetchAllUsers, fetchFollowingList]);

  // Realtime subscription for user positions
  useEffect(() => {
    const channel = supabase
      .channel(APP_CONSTANTS.CHANNELS.USER_POSITIONS)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_positions" },
        (payload) => {
          console.log("🔄 Real-time user update received:", payload);
          const row = payload.new;
          if (!row) return;
          setUsers((prev) => {
            const email = (row.email || "").toLowerCase();
            const idx = prev.findIndex((p) => (p.email || "").toLowerCase() === email);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...row };
              return copy;
            } else {
              return [...prev, row];
            }
          });
        }
      )
      .subscribe((status) => console.log("Realtime status:", status));

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👀 Tab became visible, refreshing users...');
        fetchAllUsers();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchAllUsers]);

  return {
    users,
    setUsers,
    followingList,
    setFollowingList,
    fetchAllUsers,
    fetchFollowingList
  };
}