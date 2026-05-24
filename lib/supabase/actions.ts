import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create client only if credentials exist
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function getSupabaseClient() {
  return supabase;
}

// Category CRUD operations
export async function getCategories(userId: string = 'demo-user') {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  return data || [];
}

export async function createCategory(category: {
  name: string;
  color: string;
  icon: string;
  is_system?: boolean;
  keywords?: string[];
  user_id?: string;
}) {
  if (!supabase) return { error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('categories')
    .insert([{
      id: crypto.randomUUID(),
      user_id: category.user_id || 'demo-user',
      name: category.name,
      color: category.color,
      icon: category.icon,
      is_system: category.is_system || false,
      keywords: category.keywords || [],
      sort_order: 999,
      usage_count: 0,
      last_used_at: null,
      created_at: new Date().toISOString(),
    }])
    .select()
    .single();

  return { data, error };
}

export async function updateCategory(id: string, updates: {
  name?: string;
  color?: string;
  icon?: string;
}) {
  if (!supabase) return { error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function deleteCategory(id: string) {
  if (!supabase) return { error: 'Supabase not configured' };

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  return { error };
}

// Record operations
export async function getRecords(limit: number = 100) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('records')
    .select('*, blocks:content_blocks(*)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching records:', error);
    return [];
  }

  return data || [];
}

export async function createRecord(record: {
  content: string;
  content_type: 'text' | 'voice' | 'image';
  categories?: string[];
  user_id?: string;
}) {
  if (!supabase) return { error: 'Supabase not configured' };

  const recordId = crypto.randomUUID();

  const { data: newRecord, error: recordError } = await supabase
    .from('records')
    .insert([{
      id: recordId,
      user_id: record.user_id || 'demo-user',
      content: record.content,
      content_type: record.content_type,
      summary: '',
      tags: record.categories || [],
      categories: record.categories || [],
      todos: [],
      is_favorite: false,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }])
    .select()
    .single();

  return { data: newRecord, error: recordError };
}

export async function toggleFavorite(recordId: string) {
  if (!supabase) return { error: 'Supabase not configured' };

  // First get current state
  const { data: current } = await supabase
    .from('records')
    .select('is_favorite')
    .eq('id', recordId)
    .single();

  if (!current) return { error: 'Record not found' };

  const newValue = !current.is_favorite;

  const { data, error } = await supabase
    .from('records')
    .update({ is_favorite: newValue, updated_at: new Date().toISOString() })
    .eq('id', recordId)
    .select()
    .single();

  return { data, error };
}