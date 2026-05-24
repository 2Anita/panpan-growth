import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let supabase: ReturnType<typeof createSupabaseClient> | null = null;

function getSupabaseClient() {
  if (!supabase && supabaseUrl && supabaseAnonKey) {
    supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase;
}

export function createClient() {
  return getSupabaseClient();
}

export async function getUser() {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data: { user } } = await client.auth.getUser();
  return user;
}

export async function signOut() {
  const client = getSupabaseClient();
  if (!client) return { error: null };
  const { error } = await client.auth.signOut();
  return { error };
}