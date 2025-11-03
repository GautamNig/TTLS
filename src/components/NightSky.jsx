// src/components/NightSky.jsx
import React from "react";
import ModernHeader from "./ModernHeader";
import GlowingPixel from "./GlowingPixel";
import ChatPanel from "./ChatPanel";
import PrivateChatPopup from "./PrivateChatPopup";

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

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 384px',
      height: '150vh',
      width: '100vw',
      overflow: 'hidden'
    }} className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">

      {/* LEFT SIDE - Starfield */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
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
      </div>

      {/* RIGHT SIDE - Public Chat Panel */}
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