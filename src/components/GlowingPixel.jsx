// src/components/GlowingPixel.jsx
import React, { useEffect, useState } from "react";

export default function GlowingPixel({ userData, isCurrentUser }) {
  const [pos, setPos] = useState({
    x: userData.current_x ?? userData.initial_x ?? Math.random(),
    y: userData.current_y ?? userData.initial_y ?? Math.random(),
  });
  const [lum, setLum] = useState(userData.luminosity ?? 0.8);
  const [twinkle, setTwinkle] = useState(!!userData.is_twinkle);

  // Smooth position animation
  useEffect(() => {
    if (userData.current_x == null || userData.current_y == null) return;
    const duration = 500;
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

  // Handle luminosity and twinkle state
  useEffect(() => {
    setLum(userData.luminosity ?? 0.8);
    setTwinkle(!!userData.is_twinkle);
  }, [userData.luminosity, userData.is_twinkle]);

  const baseColor = userData.is_online
    ? isCurrentUser
      ? "#ffe97a" // yellow for current user
      : "#ffffff" // white for others
    : "#ff6b6b"; // red for offline users

  const size = isCurrentUser ? 30 : 22;

  return (
    <>
      <style>{`
        @keyframes twinklePulse {
          0%, 100% { transform: scale(1); opacity: 1; text-shadow: 0 0 8px ${baseColor}, 0 0 16px ${baseColor}; }
          50% { transform: scale(1.2); opacity: 0.7; text-shadow: 0 0 16px ${baseColor}, 0 0 32px ${baseColor}; }
        }
        @keyframes slowGlow {
          0%, 100% { text-shadow: 0 0 6px ${baseColor}, 0 0 12px ${baseColor}; }
          50% { text-shadow: 0 0 14px ${baseColor}, 0 0 28px ${baseColor}; }
        }
      `}</style>

      <div
        title={`${userData.email}\nX:${(pos.x * 100).toFixed(1)}% Y:${(
          pos.y * 100
        ).toFixed(1)}%`}
        style={{
          position: "absolute",
          left: `${pos.x * 100}%`,
          top: `${pos.y * 100}%`,
          transform: "translate(-50%, -50%)",
          transition: "opacity 0.5s ease-in-out",
          opacity: lum,
          zIndex: isCurrentUser ? 50 : 10,
        }}
      >
        <div
          style={{
            fontSize: `${size}px`,
            color: baseColor,
            textShadow: `0 0 8px ${baseColor}, 0 0 20px ${baseColor}`,
            animation: twinkle
              ? "twinklePulse 0.4s ease-in-out infinite"
              : "slowGlow 3s ease-in-out infinite",
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          ★
        </div>
        {isCurrentUser && (
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 text-xs text-white bg-black/40 px-1 rounded whitespace-nowrap">
            You
          </div>
        )}
      </div>
    </>
  );
}
