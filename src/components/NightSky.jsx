// src/components/NightSky.jsx
import React from "react";
import ModernHeader from "./ModernHeader";
import GlowingPixel from "./GlowingPixel";

export default function NightSky({ user, users = [], setUsers, onSignOut, onTwinkle }) {
  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden min-h-screen">
      {/* Animated background stars */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent"></div>
      
      <ModernHeader user={user} onSignOut={onSignOut} onTwinkle={onTwinkle} />

      {/* Stars container */}
      {users.map((u) => (
        <GlowingPixel
          key={u.id || u.email}
          userData={u}
          isCurrentUser={(u.email || "").toLowerCase() === (user.email || "").toLowerCase()}
        />
      ))}

      {/* Modern counter */}
      <div className="absolute bottom-6 left-6 bg-black/40 backdrop-blur-lg border border-white/10 rounded-2xl px-6 py-3 shadow-2xl">
        <div className="text-white/80 text-sm">Live Stars</div>
        <div className="text-white font-bold text-xl bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          {users.length} ✨
        </div>
      </div>
    </div>
  );
}