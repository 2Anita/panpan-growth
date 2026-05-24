import { NextRequest, NextResponse } from 'next/server';
import { ReflectionRecord, ContentBlock, DEFAULT_CATEGORIES } from '@/types';

// In-memory stores for demo
const inMemoryRecords: ReflectionRecord[] = [];
const inMemoryBlocks: ContentBlock[] = [];

export async function POST(request: NextRequest) {
  try {
    const { content, content_type = 'text', customCategories, preferredCategory } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Build category list - use custom or default
    const categories = customCategories || DEFAULT_CATEGORIES;
    const categoryList = categories.map((c: { name: string; keywords: string[] }) => `${c.name}（关键词：${c.keywords?.join(',') || ''}）`).join('\n');

    // Build preferred category instruction
    let preferredCategoryInstruction = '';
    if (preferredCategory) {
      preferredCategoryInstruction = `\n\n【重要】用户选择了优先分类"${preferredCategory}"，请务必将内容优先归类到该分类，除非内容明显不属于该分类。`;
    }

    // Call DeepSeek API with new system prompt
    const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `你是一个精准的知识拆解专家。用户会输入一段乱序的复盘文字。

你的任务是：
1. 根据用户的[自定义分类列表]，将输入内容拆解为多个独立的"知识碎片"。
2. 每个碎片必须：
   - 彻底脱离上下文也能读懂（AI需微调语义，补全主语，保持语言通顺）。
   - 极其精炼，只保留干货，删除所有冗余描述（背景、重复、客套话等）。
   - 准确归类到最合适的分类。
3. 如果输入内容包含"内心感受"，请只提取表达情绪和感悟的部分。
4. 保持语言自然流畅，不要生硬翻译。${preferredCategoryInstruction}

[自定义分类列表]
${categoryList}

返回格式（JSON数组）：
[
  {
    "category": "分类名称（必须与列表中的名称完全一致）",
    "content": "该碎片的精华内容（1-3句话，必须独立可读，不依赖任何上下文）",
    "keywords": ["关键词1", "关键词2", "关键词3"]
  }
]

注意：
- 只返回JSON数组，不要有任何其他文字。
- 每个碎片必须是独立的，能脱离原文就读懂。
- category必须与列表中的分类名称完全一致。
- content要自然通顺，不要机器翻译腔。`,
          },
          {
            role: 'user',
            content: content,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    let blocks: ContentBlock[] = [];
    let summary = content.slice(0, 50) + (content.length > 50 ? '...' : '');

    if (deepseekResponse.ok) {
      const deepseekData = await deepseekResponse.json();
      const aiContent = deepseekData.choices?.[0]?.message?.content || '';

      try {
        let parsed = JSON.parse(aiContent);
        if (!Array.isArray(parsed)) {
          if (parsed.blocks) {
            parsed = parsed.blocks;
          }
        }

        if (Array.isArray(parsed)) {
          blocks = parsed.map((block: any) => ({
            id: crypto.randomUUID(),
            user_id: 'demo-user',
            entry_id: '',
            category: block.category || '其他',
            content: block.content || '',
            keywords: Array.isArray(block.keywords) ? block.keywords.slice(0, 5) : [],
            favorite_keywords: [],
            is_manual: false,
            is_favorite: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));
        }
      } catch (parseError) {
        console.log('Failed to parse AI response, trying fallback');
        const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
              blocks = parsed.map((block: any) => ({
                id: crypto.randomUUID(),
                user_id: 'demo-user',
                entry_id: '',
                category: block.category || '其他',
                content: block.content || '',
                keywords: Array.isArray(block.keywords) ? block.keywords.slice(0, 5) : [],
                favorite_keywords: [],
                is_manual: false,
                is_favorite: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }));
            }
          } catch {
            console.log('Failed to extract JSON');
          }
        }
      }
    }

    if (blocks.length === 0) {
      blocks = [{
        id: crypto.randomUUID(),
        user_id: 'demo-user',
        entry_id: '',
        category: '其他',
        content: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
        keywords: [],
        favorite_keywords: [],
        is_manual: false,
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }];
      summary = '内容已记录';
    } else {
      summary = blocks.map(b => b.content).join('；');
      if (summary.length > 50) summary = summary.slice(0, 50) + '...';
    }

    const recordId = crypto.randomUUID();
    const newRecord: ReflectionRecord = {
      id: recordId,
      user_id: 'demo-user',
      content,
      content_type,
      summary,
      tags: blocks.map(b => b.category),
      categories: blocks.map(b => b.category),
      todos: [],
      raw_ai_response: { blocks, summary },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'classified',
      is_favorite: false,
    };

    blocks = blocks.map(block => ({ ...block, entry_id: recordId }));

    inMemoryRecords.unshift(newRecord);
    blocks.forEach(block => inMemoryBlocks.unshift(block));

    return NextResponse.json({
      ...newRecord,
      blocks,
    });
  } catch (error) {
    console.error('Error saving record:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const category = searchParams.get('category');
    const keyword = searchParams.get('keyword');
    const searchQuery = searchParams.get('q');
    const blocksOnly = searchParams.get('blocks_only') === 'true';
    const favoritesOnly = searchParams.get('favorites') === 'true';
    const timeFilter = searchParams.get('time'); // today, week, month, all

    // If requesting blocks only (for the new list page)
    if (blocksOnly) {
      let filteredBlocks = [...inMemoryBlocks];

      // IMPORTANT: Filter by category FIRST and ONLY
      // This is the key fix for the filtering issue
      if (category) {
        filteredBlocks = filteredBlocks.filter(b => b.category === category);
      }

      // Then filter by search query in the content and keywords
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredBlocks = filteredBlocks.filter(b =>
          b.content.toLowerCase().includes(query) ||
          (b.keywords && b.keywords.some((k: string) => k.toLowerCase().includes(query)))
        );
      }

      // Filter by time
      if (timeFilter && timeFilter !== 'all') {
        const now = new Date();
        let startDate: Date;
        switch (timeFilter) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          default:
            startDate = new Date(0);
        }
        filteredBlocks = filteredBlocks.filter(b => new Date(b.created_at) >= startDate);
      }

      // Sort by created_at desc
      filteredBlocks.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Add original_content to each block - only for the filtered records
      const blocksWithOriginal = filteredBlocks.slice(0, limit).map(block => {
        // Find the parent record to get original content
        const entry = inMemoryRecords.find(r => r.id === block.entry_id);
        return {
          ...block,
          original_content: entry?.content || '',
          // Use block's own is_favorite, NOT entry's is_favorite
          is_favorite: block.is_favorite,
        };
      });

      return NextResponse.json(blocksWithOriginal);
    }

    // Original behavior - return records with blocks
    let results = [...inMemoryRecords];

    // Filter by favorites
    if (favoritesOnly) {
      results = results.filter(r => r.is_favorite);
    }

    // Filter by category - using block relationship
    if (category) {
      const entryIds = inMemoryBlocks
        .filter(b => b.category === category)
        .map(b => b.entry_id);
      // Only include records that have blocks in the selected category
      results = results.filter(r => entryIds.includes(r.id));
    }

    // Filter by time
    if (timeFilter && timeFilter !== 'all') {
      const now = new Date();
      let startDate: Date;
      switch (timeFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(0);
      }
      results = results.filter(r => new Date(r.created_at) >= startDate);
    }

    // Sort by created_at desc
    results.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const response = results.slice(0, limit).map(record => ({
      ...record,
      blocks: inMemoryBlocks.filter(b => b.entry_id === record.id),
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching records:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { recordId, blockId, keyword, is_favorite } = await request.json();

    // Handle keyword-level favorite toggle
    if (blockId && keyword) {
      const blockIndex = inMemoryBlocks.findIndex(b => b.id === blockId);
      if (blockIndex === -1) {
        return NextResponse.json({ error: 'Block not found' }, { status: 404 });
      }

      const block = inMemoryBlocks[blockIndex];
      const favoriteKeywords = block.favorite_keywords || [];

      if (is_favorite === true && !favoriteKeywords.includes(keyword)) {
        favoriteKeywords.push(keyword);
      } else if (is_favorite === false) {
        const idx = favoriteKeywords.indexOf(keyword);
        if (idx > -1) favoriteKeywords.splice(idx, 1);
      }

      inMemoryBlocks[blockIndex] = {
        ...block,
        favorite_keywords: favoriteKeywords,
        updated_at: new Date().toISOString(),
      };

      return NextResponse.json(inMemoryBlocks[blockIndex]);
    }

    // Handle record-level favorite toggle
    if (recordId) {
      const recordIndex = inMemoryRecords.findIndex(r => r.id === recordId);

      if (recordIndex === -1) {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 });
      }

      const newFavoriteState = is_favorite !== undefined ? is_favorite : !inMemoryRecords[recordIndex].is_favorite;

      inMemoryRecords[recordIndex] = {
        ...inMemoryRecords[recordIndex],
        is_favorite: newFavoriteState,
        updated_at: new Date().toISOString(),
      };

      return NextResponse.json(inMemoryRecords[recordIndex]);
    }

    return NextResponse.json({ error: 'recordId or blockId is required' }, { status: 400 });
  } catch (error) {
    console.error('Error updating record:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}