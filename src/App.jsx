// src/App.jsx
import React, { useEffect, useRef, useState } from "react";
import { supabase, supabaseService } from "./supabaseClient";
import { AuthPage, NightSky } from "./components";
import { LoadingSpinner } from "./components"; // ADD THIS IMPORT
import { useAuth, useUsers, useChat, useFriends, useRooms, useUserMovement } from "./hooks"; // ADD useUserMovement
import "./index.css";

// ... rest of your App.jsx code remains the same

// ... rest of your App.jsx code remains the same

export default function App() {

  const driftRef = useRef({});

  const {
    user,
    setUser,
    loading,
    setLoading,
    isSigningOutRef,
    hasSentJoinMessageRef,
    markUserOnline,
    markUserOfflineViaService,
    sendSystemMessage
  } = useAuth();

  const {
    users,
    setUsers,
    followingList,
    setFollowingList,
    fetchAllUsers,
    fetchFollowingList
  } = useUsers(user);

  const {
    messages,
    setMessages,
    privateMessages,
    setPrivateMessages,
    handleSendMessage,
    handleSendPrivateMessage
  } = useChat(user);

  const {
    friends,
    setFriends,
    recentFriendships,
    fetchFriends,
    fetchPrivateMessages
  } = useFriends(user, privateMessages, setPrivateMessages);

  const {
    rooms,
    setRooms,
    currentUserRoom,
    setCurrentUserRoom,
    fetchRooms,
    fetchCurrentUserRoom,
    updateRoomSlots
  } = useRooms(user);

  useUserMovement(user, setUsers);
  // Initial session + auth listener
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        setUser(data.session.user);
        await markUserOnline(data.session.user, fetchAllUsers);
      }
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🔐 Auth change:", event);
      if (event === "SIGNED_IN" && session?.user) {
        console.log("👤 Setting user state:", session.user.email);
        setUser(session.user);
        markUserOnline(session.user, fetchAllUsers).catch((e) => console.error(e));

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

  // In App.jsx - Fix the joinRoom function
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

      if (currentError) {
        console.error('❌ joinRoom: Error fetching current memberships:', currentError);
        throw currentError;
      }

      const oldRoomId = currentMemberships && currentMemberships.length > 0 ? currentMemberships[0].room_id : null;
      console.log('📊 joinRoom: User currently in room:', oldRoomId);

      // STEP 2: Leave current room if exists (CRITICAL FIX)
      if (oldRoomId) {
        console.log('🚪 joinRoom: Leaving old room:', oldRoomId);
        const { error: leaveError } = await supabase
          .from('user_room_memberships')
          .delete()
          .eq('user_id', user.id)
          .eq('room_id', oldRoomId);

        if (leaveError) {
          console.error('❌ joinRoom: Error leaving old room:', leaveError);
          throw leaveError;
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
      await markUserOfflineViaService(email, fetchAllUsers);
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

  if (loading) return <LoadingSpinner message="Connecting to the starry sky..." />;

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