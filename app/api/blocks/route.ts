import { NextRequest, NextResponse } from 'next/server';
import { supabase, getCurrentUser } from '@/lib/supabase/client';

export async function PATCH(request: NextRequest) {
  try {
    const { block_id, is_favorite, keyword } = await request.json();

    if (!block_id) {
      return NextResponse.json({ error: 'block_id is required' }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user || !supabase) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const userId = user.id;

    // Get current block
    const { data: block, error: fetchError } = await supabase
      .from('content_blocks')
      .select('*')
      .eq('id', block_id)
      .single();

    if (fetchError || !block) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }

    // Handle keyword-level favorite toggle
    if (keyword) {
      const favoriteKeywords = block.favorite_keywords || [];

      if (is_favorite === true && !favoriteKeywords.includes(keyword)) {
        favoriteKeywords.push(keyword);
      } else if (is_favorite === false) {
        const idx = favoriteKeywords.indexOf(keyword);
        if (idx > -1) favoriteKeywords.splice(idx, 1);
      }

      const { data, error } = await supabase
        .from('content_blocks')
        .update({ favorite_keywords: favoriteKeywords, updated_at: new Date().toISOString() })
        .eq('id', block_id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
      }
      return NextResponse.json(data);
    }

    // Handle block-level favorite toggle
    const newFavoriteState = is_favorite !== undefined ? is_favorite : !block.is_favorite;

    const { data, error } = await supabase
      .from('content_blocks')
      .update({ is_favorite: newFavoriteState, updated_at: new Date().toISOString() })
      .eq('id', block_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating block:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !supabase) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const now = new Date().toISOString();

    const newBlock = {
      id: crypto.randomUUID(),
      user_id: user.id,
      entry_id: body.entry_id || '',
      category: body.category || '其他',
      content: body.content || '',
      keywords: body.keywords || [],
      favorite_keywords: [],
      is_manual: body.is_manual || false,
      is_favorite: false,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('content_blocks')
      .insert([newBlock])
      .select()
      .single();

    if (error) {
      console.error('Error creating block:', error);
      return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating block:', error);
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

    const user = await getCurrentUser();
    if (!user || !supabase) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const { error } = await supabase
      .from('content_blocks')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting block:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}