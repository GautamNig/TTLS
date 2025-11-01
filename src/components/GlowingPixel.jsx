// src/components/GlowingPixel.jsx
import React, { useEffect, useState } from "react";

export default function GlowingPixel({ userData, isCurrentUser }) {
  const [pos, setPos] = useState({
    x: userData.current_x ?? userData.initial_x ?? Math.random(),
    y: userData.current_y ?? userData.initial_y ?? Math.random(),
  });
  const [lum, setLum] = useState(userData.luminosity ?? 0.8);

  // smoothly move when DB position changes
  useEffect(() => {
    const targetX = userData.current_x ?? userData.initial_x ?? pos.x;
    const targetY = userData.current_y ?? userData.initial_y ?? pos.y;
    const duration = 600;
    const startX = pos.x;
    const startY = pos.y;
    const start = performance.now();

    let raf;
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setPos({ x: startX + (targetX - startX) * ease, y: startY + (targetY - startY) * ease });
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData.current_x, userData.current_y]);

  useEffect(() => {
    if (userData.is_online) {
      setLum(isCurrentUser ? 1 : 0.8);
    } else {
      setLum(0.18);
    }
  }, [userData.is_online, isCurrentUser]);

  const size = isCurrentUser ? 20 : 14;
  const color = userData.is_online ? (isCurrentUser ? "#fff6a8" : "#ffffff") : "#ff6b6b";

  return (
    <div
      title={`${userData.email}\nX:${(pos.x * 100).toFixed(1)}% Y:${(pos.y * 100).toFixed(1)}%`}
      style={{
        position: "absolute",
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        transform: "translate(-50%,-50%)",
        pointerEvents: "auto",
        zIndex: isCurrentUser ? 40 : 10,
      }}
    >
      <div style={{
        width: size,
        height: size,
        borderRadius: 9999,
        background: color,
        boxShadow: `0 0 ${size * 2.5}px ${size / 2}px ${color}`,
        opacity: lum,
        transition: "opacity 0.4s ease, box-shadow 0.4s linear"
      }} />
    </div>
  );
}
