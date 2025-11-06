// src/App.jsx
import React, { useEffect, useRef, useState } from "react";
import { supabase, supabaseService } from "./supabaseClient";
import AuthPage from "./components/AuthPage";
import NightSky from "./components/NightSky";
import "./index.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [privateMessages, setPrivateMessages] = useState({}); // { friendId: [messages] }
  const [loading, setLoading] = useState(true);
  const [followingList, setFollowingList] = useState([]);
  const [recentFriendships, setRecentFriendships] = useState([]);
  const [friends, setFriends] = useState([]); // Mutual friends
  const [rooms, setRooms] = useState([]);
  const [currentUserRoom, setCurrentUserRoom] = useState(null);

  const isSigningOutRef = useRef(false);
  const driftRef = useRef({});
  const hasSentJoinMessageRef = useRef(false);

  // Initial session + auth listener
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        setUser(data.session.user);
        await markUserOnline(data.session.user);
      }
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🔐 Auth change:", event);
      if (event === "SIGNED_IN" && session?.user) {
        console.log("👤 Setting user state:", session.user.email);
        setUser(session.user);
        markUserOnline(session.user).catch((e) => console.error(e));

        // FIX: Wait for React to update the user state BEFORE loading room data
        setTimeout(async () => {
          console.log('🔄 Loading user data after sign in...');
          console.log('👤 Current user state:', user?.email); // Debug current state

          try {
            // Wait a bit more to ensure user state is updated
            await new Promise(resolve => setTimeout(resolve, 100));

            console.log('📥 Step 1: Fetching current user room...');
            const roomId = await fetchCurrentUserRoom(session.user);

            console.log('📥 Step 2: Fetching rooms...');
            const roomsData = await fetchRooms();

            console.log('📥 Step 3: Fetching friends...');
            await fetchFriends();

            console.log('✅ All user data loaded after sign in');

            console.log('🎯 Final room state:', {
              currentUserRoom: roomId,
              roomsCount: roomsData.length,
              userEmail: user?.email
            });

          } catch (error) {
            console.error('❌ Error loading user data:', error);
          }
        }, 100); // Reduced delay to 100ms
      } else if (event === "SIGNED_OUT") {
        console.log('🔐 User signed out, clearing all states');
        setUser(null);
        setUsers([]);
        setMessages([]);
        setPrivateMessages({});
        setFriends([]);
        setFollowingList([]);
        setRooms([]);
        setCurrentUserRoom(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Add this useEffect to App.jsx (with other useEffects)
  // Real-time subscription for room memberships
  useEffect(() => {
    if (!user) return;

    const membershipChannel = supabase
      .channel('user_room_memberships_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_room_memberships',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔄 User room membership changed:', payload);
          if (payload.eventType === 'INSERT') {
            setCurrentUserRoom(payload.new.room_id);
          } else if (payload.eventType === 'DELETE') {
            setCurrentUserRoom(null);
          }
          // Refresh rooms to update slot counts
          fetchRooms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(membershipChannel);
    };
  }, [user]);
  // Realtime subscription for user positions
  useEffect(() => {
    const channel = supabase
      .channel("user_positions_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_positions" },
        (payload) => {
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

  // Realtime subscription for public chat messages
  useEffect(() => {
    if (!user) return;

    const chatChannel = supabase
      .channel('chat_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          const newMessage = payload.new;
          const messageTime = new Date(newMessage.created_at);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

          if (messageTime > fiveMinutesAgo) {
            setMessages(prev => [...prev, newMessage]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, [user]);

  // Realtime subscription for private messages
  // Realtime subscription for private messages - UPDATED VERSION
  useEffect(() => {
    if (!user) return;

    const privateChannel = supabase
      .channel('private_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages'
        },
        async (payload) => {
          const newMessage = payload.new;

          // Check if this message is for the current user
          if (newMessage.receiver_id === user.id || newMessage.sender_id === user.id) {
            const friendId = newMessage.sender_id === user.id ? newMessage.receiver_id : newMessage.sender_id;

            // If the message is for the current user and they're viewing the chat, mark as read immediately
            if (newMessage.receiver_id === user.id) {
              // Check if we're currently viewing this friend's chat
              // We'll handle this in the PrivateChatPopup component
            }

            setPrivateMessages(prev => ({
              ...prev,
              [friendId]: [...(prev[friendId] || []), newMessage]
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(privateChannel);
    };
  }, [user]);

  // Initial fetch of users and friends
  useEffect(() => {
    fetchAllUsers();
    if (user) {
      fetchFriends();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchFollowingList();
      fetchFriends();
    }
  }, [user]);

  // Add this useEffect to reset the flag when user signs out
  useEffect(() => {
    if (!user) {
      hasSentJoinMessageRef.current = false;
    }
  }, [user]);

  // Add this visibility change handler to prevent join messages on tab switch
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        (async () => {
          try {
            const email = (user.email || "").toLowerCase();
            await supabase
              .from("user_positions")
              .update({
                last_seen: new Date().toISOString(),
              })
              .eq("email", email);
          } catch (error) {
            console.error("Error updating last_seen:", error);
          }
        })();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Auto-clean old messages every 5 minutes
  useEffect(() => {
    if (!user) return;

    const cleanupInterval = setInterval(async () => {
      try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        await supabase
          .from('chat_messages')
          .delete()
          .lt('created_at', oneHourAgo);
      } catch (error) {
        console.error('Error cleaning old messages:', error);
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(cleanupInterval);
  }, [user]);

  // Add this function to App.jsx
  // In App.jsx, update the joinRoom function
  // Simplified joinRoom using the helper
  // Replace the joinRoom function in App.jsx with this version
  // Update the joinRoom function in App.jsx to update BOTH old and new rooms
  const joinRoom = async (roomId) => {
    if (!user) return;

    try {
      console.log('🔄 joinRoom: Starting process for room:', roomId);
      console.log('🔍 joinRoom: Current user:', user.id, user.email);

      // STEP 1: Get current room membership BEFORE any changes
      const { data: currentMemberships, error: currentError } = await supabase
        .from('user_room_memberships')
        .select('room_id')
        .eq('user_id', user.id);

      const oldRoomId = currentMemberships && currentMemberships.length > 0 ? currentMemberships[0].room_id : null;
      console.log('📊 joinRoom: User currently in room:', oldRoomId);

      // STEP 2: Leave current room if exists
      if (oldRoomId) {
        console.log('🚪 joinRoom: Leaving old room:', oldRoomId);
        const { error: leaveError } = await supabase
          .from('user_room_memberships')
          .delete()
          .eq('user_id', user.id);

        if (leaveError) {
          console.error('❌ joinRoom: Error leaving old room:', leaveError);
        } else {
          console.log('✅ joinRoom: Successfully left old room');

          // Update slots for OLD room immediately after leaving
          console.log('🔄 joinRoom: Updating slots for old room:', oldRoomId);
          await updateRoomSlots(oldRoomId);
        }
      }

      // STEP 3: Join new room
      console.log('🎯 joinRoom: Joining new room:', roomId);
      const { error: joinError } = await supabase
        .from('user_room_memberships')
        .insert({
          user_id: user.id,
          room_id: roomId
        });

      if (joinError) {
        console.error('❌ joinRoom: Error joining new room:', joinError);
        alert('Error joining room: ' + joinError.message);
        return;
      }
      console.log('✅ joinRoom: Successfully joined new room');

      // STEP 4: Update slots for NEW room
      console.log('🔄 joinRoom: Updating slots for new room:', roomId);
      await updateRoomSlots(roomId);

      // STEP 5: Refresh all data
      console.log('🔄 joinRoom: Refreshing room data...');
      await fetchRooms();
      await fetchCurrentUserRoom();

      console.log('✅ joinRoom: Process completed successfully');

    } catch (error) {
      console.error('❌ joinRoom: Unexpected error:', error);
      alert('Error joining room: ' + error.message);
    }
  };
  // Add these functions to App.jsx (around line 600, before joinRoom)

  // Fetch user's current room
  const fetchCurrentUserRoom = async (currentUser = user) => {
  const userToCheck = currentUser || user;
  
  if (!userToCheck) {
    console.log('❌ fetchCurrentUserRoom: No user provided');
    setCurrentUserRoom(null);
    return null;
  }

  try {
    console.log('🔄 fetchCurrentUserRoom: Fetching for user:', userToCheck.id, userToCheck.email);
    const { data: userRooms, error } = await supabase
      .from('user_room_memberships')
      .select('room_id')
      .eq('user_id', userToCheck.id);

    if (error) {
      console.error('❌ Error fetching user rooms:', error);
      setCurrentUserRoom(null);
      return null;
    }

    console.log('✅ User room memberships found:', userRooms);

    if (userRooms && userRooms.length > 0) {
      const roomId = userRooms[0].room_id;
      setCurrentUserRoom(roomId);
      console.log('✅ Current user room set to:', roomId);
      return roomId;
    } else {
      setCurrentUserRoom(null);
      console.log('✅ User is not in any room');
      return null;
    }
  } catch (err) {
    console.error('❌ fetchCurrentUserRoom error:', err);
    setCurrentUserRoom(null);
    return null;
  }
};

  // Fetch all public rooms
const fetchRooms = async () => {
  try {
    console.log('🔄 Fetching rooms...');
    
    // First get the basic room data
    const { data: roomsData, error } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log('✅ Basic rooms fetched:', roomsData);

    // Then fetch creator emails for each room
    const roomsWithCreators = await Promise.all(
      roomsData.map(async (room) => {
        try {
          const { data: creator } = await supabase
            .from('user_positions')
            .select('email')
            .eq('user_id', room.owner_id)
            .single();

          return {
            ...room,
            creator_email: creator?.email || 'Unknown'
          };
        } catch (err) {
          console.error(`❌ Error fetching creator for room ${room.name}:`, err);
          return {
            ...room,
            creator_email: 'Unknown'
          };
        }
      })
    );

    console.log('✅ Rooms with creators:', roomsWithCreators);
    setRooms(roomsWithCreators);
    return roomsWithCreators;

  } catch (e) {
    console.error("❌ fetchRooms error", e);
    return [];
  }
};

  async function fetchAllUsers() {
    try {
      const { data, error } = await supabase.from("user_positions").select("*");
      if (error) throw error;
      setUsers(data || []);
    } catch (e) {
      console.error("fetchAllUsers error", e);
    }
  }

  // Fetch mutual friends
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

  // Update the markUserOnline function to check for duplicates
  async function markUserOnline(authUser) {
    try {
      const email = (authUser.email || "").toLowerCase();
      const { error } = await supabase.rpc("get_or_create_user_position", {
        p_user_id: authUser.id,
        p_email: email,
      });
      if (error) throw error;
      await fetchAllUsers();

      if (!hasSentJoinMessageRef.current) {
        await sendSystemMessage(`${authUser.email} joined the chat`, 'join');
        hasSentJoinMessageRef.current = true;
      }
    } catch (e) {
      console.error("markUserOnline error", e);
    }
  }

  async function fetchFollowingList() {
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
  }

  // Reliable offline call
  async function markUserOfflineViaService(email) {
    try {
      await supabaseService.rpc("mark_user_offline_by_email", { user_email: email });
      await fetchAllUsers();
    } catch (e) {
      console.error("markUserOfflineViaService error", e);
    }
  }

  // Handle sending public chat messages
  const handleSendMessage = async (content) => {
    if (!user || !content.trim()) return;

    try {
      await supabase
        .from('chat_messages')
        .insert({
          sender_email: user.email,
          sender_id: user.id,
          content: content.trim(),
          type: 'user',
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Handle sending private messages
  const handleSendPrivateMessage = async (friendId, content) => {
    if (!user || !content.trim()) return;

    try {
      await supabase
        .from('private_messages')
        .insert({
          sender_id: user.id,
          receiver_id: friendId,
          content: content.trim(),
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error sending private message:', error);
    }
  };

  // Twinkle function
  async function handleTwinkle() {
    if (!user) return;
    const email = (user.email || "").toLowerCase();

    setUsers(prev =>
      prev.map(u =>
        (u.email || "").toLowerCase() === email
          ? { ...u, is_twinkle: true, luminosity: 1.5 }
          : u
      )
    );

    try {
      await supabase
        .from("user_positions")
        .update({
          is_twinkle: true,
          luminosity: 1.5,
          last_seen: new Date().toISOString(),
        })
        .eq("email", email);
    } catch (err) {
      console.error("Error setting twinkle true:", err);
    }

    setTimeout(async () => {
      setUsers(prev =>
        prev.map(u =>
          (u.email || "").toLowerCase() === email
            ? { ...u, is_twinkle: false, luminosity: 0.8 }
            : u
        )
      );

      try {
        await supabase
          .from("user_positions")
          .update({
            is_twinkle: false,
            luminosity: 0.8,
            last_seen: new Date().toISOString(),
          })
          .eq("email", email);
      } catch (err2) {
        console.error("Error reverting twinkle:", err2);
      }
    }, 3000);
  }

  // === FOLLOW / FRIENDSHIP SYSTEM ===
  // Update the handleFollow function in App.jsx
  // Replace the handleFollow function in App.jsx
  async function handleFollow(targetUserId) {
    if (!user) return;

    try {
      console.log('🔄 Attempting to follow user:', targetUserId);

      const { error } = await supabase.rpc('follow_user', {
        p_follower: user.id,
        p_followee: targetUserId,
      });

      if (error) {
        console.error("❌ Supabase RPC follow_user error", error);
        // Try direct insert as fallback
        await followUserDirectly(targetUserId);
        return;
      }

      console.log("✅ follow_user executed successfully");

      // Check if this created a mutual friendship
      const { data, error: checkErr } = await supabase.rpc('check_friendship', {
        p_user1: user.id,
        p_user2: targetUserId,
      });

      if (checkErr) {
        console.error("❌ check_friendship error", checkErr);
      } else if (data === true) {
        console.log("🎉 Friendship formed! Creating friendship event");
        await supabase.from("friendship_events").insert({
          user1: user.id,
          user2: targetUserId,
        });
        // Refresh friends list when new friendship is formed
        fetchFriends();
      }

      await fetchFollowingList();

    } catch (e) {
      console.error('❌ handleFollow error', e);
    }
  }

  // Add this function to App.jsx
  async function followUserDirectly(targetUserId) {
    try {
      console.log('🔄 Trying direct follow insert for:', targetUserId);
      const { error } = await supabase
        .from('user_follows')
        .insert({
          follower_id: user.id,
          followee_id: targetUserId
        })
        .select();

      if (error) {
        console.error('❌ Direct follow insert error:', error);
      } else {
        console.log('✅ Direct follow insert successful');
        await fetchFollowingList();
      }
    } catch (err) {
      console.error('❌ followUserDirectly error:', err);
    }
  }

  // Sign out sequence
  // In App.jsx, update the handleSignOut function
  async function handleSignOut() {
    if (!user) return;
    const email = (user.email || "").toLowerCase();
    if (isSigningOutRef.current) return;
    isSigningOutRef.current = true;

    // Leave room before signing out - ADD THIS
    if (currentUserRoom) {
      console.log('🚪 Leaving room before sign out:', currentUserRoom);
      try {
        const { error: leaveError } = await supabase
          .from('user_room_memberships')
          .delete()
          .eq('user_id', user.id);

        if (leaveError) {
          console.error('❌ Error leaving room on sign out:', leaveError);
        } else {
          console.log('✅ Successfully left room on sign out');

          // Update room slots count for the room being left
          const { data: members, error: countError } = await supabase
            .from('user_room_memberships')
            .select('id')
            .eq('room_id', currentUserRoom);

          if (countError) {
            console.error('❌ Error counting room members on sign out:', countError);
          } else {
            const memberCount = members?.length || 0;
            console.log('📊 Room member count after sign out:', memberCount);

            const { error: updateError } = await supabase
              .from('chat_rooms')
              .update({ current_slots: memberCount })
              .eq('id', currentUserRoom);

            if (updateError) {
              console.error('❌ Error updating room slots on sign out:', updateError);
            } else {
              console.log('✅ Room slots updated on sign out to:', memberCount);
            }
          }
        }
      } catch (err) {
        console.error('❌ Error during room leave on sign out:', err);
      }
    }

    await sendSystemMessage(`${user.email} left the chat`, 'leave');

    setUsers((prev) => prev.map((u) => ((u.email || "").toLowerCase() === email ? { ...u, is_online: false, luminosity: 0.1 } : u)));

    try {
      await markUserOfflineViaService(email);
      try { await supabase.removeAllChannels(); } catch (e) { console.warn("removeAllChannels failed", e); }
      const { error } = await supabase.auth.signOut();
      if (error) console.warn("auth.signOut error", error);

      setUser(null);
      setUsers((prev) => prev.map((u) => ((u.email || "").toLowerCase() === email ? { ...u, is_online: false, luminosity: 0.1 } : u)));
      // Don't clear currentUserRoom here - let the SIGNED_OUT event handle it
    } catch (e) {
      console.error("handleSignOut failed", e);
    } finally {
      isSigningOutRef.current = false;
    }
  }

  // Add this helper function to App.jsx
  // Replace the updateRoomSlots function in App.jsx with this debug version
  // Replace the updateRoomSlots function in App.jsx with this improved version
  const updateRoomSlots = async (roomId) => {
    if (!roomId) {
      console.log('❌ updateRoomSlots: No roomId provided');
      return;
    }

    try {
      console.log(`🔄 updateRoomSlots: Starting for room ${roomId}`);

      // Count members in this room
      const { data: members, error } = await supabase
        .from('user_room_memberships')
        .select('id, user_id')
        .eq('room_id', roomId);

      if (error) {
        console.error('❌ updateRoomSlots: Error counting members:', error);
        return;
      }

      const memberCount = members?.length || 0;
      console.log(`📊 updateRoomSlots: Room ${roomId} has ${memberCount} members`);

      // Update the room's current_slots
      const { error: updateError } = await supabase
        .from('chat_rooms')
        .update({ current_slots: memberCount })
        .eq('id', roomId);

      if (updateError) {
        console.error('❌ updateRoomSlots: Error updating database:', updateError);
      } else {
        console.log(`✅ updateRoomSlots: Successfully updated room ${roomId} to ${memberCount} slots`);
      }

    } catch (err) {
      console.error('❌ updateRoomSlots: Unexpected error:', err);
    }
  };

  // Add this function to App.jsx (around line 570)
  const reloadAllFriendshipData = async () => {
    if (!user) return;

    console.log('🔄 Reloading all friendship data for user:', user.id);

    try {
      // Clear existing state
      setFriends([]);
      setFollowingList([]);

      // Wait a bit for state to clear
      await new Promise(resolve => setTimeout(resolve, 100));

      // Reload all data
      await fetchFollowingList();
      await fetchFriends();

      console.log('✅ Friendship data reload complete');

    } catch (err) {
      console.error('❌ Error reloading friendship data:', err);
    }
  };

  // In your App.jsx, add this function:

  // Function to mark private messages as read
  const markPrivateMessagesAsRead = async (friendId) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('private_messages')
        .update({ is_read: true })
        .eq('receiver_id', user.id)
        .eq('sender_id', friendId)
        .eq('is_read', false)
        .select();

      if (error) throw error;

      console.log(`✅ Marked ${data?.length || 0} messages as read for friend ${friendId}`);

      // Refetch private messages to update UI
      await fetchPrivateMessages(friendId);

    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  // Movement: current user updates position every 3000ms
  useEffect(() => {
    if (!user) return;
    const email = (user.email || "").toLowerCase();

    if (!driftRef.current[email]) {
      driftRef.current[email] = {
        dx: (Math.random() - 0.5) * 0.01,
        dy: (Math.random() - 0.5) * 0.01,
      };
    }

    const id = setInterval(() => {
      setUsers((prev) => {
        return prev.map((u) => {
          if ((u.email || "").toLowerCase() !== email || !u.is_online) return u;
          let nx = (u.current_x ?? u.initial_x ?? 0.5) + driftRef.current[email].dx;
          let ny = (u.current_y ?? u.initial_y ?? 0.5) + driftRef.current[email].dy;
          if (nx > 1) nx = 0;
          if (nx < 0) nx = 1;
          if (ny > 1) ny = 0;
          if (ny < 0) ny = 1;

          (async () => {
            try {
              const { error } = await supabase.rpc("update_user_position", { p_email: email, p_x: nx, p_y: ny });
              if (error) console.warn("update_user_position error", error);
            } catch (err) {
              console.warn("update_user_position exception", err);
            }
          })();

          return { ...u, current_x: nx, current_y: ny };
        });
      });
    }, 3000);

    return () => clearInterval(id);
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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>;

  if (!user) return <AuthPage onSignIn={() => supabase.auth.signInWithOAuth({ provider: "google" })} />;

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden">
      <NightSky
        user={user}
        users={users}
        setUsers={setUsers}
        followingList={followingList}
        onSignOut={handleSignOut}
        onTwinkle={handleTwinkle}
        messages={messages}
        onSendMessage={handleSendMessage}
        handleFollow={handleFollow}
        recentFriendships={recentFriendships}
        friends={friends}
        privateMessages={privateMessages}
        onSendPrivateMessage={handleSendPrivateMessage}
        onMarkMessagesAsRead={markPrivateMessagesAsRead}
        currentUserRoom={currentUserRoom}
        rooms={rooms}
        onJoinRoom={joinRoom}
        supabase={supabase}
        fetchRooms={fetchRooms}
      />
    </div>
  );
}