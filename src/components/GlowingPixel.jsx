import React, { useEffect, useState, useRef } from "react";

export default function GlowingPixel({
  userData,
  allUsers = [],
  isCurrentUser,
  onFollow,
  recentFriendships = [],
}) {
  const [pos, setPos] = useState({
    x: userData.current_x ?? userData.initial_x ?? Math.random(),
    y: userData.current_y ?? userData.initial_y ?? Math.random(),
  });
  const [lum, setLum] = useState(userData.luminosity ?? 0.8);
  const [twinkle, setTwinkle] = useState(!!userData.is_twinkle);
  const [followed, setFollowed] = useState(false);
  const trailRef = useRef([]);

  // smooth movement animation
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

      setPos({ x: nx, y: ny });
      trailRef.current = [{ x: nx, y: ny }, ...trailRef.current].slice(0, 25);

      if (t < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [userData.current_x, userData.current_y]);

  useEffect(() => {
    setLum(userData.luminosity ?? 0.8);
    setTwinkle(!!userData.is_twinkle);
  }, [userData.luminosity, userData.is_twinkle]);

  const baseColor = userData.is_online
    ? isCurrentUser
      ? "#ffe97a"
      : "#ffffff"
    : "#ff6b6b";

  const size = isCurrentUser ? 30 : 22;

  // Check if friendship glow applies
  const friendConnection = recentFriendships.find(
    (f) =>
      (f.user1 === userData.user_id &&
        allUsers.find((u) => u.user_id === f.user2)) ||
      (f.user2 === userData.user_id &&
        allUsers.find((u) => u.user_id === f.user1))
  );

  const connectedUser = friendConnection
    ? allUsers.find(
        (u) =>
          u.user_id === friendConnection.user1 ||
          u.user_id === friendConnection.user2
      )
    : null;

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

      {/* Glow connection line if recently became friends */}
      {connectedUser && (
        <svg
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            left: 0,
            top: 0,
            pointerEvents: "none",
            zIndex: 50,
          }}
        >
          <line
            x1={`${pos.x * 100}%`}
            y1={`${pos.y * 100}%`}
            x2={`${connectedUser.current_x * 100}%`}
            y2={`${connectedUser.current_y * 100}%`}
            stroke="cyan"
            strokeWidth="3"
            strokeOpacity="0.8"
            filter="drop-shadow(0 0 6px cyan)"
          />
        </svg>
      )}

      {/* Main star */}
      <div
        style={{
          position: "absolute",
          left: `${pos.x * 100}%`,
          top: `${pos.y * 100}%`,
          transform: "translate(-50%, -50%)",
          opacity: lum,
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
            pointerEvents: "none",
          }}
        >
          ★
        </div>

        {!isCurrentUser && (
          <div
            className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 flex flex-col items-center gap-1"
            style={{ pointerEvents: "auto" }}
          >
            {!followed && (
              <button
                onClick={() => {
                  console.log("Follow clicked for", userData.user_id);
                  setFollowed(true);
                  onFollow?.(userData.user_id);
                }}
                className="px-2 py-1 bg-blue-600 text-xs rounded hover:bg-blue-500 cursor-pointer"
              >
                Follow
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
