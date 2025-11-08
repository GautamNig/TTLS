// src/hooks/useFriends.js
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function useFriends(user, privateMessages, setPrivateMessages) {
  const [friends, setFriends] = useState([]);
  const [recentFriendships, setRecentFriendships] = useState([]);

  useEffect(() => {
    if (user) {
      fetchFriends();
    }
  }, [user]);

  // Realtime subscription for friendship glow
  useEffect(() => {
    const friendshipChannel = supabase
      .channel("friendship_events_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "friendship_events" },
        (payload) => {
          const { user1, user2 } = payload.new;
          const timestamp = Date.now();
          setRecentFriendships((prev) => [
            ...prev,
            { user1, user2, timestamp },
          ]);
          setTimeout(() => {
            setRecentFriendships((prev) =>
              prev.filter((f) => f.timestamp !== timestamp)
            );
          }, 5000);

          // Refresh friends list when new friendship is detected
          fetchFriends();
        }
      )
      .subscribe((status) =>
        console.log("Realtime friendship event status:", status)
      );

    return () => {
      supabase.removeChannel(friendshipChannel);
    };
  }, []);

  async function fetchFriends() {
    if (!user) return;
    console.log('🔄 fetchFriends called for user:', user.id, user.email);

    try {
      const { data, error } = await supabase.rpc('get_mutual_friends', { user_uuid: user.id });

      if (error) {
        console.error('❌ fetchFriends RPC error:', error);
        throw error;
      }

      console.log('✅ fetchFriends result:', {
        user: user.id,
        friendsCount: data?.length || 0,
        friends: data
      });

      setFriends(data || []);

      // Fetch existing private messages for each friend
      if (data && data.length > 0) {
        data.forEach(friend => {
          console.log('📨 Fetching private messages for friend:', friend.friend_id);
          fetchPrivateMessages(friend.friend_id);
        });
      } else {
        console.log('ℹ️ No friends found for user');
      }

    } catch (err) {
      console.error("fetchFriends error:", err);
    }
  }

  async function fetchPrivateMessages(friendId) {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('private_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setPrivateMessages(prev => ({
        ...prev,
        [friendId]: data || []
      }));
    } catch (err) {
      console.error("fetchPrivateMessages error:", err);
    }
  }

  return {
    friends,
    setFriends,
    recentFriendships,
    fetchFriends,
    fetchPrivateMessages
  };
}