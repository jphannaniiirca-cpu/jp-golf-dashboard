"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const isSupabaseConfigured = (): boolean =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );

let _client: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) return null;
  if (!_client) {
    // The JS client needs the base project URL, not /rest/v1/ — strip if present
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
      .replace(/\/rest\/v1\/?$/, "")
      .replace(/\/$/, "");
    _client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  }
  return _client;
};
