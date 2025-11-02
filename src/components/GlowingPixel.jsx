// src/components/GlowingPixel.jsx
import React, { useEffect, useState, useRef } from "react";

export default function GlowingPixel({ userData, isCurrentUser }) {
  const [pos, setPos] = useState({
    x: userData.current_x ?? userData.initial_x ?? Math.random(),
    y: userData.current_y ?? userData.initial_y ?? Math.random(),
  });

  const [lum, setLum] = useState(userData.luminosity ?? 0.8);
  const [twinkle, setTwinkle] = useState(!!userData.is_twinkle);

  // ⭐ smoother and longer trail (25 frames)
  const trailRef = useRef([]);

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
      const nx = startX + dx * ease;
      const ny = startY + dy * ease;

      // update position
      setPos({ x: nx, y: ny });

      // record trail EVERY frame
      trailRef.current = [
        { x: nx, y: ny },
        ...trailRef.current
      ].slice(0, 25);

      if (t < 1) {
        raf = requestAnimationFrame(animate);
      }
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [userData.current_x, userData.current_y]);

  useEffect(() => {
    setLum(userData.luminosity ?? 0.8);
    setTwinkle(!!userData.is_twinkle);
  }, [userData.luminosity, userData.is_twinkle]);

  const baseColor = userData.is_online
    ? isCurrentUser ? "#ffe97a" : "#ffffff"
    : "#ff6b6b";

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

      {/* 🌠 TRAIL STREAKS */}
      {trailRef.current.map((p, i) => {
        if (i === 0) return null;
        const prev = trailRef.current[i - 1];
        if (!prev) return null;

        const alpha = 0.5 * (1 - i / trailRef.current.length);
        const thickness = (isCurrentUser ? 6 : 4) * (1 - i / trailRef.current.length);

        const x1 = prev.x * 100, y1 = prev.y * 100;
        const x2 = p.x * 100, y2 = p.y * 100;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            <svg style={{ position: "absolute", width: "100%", height: "100%" }}>
              <line
                x1={`${x1}%`}
                y1={`${y1}%`}
                x2={`${x2}%`}
                y2={`${y2}%`}
                stroke={baseColor}
                strokeWidth={thickness}
                strokeOpacity={alpha * lum}
                strokeLinecap="round"
              />
            </svg>
          </div>
        );
      })}

      {/* ⭐ Main Star */}
      <div
        style={{
          position: "absolute",
          left: `${pos.x * 100}%`,
          top: `${pos.y * 100}%`,
          transform: "translate(-50%, -50%)",
          opacity: lum,
          userSelect: "none",
          pointerEvents: "none",
          zIndex: 100,
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
