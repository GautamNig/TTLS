// src/components/RoomMembersPanel.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function RoomMembersPanel({ room, user, onKickUser, onTransferOwnership }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [roomMembers, setRoomMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [bannedUsers, setBannedUsers] = useState([]);

    const fetchBannedUsers = async () => {
        if (!room) return;

        try {
            const { data, error } = await supabase
                .from('room_bans')
                .select(`
        *,
        banned_user:user_positions!room_bans_banned_user_id_fkey (
          email
        ),
        banned_by:user_positions!room_bans_banned_by_user_id_fkey (
          email
        )
      `)
                .eq('room_id', room.id)
                .is('expires_at', null); // Only permanent bans for now

            if (error) throw error;
            setBannedUsers(data || []);
        } catch (error) {
            console.error('❌ Error fetching banned users:', error);
        }
    };

    // Ban user function
    // In RoomMembersPanel.jsx - Update handleBanUser
    const handleBanUser = async (userId) => {
        if (!room || !window.confirm('SPINNING BACK KICK! 🦵\n\nAre you sure you want to BAN this user? They will be immediately removed and cannot rejoin.')) return;

        try {
            console.log('🦵 Banning user:', userId, 'from room:', room.id);

            // STEP 1: Kick user from room (remove membership)
            const { error: kickError } = await supabase
                .from('user_room_memberships')
                .delete()
                .eq('user_id', userId)
                .eq('room_id', room.id);

            if (kickError) {
                console.error('❌ Error kicking during ban:', kickError);
                throw kickError;
            }

            // STEP 2: Add to ban list
            const { error: banError } = await supabase
                .from('room_bans')
                .insert({
                    room_id: room.id,
                    banned_user_id: userId,
                    banned_by_user_id: user.id,
                    reason: 'Spinning back kick by room owner'
                });

            if (banError) {
                console.error('❌ Error adding ban:', banError);
                throw banError;
            }

            console.log('✅ User banned successfully');

            // STEP 3: Refresh both lists
            await fetchRoomMembers();
            await fetchBannedUsers();

            // STEP 4: Update room slots
            if (typeof onKickUser === 'function') {
                onKickUser(userId); // This should update room slots
            }

            alert('💥 SPINNING BACK KICK! User has been BANNED from this room!');

        } catch (error) {
            console.error('❌ Error in spinning back kick:', error);
            alert('Error banning user: ' + error.message);
        }
    };

    // Unban user function  
    const handleUnbanUser = async (banId) => {
        if (!window.confirm('Are you sure you want to unban this user?')) return;

        try {
            const { error } = await supabase
                .from('room_bans')
                .delete()
                .eq('id', banId);

            if (error) throw error;

            fetchBannedUsers(); // Refresh banned list
            alert('User has been unbanned!');

        } catch (error) {
            console.error('❌ Error unbanning user:', error);
            alert('Error unbanning user: ' + error.message);
        }
    };

    useEffect(() => {
        if (isExpanded) {
            fetchRoomMembers();
            fetchBannedUsers();
        }
    }, [isExpanded, room]);

    // Fetch room members
    const fetchRoomMembers = async () => {
        if (!room) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_room_memberships')
                .select(`
          user_id,
          user_positions!user_room_memberships_user_id_fkey (
            email,
            is_online
          )
        `)
                .eq('room_id', room.id);

            if (error) throw error;

            console.log('✅ Room members fetched:', data);
            setRoomMembers(data || []);
        } catch (error) {
            console.error('❌ Error fetching room members:', error);
        } finally {
            setLoading(false);
        }
    };

    // Real-time subscription for room membership changes
    useEffect(() => {
        if (!room || !isExpanded) return;

        // In RoomMembersPanel.jsx - Add detailed logging
        const channel = supabase
            .channel('room_members_updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_room_memberships',
                    filter: `room_id=eq.${room.id}`
                },
                (payload) => {
                    console.log('🔄 RoomMembersPanel REAL-TIME EVENT:', {
                        event: payload.eventType,
                        table: payload.table,
                        old: payload.old,
                        new: payload.new,
                        roomId: room.id
                    });
                    fetchRoomMembers(); // Refresh members list
                }
            )
            .subscribe((status) => {
                console.log('📡 RoomMembersPanel Subscription Status:', status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [room, isExpanded]);

    useEffect(() => {
        if (isExpanded) {
            fetchRoomMembers();
        }
    }, [isExpanded, room]);

    const isOwner = user?.id === room?.owner_id;

    const getUsername = (email) => {
        return email?.split('@')[0] || 'Unknown';
    };

    // Compact view for header (when not expanded)
    if (!isExpanded) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginLeft: 'auto' // Push to the right side of header
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(255,255,255,0.1)',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.2)',
                    transition: 'all 0.2s'
                }}
                    onClick={() => setIsExpanded(true)}
                >
                    <span style={{ fontSize: '14px' }}>👥</span>
                    <span style={{ fontSize: '12px', fontWeight: '500' }}>
                        {room?.current_slots || 0}
                    </span>
                </div>

                {/* Owner badge */}
                {isOwner && (
                    <div style={{
                        background: 'rgba(245, 158, 11, 0.2)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        borderRadius: '20px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        color: '#F59E0B',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}>
                        <span>👑</span>
                        <span>Owner</span>
                    </div>
                )}
            </div>
        );
    }

    // Expanded view (dropdown)
    return (
        <>
            {/* Backdrop */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 99
                }}
                onClick={() => setIsExpanded(false)}
            />

            {/* Members Panel */}
            <div style={{
                position: 'absolute',
                top: '80px', // Position below header
                right: '16px',
                width: '300px',
                background: 'linear-gradient(to bottom, #0f172a 0%, #581c87 100%)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '12px',
                padding: '16px',
                zIndex: 100,
                maxHeight: '400px',
                overflowY: 'auto',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <button
                        onClick={() => setIsExpanded(false)}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            cursor: 'pointer',
                            padding: '6px',
                            fontSize: '14px',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        ✕
                    </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    {/* <div>
                        <h4 style={{ color: 'white', margin: 0, fontSize: '16px', fontWeight: '600' }}>
                            Room Members
                        </h4>
                        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginTop: '4px' }}>
                            {roomMembers.length} members in {room.name}
                        </div>
                    </div> */}
                </div>

                {/* Members List */}
                {loading ? (
                    <div style={{
                        color: 'rgba(255,255,255,0.6)',
                        textAlign: 'center',
                        fontSize: '14px',
                        padding: '20px'
                    }}>
                        Loading members...
                    </div>
                ) : roomMembers.length === 0 ? (
                    <div style={{
                        color: 'rgba(255,255,255,0.6)',
                        textAlign: 'center',
                        fontSize: '14px',
                        padding: '20px'
                    }}>
                        No members in this room
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {roomMembers.map((member) => (
                            <div
                                key={member.user_id}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '10px 12px',
                                    background: 'rgba(255,255,255,0.05)',
                                    borderRadius: '8px',
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}
                            >
                                {/* Member Info */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                                    <div
                                        style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            background: member.user_positions?.is_online ? '#10B981' : '#6B7280',
                                            flexShrink: 0
                                        }}
                                    />
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{
                                            fontSize: '13px',
                                            fontWeight: member.user_id === room.owner_id ? '600' : '400',
                                            color: member.user_id === room.owner_id ? '#F59E0B' : 'white'
                                        }}>
                                            {getUsername(member.user_positions?.email)}
                                            {member.user_id === room.owner_id && (
                                                <span style={{ marginLeft: '6px', fontSize: '12px' }}>👑</span>
                                            )}
                                        </div>
                                        <div style={{
                                            fontSize: '11px',
                                            color: 'rgba(255,255,255,0.5)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {member.user_positions?.email}
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons (only for owner) */}
                                {isOwner && member.user_id !== user.id && (
                                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onTransferOwnership(member.user_id);
                                            }}
                                            title="Transfer Ownership"
                                            style={{
                                                background: 'rgba(245, 158, 11, 0.2)',
                                                border: '1px solid rgba(245, 158, 11, 0.4)',
                                                borderRadius: '6px',
                                                color: '#F59E0B',
                                                cursor: 'pointer',
                                                padding: '6px 8px',
                                                fontSize: '11px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            👑
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onKickUser(member.user_id);
                                            }}
                                            title="Kick User"
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.2)',
                                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                                borderRadius: '6px',
                                                color: '#EF4444',
                                                cursor: 'pointer',
                                                padding: '6px 8px',
                                                fontSize: '11px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            🚪
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleBanUser(member.user_id);
                                            }}
                                            title="Spinning Back Kick (Ban)"
                                            style={{
                                                background: 'rgba(139, 69, 19, 0.3)',
                                                border: '1px solid rgba(139, 69, 19, 0.6)',
                                                borderRadius: '4px',
                                                color: '#8B4513',
                                                cursor: 'pointer',
                                                padding: '4px 6px',
                                                fontSize: '10px',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            🦵
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Owner Notice */}
                {isOwner && (
                    <div style={{
                        marginTop: '16px',
                        padding: '10px',
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '8px',
                        color: '#F59E0B',
                        fontSize: '12px',
                        textAlign: 'center'
                    }}>
                        👑 You are the room owner - You can kick members or transfer ownership
                    </div>
                )}
            </div>
        </>
    );
}