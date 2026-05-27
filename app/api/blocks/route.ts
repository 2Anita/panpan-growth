import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_CATEGORIES } from '@/types';

// In-memory blocks storage
const inMemoryBlocks: any[] = [];

export async function PATCH(request: NextRequest) {
  try {
    const { block_id, keyword, is_favorite } = await request.json();

    if (!block_id) {
      return NextResponse.json({ error: 'block_id is required' }, { status: 400 });
    }

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