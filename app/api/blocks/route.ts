import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function createSupabaseClient(supabaseUrl: string, supabaseKey: string) {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

async function getUser(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return null;
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

const inMemoryBlocks: any[] = [];

export async function PATCH(request: NextRequest) {
  try {
    const { block_id, keyword, is_favorite } = await request.json();

    if (!block_id) {
      return NextResponse.json({ error: 'block_id is required' }, { status: 400 });
    }

    const user = await getUser(request);
    const supabaseAdmin = getSupabaseAdmin();

    // Handle keyword favorite toggle
    if (keyword !== undefined) {
      if (supabaseAdmin) {
        const { data: block } = await supabaseAdmin
          .from('content_blocks')
          .select('favorite_keywords')
          .eq('id', block_id)
          .single();

        if (block) {
          let favoriteKeywords = block.favorite_keywords || [];
          if (is_favorite === true && !favoriteKeywords.includes(keyword)) {
            favoriteKeywords.push(keyword);
          } else if (is_favorite === false) {
            favoriteKeywords = favoriteKeywords.filter((k: string) => k !== keyword);
          }

          await supabaseAdmin
            .from('content_blocks')
            .update({ favorite_keywords: favoriteKeywords, updated_at: new Date().toISOString() })
            .eq('id', block_id);

          return NextResponse.json({ id: block_id, favorite_keywords: favoriteKeywords });
        }
      }

      // Fallback to in-memory
      const blockIndex = inMemoryBlocks.findIndex(b => b.id === block_id);
      if (blockIndex === -1) {
        return NextResponse.json({ error: 'Block not found' }, { status: 404 });
      }

      let favoriteKeywords = inMemoryBlocks[blockIndex].favorite_keywords || [];
      if (is_favorite === true && !favoriteKeywords.includes(keyword)) {
        favoriteKeywords.push(keyword);
      } else if (is_favorite === false) {
        favoriteKeywords = favoriteKeywords.filter((k: string) => k !== keyword);
      }
      inMemoryBlocks[blockIndex].favorite_keywords = favoriteKeywords;
      return NextResponse.json(inMemoryBlocks[blockIndex]);
    }

    // Handle block favorite toggle (is_favorite can be true, false, or undefined for toggle)
    const newFavoriteState = is_favorite === undefined
      ? !inMemoryBlocks.find(b => b.id === block_id)?.is_favorite
      : is_favorite;

    if (supabaseAdmin) {
      await supabaseAdmin
        .from('content_blocks')
        .update({ is_favorite: newFavoriteState, updated_at: new Date().toISOString() })
        .eq('id', block_id);

      return NextResponse.json({ id: block_id, is_favorite: newFavoriteState });
    }

    // Fallback to in-memory
    const blockIndex = inMemoryBlocks.findIndex(b => b.id === block_id);
    if (blockIndex === -1) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }

    inMemoryBlocks[blockIndex].is_favorite = newFavoriteState;
    inMemoryBlocks[blockIndex].updated_at = new Date().toISOString();

    return NextResponse.json({ id: block_id, is_favorite: newFavoriteState });
  } catch (error) {
    console.error('Error updating block:', error);
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

    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      await supabaseAdmin
        .from('content_blocks')
        .delete()
        .eq('id', id);
      return new NextResponse(null, { status: 204 });
    }

    const blockIndex = inMemoryBlocks.findIndex(b => b.id === id);
    if (blockIndex === -1) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }

    inMemoryBlocks.splice(blockIndex, 1);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting block:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}