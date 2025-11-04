// In NightSky.jsx - Add import and component
import React, { useState } from "react";
import ModernHeader from "./ModernHeader";
import GlowingPixel from "./GlowingPixel";
import ChatPanel from "./ChatPanel";
import PrivateChatPopup from "./PrivateChatPopup";
import CreateRoomPopup from "./CreateRoomPopup";
import RoomListPanel from "./RoomListPanel"; // ADD THIS IMPORT

export default function NightSky({
  user,
  users = [],
  setUsers,
  followingList = [],
  onSignOut,
  onTwinkle,
  messages = [],
  onSendMessage = null,
  handleFollow,
  recentFriendships = [],
  friends = [],
  privateMessages = {},
  onSendPrivateMessage,
  onMarkMessagesAsRead
}) {
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showRoomList, setShowRoomList] = useState(false); // ADD THIS STATE

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 384px',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden'
    }} className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">

      {/* LEFT SIDE - Starfield */}
      <div style={{ position: 'relative', overflow: 'hidden', paddingTop: '34px'}} className="flex-1" >
        {/* Background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />

        {/* Header */}
        <ModernHeader user={user} onSignOut={onSignOut} onTwinkle={onTwinkle} />

        {/* Stars */}
        {users.map((u) => (
          <GlowingPixel
            key={u.id || u.email}
            userData={u}
            allUsers={users}
            isCurrentUser={(u.email || "").toLowerCase() === (user.email || "").toLowerCase()}
            onFollow={(targetId) => handleFollow(targetId)}
            recentFriendships={recentFriendships}
            isFollowing={followingList.includes(u.user_id)}
          />
        ))}

        {/* Private Chat Popup */}
        <PrivateChatPopup
          user={user}
          friends={friends}
          privateMessages={privateMessages}
          onSendPrivateMessage={onSendPrivateMessage}
          onMarkMessagesAsRead={onMarkMessagesAsRead} 
        />

        {/* Create Room Button */}
        <button
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '420px',
            zIndex: 1000,
            background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            padding: '12px 20px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}
          onClick={() => setShowCreateRoom(true)}
        >
          <span>🏠</span>
          <span>Create Room</span>
        </button>

        {/* NEW: Show Rooms Button */}
        <button
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '420px',
            zIndex: 1000,
            background: 'linear-gradient(135deg, #10B981, #059669)',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            padding: '12px 20px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}
          onClick={() => setShowRoomList(!showRoomList)}
        >
          <span>📋</span>
          <span>Show Rooms</span>
        </button>

        {/* Create Room Popup */}
        {showCreateRoom && (
          <CreateRoomPopup 
            user={user}
            onClose={() => setShowCreateRoom(false)}
            onCreateRoom={(roomData) => {
              console.log('🎉 Room created:', roomData);
              // We'll refresh room list later
            }}
          />
        )}

        {/* NEW: Room List Panel */}
        {showRoomList && (
          <RoomListPanel user={user} />
        )}
      </div>

      {/* RIGHT SIDE - Public Chat Panel - UNCHANGED */}
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column'
      }} className="bg-black/60 border-l border-white/10">
        <ChatPanel
          user={user}
          messages={messages}
          onSend={onSendMessage}
        />
      </div>
    </div>
  );
}