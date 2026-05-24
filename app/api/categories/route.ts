import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { DEFAULT_CATEGORIES, UserCategory } from '@/types';

// In-memory store for user categories (fallback when Supabase is not available)
const inMemoryUserCategories: UserCategory[] = [];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const categoriesOnly = searchParams.get('categories_only') === 'true';

    // Try to fetch user custom categories from Supabase
    let userCategories: UserCategory[] = [];
    const { data, error } = await supabase
      .from('user_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Supabase not available, using in-memory categories:', error);
      userCategories = inMemoryUserCategories;
    } else {
      userCategories = (data || []) as UserCategory[];
    }

    // Merge default categories with user categories
    const mergedCategories = [...DEFAULT_CATEGORIES, ...userCategories];

    return NextResponse.json(mergedCategories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    // Fallback to defaults + in-memory user categories
    return NextResponse.json([...DEFAULT_CATEGORIES, ...inMemoryUserCategories]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, color, icon } = await request.json();

    if (!name || !color || !icon) {
      return NextResponse.json({ error: 'name, color, and icon are required' }, { status: 400 });
    }

    // Check for duplicate names (including defaults)
    const allCategories = [...DEFAULT_CATEGORIES, ...inMemoryUserCategories];
    const exists = allCategories.some(c => c.name === name);
    if (exists) {
      return NextResponse.json({ error: 'Category already exists' }, { status: 409 });
    }

    // Prepare new category object
    const newCategory: UserCategory = {
      id: crypto.randomUUID(),
      user_id: 'demo-user',
      name,
      color,
      icon,
      is_system: false,
      keywords: [],
      sort_order: DEFAULT_CATEGORIES.length + inMemoryUserCategories.length + 1,
      usage_count: 0,
      last_used_at: null,
      created_at: new Date().toISOString(),
    };

    // Try to insert into Supabase first
    const { data, error } = await supabase
      .from('user_categories')
      .insert([{
        user_id: 'demo-user',
        name,
        color,
        icon,
        is_system: false,
        keywords: [],
        sort_order: newCategory.sort_order,
        usage_count: 0,
        last_used_at: null,
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert failed, saving to in-memory:', error);
      // Fallback to in-memory storage
      inMemoryUserCategories.push(newCategory);
      return NextResponse.json(newCategory, { status: 201 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, name, color, icon } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Try to update in Supabase first
    const updates: Record<string, string> = {};
    if (name) updates.name = name;
    if (color) updates.color = color;
    if (icon) updates.icon = icon;

    const { data, error } = await supabase
      .from('user_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase update failed, updating in-memory:', error);
      // Fallback to in-memory update
      const idx = inMemoryUserCategories.findIndex(c => c.id === id);
      if (idx > -1) {
        if (name) inMemoryUserCategories[idx].name = name;
        if (color) inMemoryUserCategories[idx].color = color;
        if (icon) inMemoryUserCategories[idx].icon = icon;
        return NextResponse.json(inMemoryUserCategories[idx]);
      }
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Try to delete from Supabase first
    const { error } = await supabase
      .from('user_categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase delete failed, deleting from in-memory:', error);
      // Fallback to in-memory delete
      const idx = inMemoryUserCategories.findIndex(c => c.id === id);
      if (idx > -1) {
        inMemoryUserCategories.splice(idx, 1);
        return new NextResponse(null, { status: 204 });
      }
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}