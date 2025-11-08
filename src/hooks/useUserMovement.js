// src/hooks/useUserMovement.js
import { useEffect, useRef } from "react";
import { supabaseHelpers } from "../utils/supabaseHelpers";
import { APP_CONSTANTS } from "../constants/appConstants";

export default function useUserMovement(user, setUsers) {
  const driftRef = useRef({});

  useEffect(() => {
    if (!user) return;
    
    const email = (user.email || "").toLowerCase();

    // Initialize drift for this user if not exists
    if (!driftRef.current[email]) {
      driftRef.current[email] = {
        dx: (Math.random() - 0.5) * 0.01,
        dy: (Math.random() - 0.5) * 0.01,
      };
    }

    const movementInterval = setInterval(() => {
      setUsers((prev) => {
        return prev.map((u) => {
          if ((u.email || "").toLowerCase() !== email || !u.is_online) return u;
          
          let nx = (u.current_x ?? u.initial_x ?? 0.5) + driftRef.current[email].dx;
          let ny = (u.current_y ?? u.initial_y ?? 0.5) + driftRef.current[email].dy;
          
          // Wrap around edges
          if (nx > 1) nx = 0;
          if (nx < 0) nx = 1;
          if (ny > 1) ny = 0;
          if (ny < 0) ny = 1;

          // Update position in database
          supabaseHelpers.updateUserPosition(email, nx, ny);

          return { ...u, current_x: nx, current_y: ny };
        });
      });
    }, APP_CONSTANTS.TIMING.USER_MOVEMENT_INTERVAL);

    return () => clearInterval(movementInterval);
  }, [user, setUsers]);
}