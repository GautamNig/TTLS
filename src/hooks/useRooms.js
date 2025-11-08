// src/hooks/useRooms.js
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import useDebounce from "./useDebounce";

export default function useRooms(user) {
  const [rooms, setRooms] = useState([]);
  const [currentUserRoom, setCurrentUserRoom] = useState(null);

  // Debounced room fetch to prevent rapid updates
  const debouncedFetchRooms = useDebounce(async () => {
    console.log('🔄 Debounced room fetch');
    await fetchRooms();
  }, 500);

  // Real-time subscription for room memberships (current user only)
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
        console.log('🔄 User room membership REAL-TIME EVENT:', {
          event: payload.eventType,
          room_id: payload.new?.room_id || payload.old?.room_id,
          user_id: payload.new?.user_id || payload.old?.user_id
        });
        
        if (payload.eventType === 'INSERT') {
          setCurrentUserRoom(payload.new.room_id);
          console.log('✅ User joined room:', payload.new.room_id);
        } else if (payload.eventType === 'DELETE') {
          const kickedRoomId = payload.old.room_id;
          setCurrentUserRoom(null);
          console.log('❌ User was KICKED from room:', kickedRoomId);
          
          // CRITICAL: Clear room messages when kicked
          // We need to pass a callback to clear messages in ChatPanel
          if (typeof window.clearRoomMessages === 'function') {
            window.clearRoomMessages(kickedRoomId);
          }
        }
        // Refresh rooms to update slot counts
        fetchRooms();
      }
    )
    .subscribe((status) => {
      console.log('📡 Room membership subscription status:', status);
    });

  return () => {
    console.log('🧹 Cleaning up room membership subscription');
    supabase.removeChannel(membershipChannel);
  };
}, [user]);

  // ADD THIS: Real-time subscription for ALL room membership changes
  useEffect(() => {
    if (!user) return;

    console.log('🔔 Setting up ALL room membership changes subscription');
    
    const allMembershipsChannel = supabase
      .channel('all_room_memberships_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_room_memberships'
        },
        (payload) => {
          console.log('🔄 ANY user room membership changed:', payload);
          // When ANY user joins or leaves ANY room, refresh room data
          debouncedFetchRooms();
        }
      )
      .subscribe((status) => {
        console.log('📡 All room memberships subscription status:', status);
      });

    return () => {
      supabase.removeChannel(allMembershipsChannel);
    };
  }, [user,debouncedFetchRooms]);

  // ADD THIS: Real-time subscription for room updates
  useEffect(() => {
    if (!user) return;

    console.log('🔔 Setting up room updates subscription');
    
    const roomUpdatesChannel = supabase
      .channel('room_updates_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_rooms'
        },
        (payload) => {
          console.log('🔄 Room data changed:', payload);
          // When room data changes (like current_slots), refresh room list
          fetchRooms();
        }
      )
      .subscribe((status) => {
        console.log('📡 Room updates subscription status:', status);
      });

    return () => {
      supabase.removeChannel(roomUpdatesChannel);
    };
  }, [user]);

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

  const fetchRooms = async () => {
    try {
      console.log('🔄 Fetching rooms with real-time data...');

      // First get the basic room data
      const { data: roomsData, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('✅ Basic rooms fetched:', roomsData?.length || 0, 'rooms');

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

  return {
    rooms,
    setRooms,
    currentUserRoom,
    setCurrentUserRoom,
    fetchRooms,
    fetchCurrentUserRoom,
    updateRoomSlots
  };
}