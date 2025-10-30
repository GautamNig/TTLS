// src/components/NightSky.jsx
import React from 'react'
import GlowingPixel from './GlowingPixel'

export default function NightSky({ user, users = [], setUsers, onSignOut, onResetPositions }) {
  return (
    <div className="w-full h-screen bg-night-sky relative overflow-hidden min-h-screen">
      <header className="absolute top-4 left-4 right-4 flex justify-between items-center z-30">
        <div className="text-white">Signed in as <strong>{user.email}</strong></div>
        <div className="flex gap-3">
          <button onClick={onResetPositions} className="px-3 py-2 rounded-md bg-white/10 text-white">Reset</button>
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
                key={u.id ?? u.email}
                userData={u}
                isCurrentUser={(u.email || '').toLowerCase() === (user.email || '').toLowerCase()}
                onMove={(pos) => {
                // update local state so next rpc sync sends latest coords
                setUsers((prev) =>
                    prev.map((p) =>
                    (p.email || '').toLowerCase() === (u.email || '').toLowerCase()
                        ? { ...p, current_x: pos.x, current_y: pos.y }
                        : p
                    )
                )
                }}
            />
            ))}


      <div className="absolute bottom-4 left-4 text-white/60 z-30">Stars: {users.length}</div>
    </div>
  )
}
