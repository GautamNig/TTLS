// src/components/NightSky.jsx
import React from "react";
import GlowingPixel from "./GlowingPixel";

export default function NightSky({ user, users = [], setUsers, onSignOut, onResetPositions, onTwinkle }) {
  return (
    <div className="w-full h-screen bg-night-sky relative overflow-hidden min-h-screen">
      <header className="absolute top-4 left-4 right-4 flex justify-between items-center z-30">
        <div className="text-white text-sm">Signed in as <strong>{user.email}</strong></div>
<div className="flex gap-3 items-center">
  <button
    onClick={onResetPositions}
    className="px-3 py-2 rounded-md bg-white/10 text-white"
  >
    Reset
  </button>

  <button
    onClick={onTwinkle}
    className="px-3 py-2 rounded-md font-semibold text-gray-900 bg-yellow-300 hover:scale-105 transform transition"
    title="Make your star twinkle for 3 seconds"
  >
    Twinkle
  </button>

  <button
    onClick={onSignOut}
    className="px-3 py-2 rounded-md font-semibold text-white bg-gradient-to-r from-red-600 to-pink-600 hover:scale-105 transform transition"
  >
    Sign Out
  </button>
</div>

      </header>

      {users.map((u) => (
        <GlowingPixel
          key={u.id || u.email}
          userData={u}
          isCurrentUser={(u.email || "").toLowerCase() === (user.email || "").toLowerCase()}
        />
      ))}

      <div className="absolute bottom-4 left-4 text-white/60 z-30">Stars: {users.length}</div>
    </div>
  );
}
