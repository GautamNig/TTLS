// Update CreateRoomPopup.jsx - Add supabase import
import React, { useState } from "react";
import { supabase } from "../../supabaseClient"; // ADD THIS IMPORT

export default function CreateRoomPopup({ user, onCreateRoom, onClose }) {
  const [roomName, setRoomName] = useState("");
  const [description, setDescription] = useState("");
  const [maxSlots, setMaxSlots] = useState(10);
  const [isCreating, setIsCreating] = useState(false);

  // In CreateRoomPopup.jsx - Update the handleSubmit function
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roomName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      console.log('🚀 Creating room with data:', {
        name: roomName.trim(),
        description: description.trim(),
        maxSlots
      });

      // STEP 1: Leave current room first (if any)
      const { error: leaveError } = await supabase
        .from('user_room_memberships')
        .delete()
        .eq('user_id', user.id);

      if (leaveError) {
        console.error('❌ Error leaving current room:', leaveError);
        // Continue anyway - don't throw error
      } else {
        console.log('✅ Left current room before creating new one');
      }

      // STEP 2: Create the new room
      const { data: roomData, error } = await supabase
        .from('chat_rooms')
        .insert({
          name: roomName.trim(),
          description: description.trim(),
          owner_id: user.id,
          max_slots: maxSlots,
          current_slots: 1, // Start with creator as the only member
          is_public: true
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Room creation error:', error);
        alert('Error creating room: ' + error.message);
        return;
      }

      console.log('✅ Room created successfully:', roomData);

      // STEP 3: Auto-join the room creator
      const { error: joinError } = await supabase
        .from('user_room_memberships')
        .insert({
          user_id: user.id,
          room_id: roomData.id
        });

      if (joinError) {
        console.error('❌ Room join error:', joinError);
        // Still continue - the room was created
      } else {
        console.log('✅ Room creator auto-joined room');
      }

      if (typeof onCreateRoom === 'function') {
        onCreateRoom(roomData);
      }

      alert(`Room "${roomName}" created successfully! 🎉`);
      onClose();

    } catch (error) {
      console.error('❌ Room creation exception:', error);
      alert('Error creating room: ' + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        background: 'linear-gradient(to bottom, #0f172a 0%, #581c87 100%)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '12px',
        padding: '24px',
        width: '400px',
        maxWidth: '90vw',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
      }}>
        <h2 style={{
          color: 'white',
          marginBottom: '20px',
          textAlign: 'center',
          fontSize: '20px'
        }}>
          Create New Room
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              color: 'white',
              marginBottom: '8px',
              fontSize: '14px'
            }}>
              Room Name *
            </label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Enter room name"
              required
              disabled={isCreating}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.4)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.2)',
                outline: 'none',
                opacity: isCreating ? 0.6 : 1
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              color: 'white',
              marginBottom: '8px',
              fontSize: '14px'
            }}>
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Room description"
              rows="3"
              disabled={isCreating}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.4)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.2)',
                outline: 'none',
                resize: 'vertical',
                opacity: isCreating ? 0.6 : 1
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              color: 'white',
              marginBottom: '8px',
              fontSize: '14px'
            }}>
              Max Slots: {maxSlots}
            </label>
            <input
              type="range"
              min="2"
              max="20"
              value={maxSlots}
              onChange={(e) => setMaxSlots(parseInt(e.target.value))}
              disabled={isCreating}
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '3px',
                background: 'rgba(255,255,255,0.2)',
                outline: 'none',
                opacity: isCreating ? 0.6 : 1
              }}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '12px',
              marginTop: '4px'
            }}>
              <span>2</span>
              <span>20</span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              style={{
                padding: '10px 20px',
                background: 'rgba(255,255,255,0.1)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                cursor: isCreating ? 'not-allowed' : 'pointer',
                opacity: isCreating ? 0.6 : 1
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!roomName.trim() || isCreating}
              style={{
                padding: '10px 20px',
                background: (!roomName.trim() || isCreating)
                  ? 'rgba(59, 130, 246, 0.5)'
                  : 'linear-gradient(135deg, #3B82F6, #7C3AED)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: (!roomName.trim() || isCreating) ? 'not-allowed' : 'pointer'
              }}
            >
              {isCreating ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}