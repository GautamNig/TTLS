// src/components/NightSky.jsx
import React from "react";
import ModernHeader from "./ModernHeader";
import GlowingPixel from "./GlowingPixel";
import ChatPanel from "./ChatPanel";

export default function NightSky({ user, users = [], setUsers, onSignOut, onTwinkle, messages = [], onSendMessage = null }) {
  return (
    <div style={{ 
      display: 'grid',
      gridTemplateColumns: '1fr 384px',
      height: '100vh',
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
            isCurrentUser={(u.email || "").toLowerCase() === (user.email || "").toLowerCase()}
          />
        ))}

        {/* Live counter */}
        <div className="absolute bottom-6 left-6 bg-black/40 backdrop-blur-lg border border-white/10 rounded-2xl px-4 py-2 text-white z-30">
          <div className="text-xs text-white/80">Live Stars</div>
          <div className="font-bold text-lg">{users.length} ✨</div>
        </div>
      </div>

      {/* RIGHT SIDE - Chat Panel with explicit height */}
      <div style={{ 
        height: '100vh', // Explicit height
        display: 'flex',
        flexDirection: 'column'
      }} className="bg-black/60 border-l border-white/10">
      <ChatPanel 
        user={user} 
        messages={messages} 
        onSend={onSendMessage} // Make sure this prop name matches
      />
      </div>
    </div>
  );
}