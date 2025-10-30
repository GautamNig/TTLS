import React from 'react'
import GlowingPixel from './GlowingPixel'

function NightSky({ user, users, onSignOut, onResetPositions }) {
  const onlineUsers = users.filter(u => u.is_online)

  console.log('🌌 NightSky rendering - Total users:', users.length, 'Online:', onlineUsers.length)

  return (
    <div className="min-h-screen bg-night-sky relative overflow-hidden" style={{ height: '100vh', width: '100vw' }}>
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-purple-900/20 to-black"></div>

      {/* Background stars */}
      <div className="absolute inset-0">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={`bg-${i}`}
            className="absolute bg-white rounded-full animate-twinkle"
            style={{
              width: '1px',
              height: '1px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              animationDelay: Math.random() * 8 + 's',
            }}
          />
        ))}
      </div>

      {/* User glowing pixels */}
      {users.map((userData) => (
        <GlowingPixel 
          key={userData.user_id} 
          userData={userData} 
          isCurrentUser={userData.user_id === user.id}
        />
      ))}

      {/* Controls - Simplified */}
      <div className="absolute top-4 right-4 z-50">
        <div className="bg-black/90 backdrop-blur-sm rounded-lg p-4 border border-white/20">
          <div className="flex items-center gap-4">
            <div className="text-white">
              <p className="text-sm font-semibold truncate max-w-[120px]">{user.email}</p>
              <p className="text-xs text-white/80 mt-1">
                Online: <span className="text-green-400 font-bold">{onlineUsers.length}</span>
              </p>
              <p className="text-xs text-white/60 mt-1">
                Total: {users.length}
              </p>
            </div>
            <button
              onClick={onSignOut}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Reset button only */}
      <div className="absolute bottom-4 left-4 z-50">
        <button
          onClick={onResetPositions}
          className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded text-sm transition-colors"
        >
          Reset to Initial Positions
        </button>
      </div>
    </div>
  )
}

export default NightSky