// Update RoomListPanel.jsx - Add join functionality
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function RoomListPanel({ user }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningRoomId, setJoiningRoomId] = useState(null);
  // In RoomListPanel.jsx, add these new states at the top with other useState declarations
  const [currentUserRoom, setCurrentUserRoom] = useState(null);
  const [userRoomsLoading, setUserRoomsLoading] = useState(true);

  // Simple function to fetch rooms
  // Update the fetchRooms function in RoomListPanel.jsx
  const fetchRooms = async () => {
    try {
      console.log('🔄 Fetching rooms with creator info...');
      const { data, error } = await supabase
        .from('chat_rooms')
        .select(`
        *,
        user_positions!chat_rooms_owner_id_fkey (
          email
        )
      `)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('✅ Rooms fetched with creator info:', data);
      setRooms(data || []);
    } catch (e) {
      console.error("❌ fetchRooms error", e);
    } finally {
      setLoading(false);
    }
  };

  // Replace the fetchCurrentUserRoom function in RoomListPanel.jsx
  const fetchCurrentUserRoom = async () => {
    if (!user) return;

    try {
      console.log('🔄 Fetching current user room...');
      const { data: userRooms, error } = await supabase
        .from('user_room_memberships')
        .select('room_id')
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ Error fetching user rooms:', error);
        return;
      }

      console.log('✅ User room memberships:', userRooms);

      // User can only be in one room at a time, so take the first one
      if (userRooms && userRooms.length > 0) {
        setCurrentUserRoom(userRooms[0].room_id);
        console.log('✅ Current user room set to:', userRooms[0].room_id);
      } else {
        setCurrentUserRoom(null);
        console.log('✅ User is not in any room');
      }
    } catch (err) {
      console.error('❌ fetchCurrentUserRoom error:', err);
    } finally {
      setUserRoomsLoading(false);
    }
  };

  // Join room function
  // Update JUST the joinRoom function in RoomListPanel.jsx
  // Replace the joinRoom function in RoomListPanel.jsx with this SIMPLE version
  const joinRoom = async (roomId) => {
    if (!user) return;

    setJoiningRoomId(roomId);
    try {
      console.log('🔄 Joining room:', roomId);

      // STEP 1: Leave any current room
      const { error: leaveError } = await supabase
        .from('user_room_memberships')
        .delete()
        .eq('user_id', user.id);

      if (leaveError) {
        console.error('❌ Error leaving current room:', leaveError);
      }

      // STEP 2: Join the new room
      const { error: joinError } = await supabase
        .from('user_room_memberships')
        .insert({
          user_id: user.id,
          room_id: roomId
        });

      if (joinError) {
        console.error('❌ Error joining room:', joinError);
        alert('Error joining room: ' + joinError.message);
        return;
      } else {
        console.log('✅ Successfully joined room');

        // UPDATE CURRENT USER ROOM - MAKE SURE THIS LINE EXISTS
        setCurrentUserRoom(roomId);
        console.log('✅ Current user room updated to:', roomId);
      }

      // Count members in this room
      const { data: members, error: countError } = await supabase
        .from('user_room_memberships')
        .select('id')
        .eq('room_id', roomId);

      if (countError) {
        console.error('❌ Error counting members:', countError);
      } else {
        const memberCount = members?.length || 0;
        console.log('📊 Room has', memberCount, 'members');

        // Direct update of current_slots
        const { error: updateError } = await supabase
          .from('chat_rooms')
          .update({ current_slots: memberCount })
          .eq('id', roomId);

        if (updateError) {
          console.error('❌ Error updating current_slots:', updateError);
          console.log('🔍 Update error details:', updateError);
        } else {
          console.log('✅ current_slots updated to:', memberCount);
        }
      }

      // STEP 4: Refresh the room list to show updated data
      await fetchRooms();
      alert('Joined room successfully! 🎉');

    } catch (error) {
      console.error('❌ Join room exception:', error);
      alert('Error joining room: ' + error.message);
    } finally {
      setJoiningRoomId(null);
    }
  };

  // Load rooms on component mount
  useEffect(() => {
    fetchRooms();
    fetchCurrentUserRoom();

    // Set up real-time subscription for new rooms
    const roomSubscription = supabase
      .channel('room_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_rooms',
        },
        (payload) => {
          console.log('🔄 New room created:', payload.new);
          setRooms(prev => [payload.new, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_rooms',
        },
        (payload) => {
          console.log('🗑️ Room deleted:', payload.old);
          setRooms(prev => prev.filter(room => room.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes', // ADD THIS: Listen for user room membership changes
        {
          event: '*',
          schema: 'public',
          table: 'user_room_memberships',
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          console.log('🔄 User room membership changed:', payload);
          if (payload.eventType === 'INSERT') {
            setCurrentUserRoom(payload.new.room_id);
          } else if (payload.eventType === 'DELETE') {
            setCurrentUserRoom(null);
          }
          // Also refresh rooms to get updated data
          fetchRooms();
        }
      )
      .subscribe((status) => {
        console.log('📡 Room subscription status:', status);
      });

    // Cleanup subscription
    return () => {
      supabase.removeChannel(roomSubscription);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: '80px',
      right: '420px',
      width: '300px',
      maxHeight: '400px',
      background: 'linear-gradient(to bottom, #0f172a 0%, #581c87 100%)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '12px',
      padding: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      zIndex: 999,
      overflowY: 'auto'
    }}>
      <h3 style={{
        color: 'white',
        marginBottom: '16px',
        textAlign: 'center',
        fontSize: '16px'
      }}>
        Available Rooms ({rooms.length})
      </h3>

      {loading ? (
        <div style={{ color: 'white', textAlign: 'center' }}>Loading rooms...</div>
      ) : rooms.length === 0 ? (
        <div style={{
          color: 'rgba(255,255,255,0.6)',
          textAlign: 'center',
          fontSize: '14px',
          padding: '20px'
        }}>
          No rooms available yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rooms.map(room => {
            const isUserInThisRoom = currentUserRoom === room.id;
            const isRoomFull = room.current_slots >= room.max_slots;
            const isJoining = joiningRoomId === room.id;

            // ADD DEBUG LOGGING
            console.log(`🔍 Room ${room.name}:`, {
              roomId: room.id,
              currentUserRoom: currentUserRoom,
              isUserInThisRoom: isUserInThisRoom,
              currentSlots: room.current_slots,
              maxSlots: room.max_slots,
              isRoomFull: isRoomFull
            });

            return (
              <div
                key={room.id}
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: 'white'
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                  {room.name}
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
                  {room.description || 'No description'}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                  Created by: {room.user_positions?.email || 'Unknown'}
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11px'
                }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Slots: {room.current_slots}/{room.max_slots}
                  </span>
                  <button
                    onClick={() => joinRoom(room.id)}
                    disabled={isJoining || isRoomFull || isUserInThisRoom}
                    style={{
                      padding: '4px 12px',
                      background: isUserInThisRoom
                        ? 'rgba(16, 185, 129, 0.5)' // Green for "Already in"
                        : isRoomFull
                          ? 'rgba(107, 114, 128, 0.5)' // Gray for "Full"
                          : isJoining
                            ? 'rgba(59, 130, 246, 0.5)' // Blue for "Joining"
                            : 'linear-gradient(135deg, #3B82F6, #7C3AED)', // Normal join
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '11px',
                      cursor: (isJoining || isRoomFull || isUserInThisRoom) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isUserInThisRoom ? 'Joined ✓' :
                      isJoining ? 'Joining...' :
                        isRoomFull ? 'Full' : 'Join'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}