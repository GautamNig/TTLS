// src/components/ChatPanel.jsx - UPDATED FOR ROOMS
import React, { useEffect, useRef, useState } from "react";
import RoomMembersPanel from "./RoomMembersPanel";
import { supabase } from "../supabaseClient"; // ADD THIS IMPORT

export default function ChatPanel({ user, room, onSendMessage = null }) {
  const [text, setText] = useState("");
  const [roomMessages, setRoomMessages] = useState([]); // CHANGED FROM messages
  const messagesEndRef = useRef(null);
  const [currentRoom, setCurrentRoom] = useState(room);
  // Fetch room messages when room changes


  const refreshRoomData = async () => {
    if (!room) return;

    try {
      console.log('🔄 ChatPanel: Refreshing room data...');
      const { data, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('id', room.id)
        .single();

      if (error) throw error;

      console.log('✅ ChatPanel: Room data refreshed:', data);
      setCurrentRoom(data);
    } catch (error) {
      console.error('❌ ChatPanel: Error refreshing room data:', error);
    }
  };

  useEffect(() => {
    setCurrentRoom(room);
  }, [room]);

  useEffect(() => {
    if (!room) return;

    console.log('🔔 ChatPanel: Setting up membership changes subscription');

    const membershipChannel = supabase
      .channel('chatpanel_membership_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_room_memberships',
          filter: `room_id=eq.${room.id}`
        },
        (payload) => {
          console.log('🔄 ChatPanel: Membership changed for this room:', payload);
          // When members join/leave, refresh the room data to get updated slot count
          refreshRoomData();
        }
      )
      .subscribe((status) => {
        console.log('📡 ChatPanel Membership Subscription Status:', status);
      });

    return () => {
      supabase.removeChannel(membershipChannel);
    };
  }, [room]);

  useEffect(() => {
    if (!room) return;

    console.log('🔔 ChatPanel: Setting up room updates subscription');

    const roomUpdateChannel = supabase
      .channel('chatpanel_room_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_rooms',
          filter: `id=eq.${room.id}`
        },
        (payload) => {
          console.log('🔄 ChatPanel: Room updated:', payload.new);
          // Update the room data with fresh slot count
          setCurrentRoom(prev => ({ ...prev, ...payload.new }));
        }
      )
      .subscribe((status) => {
        console.log('📡 ChatPanel Room Update Status:', status);
      });

    return () => {
      supabase.removeChannel(roomUpdateChannel);
    };
  }, [room]);

  useEffect(() => {
    if (!room) {
      setRoomMessages([]);
      return;
    }

    const fetchRoomMessages = async () => {
      try {
        console.log('🔄 Fetching room messages for:', room.name);
        console.log('🔄 THE ROOM DATA:', room);
        const { data, error } = await supabase
          .from('room_messages')
          .select('*')
          .eq('room_id', room.id)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setRoomMessages(data || []);
        console.log('✅ Room messages fetched:', data?.length || 0);
      } catch (e) {
        console.error("fetchRoomMessages error", e);
      }
    };

    fetchRoomMessages();

    // Real-time subscription for room messages
    const roomChannel = supabase
      .channel('room_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${room.id}`
        },
        (payload) => {
          console.log('🔄 New room message:', payload.new);
          setRoomMessages(prev => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [room]); // DEPENDS ON ROOM NOW

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [roomMessages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || !room) return;

    if (typeof onSendMessage === "function") {
      await onSendMessage(text.trim());
    }
    setText("");
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUsername = (email) => {
    return email.split('@')[0];
  };

  const handleKickUser = async (userId) => {
    console.log('🚪 Kick user clicked for:', userId);
    console.log('🚪 Kick user clicked for:', room.id);
    if (!room || !window.confirm('Are you sure you want to kick this user from the room?')) return;

    try {
      const { error } = await supabase
        .from('user_room_memberships')
        .delete()
        .eq('user_id', userId)
        .eq('room_id', room.id);

      if (error) throw error;

      console.log('✅ User kicked successfully');
      // Note: The RoomMembersPanel will auto-refresh due to real-time subscription
    } catch (error) {
      console.error('❌ Error kicking user:', error);
      alert('Error kicking user: ' + error.message);
    }
  };

  const handleTransferOwnership = async (newOwnerId) => {
    if (!room || !window.confirm('Are you sure you want to transfer room ownership? You will no longer be the owner.')) return;

    try {
      const { error } = await supabase
        .from('chat_rooms')
        .update({ owner_id: newOwnerId })
        .eq('id', room.id);

      if (error) throw error;

      alert('Ownership transferred successfully!');
      console.log('✅ Ownership transferred to:', newOwnerId);

      // Refresh the page to update room data and UI
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('❌ Error transferring ownership:', error);
      alert('Error transferring ownership: ' + error.message);
    }
  };

  // Show different UI when not in a room
  if (!room) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'linear-gradient(to bottom, #0f172a 0%, #581c87 100%)',
        color: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'sans-serif'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌌</div>
        <div style={{ fontSize: '18px', marginBottom: '8px' }}>Welcome to Star Chat</div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
          Join a room to start chatting
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: 'linear-gradient(to bottom, #0f172a 0%, #581c87 100%)',
      color: 'white',
      fontFamily: 'sans-serif'
    }}>
      <RoomMembersPanel
        room={room}
        user={user}
        onKickUser={handleKickUser}
        onTransferOwnership={handleTransferOwnership}
      />

      {/* Room Header - UPDATED */}
      <div style={{
        flexShrink: 0,
        height: '100px',
        padding: '0 16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        background: 'linear-gradient(to right, rgba(76, 29, 149, 0.4), rgba(0, 0, 0, 0.6))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between' // Change to space-between
      }}>
        {/* Left side - Room info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '24px' }}>💬</div>
          <div>
            <div style={{ fontWeight: '600', fontSize: '18px' }}>{room.name}</div>
            <div style={{ fontSize: '12px', opacity: 0.6 }}>
              Room Chat • {currentRoom?.current_slots || 0} members • Created by {getUsername(currentRoom?.creator_email || 'Unknown')}
            </div>
          </div>
        </div>

        {/* Right side - RoomMembersPanel */}
        <RoomMembersPanel
          room={room}
          user={user}
          onKickUser={handleKickUser}
          onTransferOwnership={handleTransferOwnership}
        />
      </div>

      {/* Messages Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        background: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.5), rgba(88, 28, 135, 0.3))'
      }}>
        {roomMessages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', marginTop: '32px' }}>
            <div style={{ fontSize: '18px', marginBottom: '8px' }}>🌟 Welcome to {room.name}!</div>
            <div style={{ fontSize: '14px' }}>Start the conversation...</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {roomMessages.map((m) => {
            // System messages
            if (m.type !== 'user') {
              return (
                <div key={m.id} style={{ textAlign: 'center' }}>
                  <div style={{
                    display: 'inline-block',
                    background: 'rgba(55, 65, 81, 0.5)',
                    border: '1px solid rgba(75, 85, 99, 0.3)',
                    borderRadius: '9999px',
                    padding: '8px 16px',
                    maxWidth: '320px'
                  }}>
                    <span style={{ color: 'rgba(209, 213, 219, 1)', fontSize: '14px', fontStyle: 'italic' }}>
                      {m.content}
                    </span>
                  </div>
                </div>
              );
            }

            // User messages
            const isCurrentUser = m.sender_email === user?.email;
            const username = getUsername(m.sender_email);

            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: isCurrentUser ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{
                  maxWidth: '80%',
                  marginLeft: isCurrentUser ? 'auto' : '0'
                }}>

                  {/* Username for other users */}
                  {!isCurrentUser && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', paddingLeft: '12px' }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        background: '#10B981',
                        borderRadius: '50%',
                        animation: 'pulse 2s infinite'
                      }}></div>
                      <span style={{ fontSize: '12px', color: '#10B981', fontWeight: '500' }}>
                        {username}
                      </span>
                    </div>
                  )}

                  {/* Message bubble */}
                  <div style={{
                    position: 'relative',
                    padding: '12px 16px',
                    borderRadius: '16px',
                    background: isCurrentUser
                      ? 'linear-gradient(135deg, #3B82F6, #1D4ED8)'
                      : '#374151',
                    borderTopRightRadius: isCurrentUser ? '4px' : '16px',
                    borderTopLeftRadius: isCurrentUser ? '16px' : '4px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                  }}>

                    {/* Message content */}
                    <div style={{
                      color: 'white',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      wordBreak: 'break-word'
                    }}>
                      {m.content}
                    </div>

                    {/* Timestamp */}
                    <div style={{
                      fontSize: '11px',
                      marginTop: '8px',
                      color: isCurrentUser ? 'rgba(219, 234, 254, 1)' : 'rgba(156, 163, 175, 1)',
                      textAlign: 'right'
                    }}>
                      {formatTime(m.created_at)}
                    </div>
                  </div>

                  {/* "You" label for current user */}
                  {isCurrentUser && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', paddingRight: '12px', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '12px', color: '#93C5FD', fontWeight: '500' }}>You</span>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        background: '#60A5FA',
                        borderRadius: '50%'
                      }}></div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        flexShrink: 0,
        minHeight: '80px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        background: 'linear-gradient(to right, rgba(0, 0, 0, 0.6), rgba(76, 29, 149, 0.4))'
      }}>
        <form
          onSubmit={handleSubmit}
          style={{
            height: '100%',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: '100%'
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={room ? `Message in ${room.name}...` : "Join a room to chat..."}
            disabled={!room}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.4)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.1)',
              outline: 'none',
              opacity: room ? 1 : 0.6
            }}
          />
          <button
            type="submit"
            disabled={!text.trim() || !room}
            style={{
              padding: '12px 24px',
              background: (!text.trim() || !room)
                ? 'linear-gradient(135deg, #4B5563, #374151)'
                : 'linear-gradient(135deg, #3B82F6, #7C3AED)',
              color: 'white',
              fontWeight: '600',
              borderRadius: '12px',
              border: 'none',
              cursor: (!text.trim() || !room) ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s',
              opacity: (!text.trim() || !room) ? 0.5 : 1
            }}
          >
            Send
          </button>
        </form>
      </div>

      {/* Add pulse animation for online indicator */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
}