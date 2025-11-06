// Create TestApp.jsx:
import React, { useState, useEffect, useRef } from 'react';

import { supabase, supabaseService } from "./supabaseClient";
export default function TestApp() {
  const [count, setCount] = useState(0);
  const renderCount = React.useRef(0);
  renderCount.current++;
  console.log(`🧪 TestApp RENDER #${renderCount.current}`);
    const [users, setUsers] = useState([]);
    const [user, setUser] = useState(null);
      const [rooms, setRooms] = useState([]);
      const [currentUserRoom, setCurrentUserRoom] = useState(null);
      const userPositionsTimeoutRef = useRef(null);
  useEffect(() => {
  const channel = supabase
    .channel("user_positions_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_positions" },
// In the subscription callback:
(payload) => {
  if (userPositionsTimeoutRef.current) {
    clearTimeout(userPositionsTimeoutRef.current);
  }
  
  userPositionsTimeoutRef.current = setTimeout(() => {
    const row = payload.new;
    if (!row) return;
    setUsers((prev) => {
      // ... your update logic
    });
  }, 1000); // Only update once per second
}
    )
    .subscribe((status) => console.log("Realtime status:", status));

  return () => {
    supabase.removeChannel(channel);
  };
}, []);

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
          // fetchRooms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(membershipChannel);
    };
  }, [user]);

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
  
            //   console.log('📥 Step 1: Fetching current user room...');
            //   const roomId = await fetchCurrentUserRoom(session.user);
  
            //   console.log('📥 Step 2: Fetching rooms...');
            //   const roomsData = await fetchRooms();
  
            //   console.log('📥 Step 3: Fetching friends...');
            //   await fetchFriends();
  
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
        }
      });
  
      return () => sub.subscription.unsubscribe();
    }, []);

  // No effects, no subscriptions, no nothing
  return (
    <div style={{ padding: 20, background: '#333', color: 'white' }}>
      <h1>Test App - Render #{renderCount.current}</h1>
      <button onClick={() => setCount(c => c + 1)}>
        Force Re-render: {count}
      </button>
    </div>
  );
}

// In main.jsx, temporarily replace <App /> with <TestApp />