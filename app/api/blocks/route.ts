import { NextRequest, NextResponse } from 'next/server';
import { ContentBlock } from '@/types';

// In-memory content blocks storage (simulating Supabase)
const inMemoryBlocks: ContentBlock[] = [];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const blockId = searchParams.get('id');

    // Get single block
    if (blockId) {
      const block = inMemoryBlocks.find(b => b.id === blockId);
      if (!block) {
        return NextResponse.json({ error: 'Block not found' }, { status: 404 });
      }
      return NextResponse.json(block);
    }

    // Filter blocks
    let filtered = [...inMemoryBlocks];

    if (category) {
      filtered = filtered.filter(b => b.category === category);
    }

    // Sort by created_at desc
    filtered.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('Error fetching blocks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { block_id, is_favorite, keyword } = await request.json();

    if (!block_id) {
      return NextResponse.json({ error: 'block_id is required' }, { status: 400 });
    }

    const blockIndex = inMemoryBlocks.findIndex(b => b.id === block_id);
    if (blockIndex === -1) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }

    // Handle keyword-level favorite toggle
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

    // Handle block-level favorite toggle
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      user_id: body.user_id || 'demo-user',
      entry_id: body.entry_id || '',
      category: body.category || '其他',
      content: body.content || '',
      keywords: body.keywords || [],
      favorite_keywords: [],
      is_manual: body.is_manual || false,
      is_favorite: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    inMemoryBlocks.unshift(newBlock);

    return NextResponse.json(newBlock, { status: 201 });
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