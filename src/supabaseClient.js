// src/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY; // DEV ONLY

// single main client (auth + realtime)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: "ttls-auth-storage",
    autoRefreshToken: true,
  },
});

// service client (no session persistence) - different storageKey prevents GoTrue warning
export const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, storageKey: "ttls-service-storage" },
  global: { headers: { "x-client-role": "service" } },
});
