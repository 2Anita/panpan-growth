import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase clients
function createSupabaseClient(supabaseUrl: string, supabaseKey: string) {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

// Get Supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

// Get user from request
async function getUser(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return null;

  // Try to get token from Authorization header (Bearer token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && user) return user;
  }

  return null;
}

// In-memory blocks storage
const inMemoryBlocks: any[] = [];

export async function PATCH(request: NextRequest) {
  try {
    const { block_id, keyword, is_favorite } = await request.json();

    if (!block_id) {
      return NextResponse.json({ error: 'block_id is required' }, { status: 400 });
    }

    // Try Supabase first
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      try {
        if (keyword) {
          // Keyword favorite toggle
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
        } else {
          // Block favorite toggle
          await supabaseAdmin
            .from('content_blocks')
            .update({ is_favorite, updated_at: new Date().toISOString() })
            .eq('id', block_id);

          return NextResponse.json({ id: block_id, is_favorite });
        }
      } catch (error) {
        console.error('Supabase PATCH error:', error);
      }
    }

    // Fallback to in-memory
    const blockIndex = inMemoryBlocks.findIndex(b => b.id === block_id);
    if (blockIndex === -1) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }

    // Handle keyword favorite toggle
    if (keyword) {
      const favoriteKeywords = inMemoryBlocks[blockIndex].favorite_keywords || [];

      if (is_favorite === true && !favoriteKeywords.includes(keyword)) {
        favoriteKeywords.push(keyword);
      } else if (is_favorite === false) {
        const idx = favoriteKeywords.indexOf(keyword);
        if (idx > -1) favoriteKeywords.splice(idx, 1);
      }

      inMemoryBlocks[blockIndex] = {
        ...inMemoryBlocks[blockIndex],
        favorite_keywords: favoriteKeywords,
        updated_at: new Date().toISOString(),
      };

      return NextResponse.json(inMemoryBlocks[blockIndex]);
    }

    // Handle block favorite toggle
    const newFavoriteState = is_favorite !== undefined ? is_favorite : !inMemoryBlocks[blockIndex].is_favorite;

    inMemoryBlocks[blockIndex] = {
      ...inMemoryBlocks[blockIndex],
      is_favorite: newFavoriteState,
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json(inMemoryBlocks[blockIndex]);
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

    // Try Supabase first
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('content_blocks')
          .delete()
          .eq('id', id);
        return new NextResponse(null, { status: 204 });
      } catch (error) {
        console.error('Supabase DELETE error:', error);
      }
    }

    // Fallback to in-memory
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