// src/components/GlowingPixel.jsx
import React, { useEffect, useState } from "react";

export default function GlowingPixel({ userData, isCurrentUser }) {
  const [pos, setPos] = useState({
    x: userData.current_x ?? userData.initial_x ?? Math.random(),
    y: userData.current_y ?? userData.initial_y ?? Math.random(),
  });
  const [lum, setLum] = useState(userData.luminosity ?? 0.8);
  const [twinkle, setTwinkle] = useState(!!userData.is_twinkle);

  // Smooth position transitions when DB updates
  useEffect(() => {
    if (userData.current_x == null || userData.current_y == null) return;
    const duration = 600;
    const startX = pos.x;
    const startY = pos.y;
    const dx = userData.current_x - startX;
    const dy = userData.current_y - startY;
    const start = performance.now();
    let raf;
    const animate = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setPos({ x: startX + dx * ease, y: startY + dy * ease });
      if (t < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [userData.current_x, userData.current_y]);

  // React to luminosity and twinkle changes
  useEffect(() => {
    setLum(userData.luminosity ?? 0.8);
    setTwinkle(!!userData.is_twinkle);
  }, [userData.luminosity, userData.is_twinkle]);

  const size = isCurrentUser ? 20 : 14;
  const color = userData.is_online ? (isCurrentUser ? "#fff6a8" : "#ffffff") : "#ff6b6b";

  const twinkleStyle = twinkle
    ? { animation: "twinkle-pulse 0.3s ease-in-out infinite" }
    : {};

  return (
    <>
      <style>{`
        @keyframes twinkle-pulse {
          0% { transform: scale(1); filter: drop-shadow(0 0 ${size * 1.5}px ${color}); }
          50% { transform: scale(1.2); filter: drop-shadow(0 0 ${size * 3.5}px ${color}); }
          100% { transform: scale(1); filter: drop-shadow(0 0 ${size * 1.5}px ${color}); }
        }
      `}</style>

      <div
        title={`${userData.email}\nX:${(pos.x * 100).toFixed(1)}% Y:${(pos.y * 100).toFixed(1)}%`}
        style={{
          position: "absolute",
          left: `${pos.x * 100}%`,
          top: `${pos.y * 100}%`,
          transform: "translate(-50%,-50%)",
          zIndex: isCurrentUser ? 40 : 10,
        }}
      >
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 ${size * 2.5}px ${size / 2}px ${color}`,
            opacity: Math.max(0.05, Math.min(1.5, lum)),
            transition: twinkle ? "none" : "opacity 0.4s ease, box-shadow 0.4s linear",
            ...twinkleStyle,
          }}
        />
      </div>
    </>
  );
}
