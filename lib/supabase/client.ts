import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create client with or without credentials
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// Auth helper functions
export async function signInAnonymously(): Promise<{ user: any; error: any }> {
  if (!supabase) {
    return { user: null, error: new Error('Supabase not configured') };
  }
  const { data, error } = await supabase.auth.signInAnonymously();
  return { user: data?.user, error };
}

export async function signInWithEmail(email: string, password: string): Promise<{ user: any; error: any }> {
  if (!supabase) {
    return { user: null, error: new Error('Supabase not configured') };
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { user: data?.user, error };
}

export async function signUpWithEmail(email: string, password: string): Promise<{ user: any; error: any }> {
  if (!supabase) {
    return { user: null, error: new Error('Supabase not configured') };
  }
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { user: data?.user, error };
}

export async function signOut(): Promise<{ error: any }> {
  if (!supabase) {
    return { error: new Error('Supabase not configured') };
  }
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser(): Promise<any> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getSession(): Promise<any> {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Get current auth token for API calls
export async function getAuthToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}