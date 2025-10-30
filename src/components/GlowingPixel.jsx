import React, { useState, useEffect } from 'react'

function GlowingPixel({ userData, isCurrentUser }) {
  const [luminosity, setLuminosity] = useState(userData.luminosity || 0.1)

  useEffect(() => {
    if (isCurrentUser && userData.is_online) {
      setLuminosity(1.0)
      const timer = setTimeout(() => {
        setLuminosity(0.7)
      }, 3000)
      return () => clearTimeout(timer)
    } else if (!userData.is_online) {
      setLuminosity(0.1)
    } else {
      setLuminosity(0.7)
    }
  }, [userData.is_online, userData.luminosity, isCurrentUser])

  // Use current position, fallback to initial position
  const x = (userData.current_x || userData.initial_x || 0.5) * 100
  const y = (userData.current_y || userData.initial_y || 0.5) * 100

  const pulse = userData.is_online ? 1 + Math.sin(Date.now() * 0.003) * 0.3 : 1
  const glowColor = userData.is_online ? (isCurrentUser ? '#ffff00' : '#ffffff') : '#ff4444'

  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 transition-all duration-500"
      style={{
        left: `${x}%`,
        top: `${y}%`,
      }}
      title={`${isCurrentUser ? '✨ You' : 'User'}
${userData.email}
${userData.is_online ? '🟢 Online' : '🔴 Offline'}`}
    >
      <div
        className="rounded-full transition-all duration-500"
        style={{
          width: isCurrentUser ? '20px' : '16px',
          height: isCurrentUser ? '20px' : '16px',
          backgroundColor: glowColor,
          boxShadow: `0 0 ${isCurrentUser ? '40px' : '30px'} ${isCurrentUser ? '20px' : '15px'} ${glowColor}${userData.is_online ? '80' : '40'}`,
          transform: `scale(${pulse})`,
          opacity: luminosity,
        }}
      />
    </div>
  )
}

export default GlowingPixel