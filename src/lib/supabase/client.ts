"use client";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

export function createBrowserSupabaseClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey());
}
