import React, { useEffect, useRef, useState } from 'react'

export default function GlowingPixel({ userData, isCurrentUser, onMove }) {
  const [pos, setPos] = useState({
    x: userData.current_x ?? userData.initial_x ?? Math.random(),
    y: userData.current_y ?? userData.initial_y ?? Math.random(),
  })
  const [luminosity, setLuminosity] = useState(userData.luminosity ?? 0.8)

  const velocity = useRef({
    dx: (Math.random() - 0.5) * 0.00002, // ≈0.05 px/s
    dy: (Math.random() - 0.5) * 0.00002,
  })

  useEffect(() => {
    let last = performance.now()
    const animate = (t) => {
      const dt = (t - last) / 1000
      last = t

      setPos((p) => {
        let { x, y } = p
        x += velocity.current.dx * dt * 60
        y += velocity.current.dy * dt * 60
        if (x < 0 || x > 1) velocity.current.dx *= -1
        if (y < 0 || y > 1) velocity.current.dy *= -1
        x = Math.max(0, Math.min(1, x))
        y = Math.max(0, Math.min(1, y))
        const newPos = { x, y }
        if (isCurrentUser && onMove) onMove(newPos)
        return newPos
      })

      requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [isCurrentUser, onMove])

  useEffect(() => {
    if (isCurrentUser && userData.is_online) {
      setLuminosity(1)
      const t = setTimeout(() => setLuminosity(0.8), 1500)
      return () => clearTimeout(t)
    }
    setLuminosity(userData.is_online ? 0.8 : 0.2)
  }, [userData.is_online, isCurrentUser])

  const x = pos.x * 100
  const y = pos.y * 100
  const size = isCurrentUser ? 20 : 14
  const glow = userData.is_online
    ? isCurrentUser
      ? '#fff6a8'
      : '#ffffff'
    : '#ff6b6b'

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '9999px',
          background: glow,
          boxShadow: `0 0 ${size * 2.5}px ${size / 2}px ${glow}`,
          opacity: luminosity,
        }}
      />
    </div>
  )
}
