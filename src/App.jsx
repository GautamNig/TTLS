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
  const [loading, setLoading] = useState(true);
  const [followingList, setFollowingList] = useState([]);
  const [recentFriendships, setRecentFriendships] = useState([]);

  const isSigningOutRef = useRef(false);
  const driftRef = useRef({});
  // Add this ref with your other refs
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

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("🔐 Auth change:", event);
      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
        markUserOnline(session.user).catch((e) => console.error(e));
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setUsers([]);
        setMessages([]);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

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

  // Realtime subscription for chat messages
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
          // Only show messages from the last 5 minutes
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

  // Initial fetch of users
  useEffect(() => {
    fetchAllUsers();
  }, []);

  useEffect(() => {
  if (user) fetchFollowingList();
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
        // When tab becomes visible, just update last_seen but don't send join message
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

  async function fetchAllUsers() {
    try {
      const { data, error } = await supabase.from("user_positions").select("*");
      if (error) throw error;
      setUsers(data || []);
    } catch (e) {
      console.error("fetchAllUsers error", e);
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

      // Only send join message if we haven't sent one recently
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

  // Handle sending chat messages
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

  // Twinkle function
  async function handleTwinkle() {
    if (!user) return;
    const email = (user.email || "").toLowerCase();

    // Set twinkle state locally and in DB
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

    // Revert after 3 seconds
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

  // Follow another user
  async function handleFollow(targetUserId) {
    if (!user) return;

    try {
      const { error } = await supabase.rpc('follow_user', {
        p_follower: user.id,
        p_followee: targetUserId,
      });
      if (error) console.error("Supabase RPC follow_user error", error);
      else console.log("✅ follow_user executed successfully");


      // check if mutual
      const { data, error: checkErr } = await supabase.rpc('check_friendship', {
        p_user1: user.id,
        p_user2: targetUserId,
      });

      if (checkErr) throw checkErr;

      if (data === true) {
        // Broadcast friendship event to DB
        await supabase.from("friendship_events").insert({
          user1: user.id,
          user2: targetUserId,
        });
      }

      await fetchFollowingList();

    } catch (e) {
      console.error('handleFollow error', e);
    }

  }

  // Sign out sequence
  async function handleSignOut() {
    if (!user) return;
    const email = (user.email || "").toLowerCase();
    if (isSigningOutRef.current) return;
    isSigningOutRef.current = true;

    // Send leave message BEFORE signing out
    await sendSystemMessage(`${user.email} left the chat`, 'leave');

    // Optimistic local update
    setUsers((prev) => prev.map((u) => ((u.email || "").toLowerCase() === email ? { ...u, is_online: false, luminosity: 0.1 } : u)));

    try {
      // 1) server-side mark offline via service role
      await markUserOfflineViaService(email);

      // 2) remove realtime channels
      try { await supabase.removeAllChannels(); } catch (e) { console.warn("removeAllChannels failed", e); }

      // 3) sign out
      const { error } = await supabase.auth.signOut();
      if (error) console.warn("auth.signOut error", error);

      // final local cleanup
      setUser(null);
      setUsers((prev) => prev.map((u) => ((u.email || "").toLowerCase() === email ? { ...u, is_online: false, luminosity: 0.1 } : u)));
    } catch (e) {
      console.error("handleSignOut failed", e);
    } finally {
      isSigningOutRef.current = false;
    }
  }

  // Movement: current user updates position every 500ms
  useEffect(() => {
    if (!user) return;
    const email = (user.email || "").toLowerCase();

    // Create drift vector if not present
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
          // Wrap around
          if (nx > 1) nx = 0;
          if (nx < 0) nx = 1;
          if (ny > 1) ny = 0;
          if (ny < 0) ny = 1;

          // Write to DB
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
    }, 500);

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
      />
    </div>
  );
}