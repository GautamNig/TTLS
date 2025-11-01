// src/App.jsx
import React, { useEffect, useRef, useState } from "react";
import { supabase, supabaseService } from "./supabaseClient";
import AuthPage from "./components/AuthPage";
import NightSky from "./components/NightSky";
import "./index.css";

/*
 Behavior:
 - single supabase client handles auth + realtime
 - service client used only for mark_user_offline_by_email (reliable)
 - current user writes its position every 500ms via update_user_position RPC
 - realtime subscription updates all clients instantly
 - signout flow:
    1) optimistic local dim
    2) call service RPC to mark offline
    3) remove realtime channels
    4) signOut()
*/

export default function App() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const isSigningOutRef = useRef(false);

  // drift directions per user (client only)
  const driftRef = useRef({});

  // initial session + auth listener
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        setUser(data.session.user);
        await markUserOnline(data.session.user);
      }
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("🔐 Auth change:", event);
      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
        markUserOnline(session.user).catch((e) => console.error(e));
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setUsers([]);
      }
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // realtime subscription (single channel) - always present after app loads
  useEffect(() => {
    const channel = supabase
      .channel("user_positions_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_positions" },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          setUsers((prev) => {
            const email = (row.email || "").toLowerCase();
            const idx = prev.findIndex((p) => (p.email || "").toLowerCase() === email);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...row };
              return copy;
            } else {
              return [...prev, row];
            }
          });
        }
      )
      .subscribe((status) => console.log("Realtime status:", status));

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // initial fetch
  useEffect(() => {
    fetchAllUsers();
  }, []);

  async function fetchAllUsers() {
    try {
      const { data, error } = await supabase.from("user_positions").select("*");
      if (error) throw error;
      setUsers(data || []);
    } catch (e) {
      console.error("fetchAllUsers error", e);
    }
  }

  async function markUserOnline(authUser) {
    try {
      const email = (authUser.email || "").toLowerCase();
      const { error } = await supabase.rpc("get_or_create_user_position", {
        p_user_id: authUser.id,
        p_email: email,
      });
      if (error) throw error;
      await fetchAllUsers();
    } catch (e) {
      console.error("markUserOnline error", e);
    }
  }

  // reliable offline call, uses service key (runs regardless of auth token)
  async function markUserOfflineViaService(email) {
    try {
      await supabaseService.rpc("mark_user_offline_by_email", { user_email: email });
      // also fetch to refresh local state (realtime should broadcast)
      await fetchAllUsers();
    } catch (e) {
      console.error("markUserOfflineViaService error", e);
    }
  }

  // sign out sequence
  async function handleSignOut() {
    if (!user) return;
    const email = (user.email || "").toLowerCase();
    if (isSigningOutRef.current) return;
    isSigningOutRef.current = true;

    // optimistic local update -> dim & mark offline locally
    setUsers((prev) => prev.map((u) => ((u.email || "").toLowerCase() === email ? { ...u, is_online: false, luminosity: 0.1 } : u)));

    try {
      // 1) server-side mark offline via service role (reliable)
      await markUserOfflineViaService(email);

      // 2) remove realtime channels to avoid reconnect race
      try { await supabase.removeAllChannels(); } catch (e) { console.warn("removeAllChannels failed", e); }

      // 3) sign out
      const { error } = await supabase.auth.signOut();
      if (error) console.warn("auth.signOut error", error);

      // final local cleanup
      setUser(null);
      setUsers((prev) => prev.map((u) => ((u.email || "").toLowerCase() === email ? { ...u, is_online: false, luminosity: 0.1 } : u)));
    } catch (e) {
      console.error("handleSignOut failed", e);
    } finally {
      isSigningOutRef.current = false;
    }
  }

  // movement: current logged-in client updates its own position to DB every 500ms
  useEffect(() => {
    if (!user) return;
    const email = (user.email || "").toLowerCase();

    // create drift vector if not present (client-side deterministic random for velocity)
    if (!driftRef.current[email]) {
      driftRef.current[email] = {
        dx: (Math.random() - 0.5) * 0.002, // tuned small
        dy: (Math.random() - 0.5) * 0.002,
      };
    }

    const id = setInterval(() => {
      setUsers((prev) => {
        return prev.map((u) => {
          if ((u.email || "").toLowerCase() !== email || !u.is_online) return u;
          let nx = (u.current_x ?? u.initial_x ?? 0.5) + driftRef.current[email].dx;
          let ny = (u.current_y ?? u.initial_y ?? 0.5) + driftRef.current[email].dy;
          // wrap around
          if (nx > 1) nx = 0;
          if (nx < 0) nx = 1;
          if (ny > 1) ny = 0;
          if (ny < 0) ny = 1;

          // write to DB (async, fire-and-forget but errors logged)
          (async () => {
            try {
              const { error } = await supabase.rpc("update_user_position", { p_email: email, p_x: nx, p_y: ny });
              if (error) console.warn("update_user_position error", error);
            } catch (err) {
              console.warn("update_user_position exception", err);
            }
          })();

          return { ...u, current_x: nx, current_y: ny };
        });
      });
    }, 500); // every 500ms

    return () => clearInterval(id);
  }, [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>;

  if (!user) return <AuthPage onSignIn={() => supabase.auth.signInWithOAuth({ provider: "google" })} />;

  return (
    <NightSky
      user={user}
      users={users}
      setUsers={setUsers}
      onSignOut={handleSignOut}
      onResetPositions={async () => { await supabase.rpc("reset_user_positions"); fetchAllUsers(); }}
    />
  );
}
