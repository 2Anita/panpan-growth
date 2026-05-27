import { NextRequest, NextResponse } from 'next/server';
import { supabase, getCurrentUser } from '@/lib/supabase/client';
import { DEFAULT_CATEGORIES, CATEGORY_COLORS } from '@/types';

// Valid categories mapping
const VALID_CATEGORIES: Record<string, string> = {
  '创意灵感': '创意灵感',
  '问题解决': '问题解决',
  '情绪变化': '情绪变化',
  '技术学习': '技术学习',
  '行动TODO': '行动TODO',
  '其他': '其他',
};

export async function POST(request: NextRequest) {
  try {
    const { content, content_type = 'text', customCategories, preferredCategory } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const user = await getCurrentUser();
    const userId = user?.id || 'anonymous-user';

    // Build category list
    const categories = customCategories || DEFAULT_CATEGORIES;
    const categoryList = categories.map((c: { name: string; keywords: string[] }) =>
      `${c.name}（关键词：${c.keywords?.join(',') || ''}）`
    ).join('\n');

    // Build preferred category instruction
    let preferredCategoryInstruction = '';
    if (preferredCategory) {
      preferredCategoryInstruction = `\n\n【重要】用户选择了优先分类"${preferredCategory}"，请务必将内容优先归类到该分类，除非内容明显不属于该分类。`;
    }

    // Call DeepSeek API
    let blocks: any[] = [];
    const aiApiKey = process.env.DEEPSEEK_API_KEY;

    if (aiApiKey && aiApiKey !== 'your-deepseek-api-key-here') {
      try {
        const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiApiKey}`,
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

        if (deepseekResponse.ok) {
          const deepseekData = await deepseekResponse.json();
          const aiContent = deepseekData.choices?.[0]?.message?.content || '';

          try {
            let parsed = JSON.parse(aiContent);
            if (!Array.isArray(parsed) && parsed.blocks) {
              parsed = parsed.blocks;
            }

            if (Array.isArray(parsed)) {
              blocks = parsed.map((block: any) => ({
                category: VALID_CATEGORIES[block.category] || '其他',
                content: block.content || '',
                keywords: Array.isArray(block.keywords) ? block.keywords.slice(0, 5) : [],
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
                    category: VALID_CATEGORIES[block.category] || '其他',
                    content: block.content || '',
                    keywords: Array.isArray(block.keywords) ? block.keywords.slice(0, 5) : [],
                  }));
                }
              } catch {
                console.log('Failed to extract JSON');
              }
            }
          }
        }
      } catch (aiError) {
        console.error('AI API error:', aiError);
      }
    }

    // Fallback if no blocks generated
    if (blocks.length === 0) {
      blocks = [{
        category: '其他',
        content: content.slice(0, 200),
        keywords: [],
      }];
    }

    // Prepare data for Supabase
    const recordId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Save to Supabase if available and user is authenticated
    let savedRecord: any = null;
    let savedBlocks: any[] = [];

    if (supabase && user) {
      try {
        // Save the main record
        const { data: recordData, error: recordError } = await supabase
          .from('records')
          .insert({
            id: recordId,
            user_id: userId,
            content,
            content_type,
            summary: blocks.map(b => b.content).join('；').slice(0, 200),
            keywords: blocks.flatMap(b => b.keywords || []),
            categories: blocks.map(b => b.category),
            todos: [],
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();

        if (!recordError && recordData) {
          savedRecord = recordData;

          // Save content blocks
          const blocksToSave = blocks.map((block, index) => ({
            id: crypto.randomUUID(),
            user_id: userId,
            entry_id: recordId,
            category: block.category,
            content: block.content,
            keywords: block.keywords || [],
            is_manual: false,
            is_favorite: false,
            created_at: now,
            updated_at: now,
          }));

          const { data: blocksData, error: blocksError } = await supabase
            .from('content_blocks')
            .insert(blocksToSave)
            .select();

          if (!blocksError && blocksData) {
            savedBlocks = blocksData;
          }
        }
      } catch (dbError) {
        console.error('Supabase save error:', dbError);
      }
    }

    // Build response
    const summary = blocks.map(b => b.content).join('；').slice(0, 100);

    const response = {
      id: recordId,
      user_id: userId,
      content,
      content_type,
      summary,
      keywords: blocks.flatMap(b => b.keywords || []),
      categories: blocks.map(b => b.category),
      todos: [],
      created_at: now,
      updated_at: now,
      is_favorite: false,
      blocks: savedBlocks.length > 0 ? savedBlocks : blocks.map((b, i) => ({
        id: crypto.randomUUID(),
        user_id: userId,
        entry_id: recordId,
        category: b.category,
        content: b.content,
        keywords: b.keywords || [],
        favorite_keywords: [],
        is_manual: false,
        is_favorite: false,
        created_at: now,
        updated_at: now,
      })),
    };

    return NextResponse.json(response);
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
    const searchQuery = searchParams.get('q');
    const blocksOnly = searchParams.get('blocks_only') === 'true';
    const favoritesOnly = searchParams.get('favorites') === 'true';
    const timeFilter = searchParams.get('time');

    const user = await getCurrentUser();
    const userId = user?.id || 'anonymous-user';

    // Try to fetch from Supabase if user is authenticated
    if (supabase && user) {
      let query = supabase
        .from('content_blocks')
        .select('*')
        .eq('user_id', userId);

      if (category) {
        query = query.eq('category', category);
      }

      if (searchQuery) {
        query = query.or(`content.ilike.%${searchQuery}%,keywords.cs.{${searchQuery}}`);
      }

      if (favoritesOnly) {
        query = query.eq('is_favorite', true);
      }

      if (timeFilter && timeFilter !== 'all') {
        const now = new Date();
        let startDate: string;
        switch (timeFilter) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            break;
          default:
            startDate = '1970-01-01T00:00:00Z';
        }
        query = query.gte('created_at', startDate);
      }

      query = query.order('created_at', { ascending: false }).limit(limit);

      const { data: blocks, error } = await query;

      if (!error && blocks && blocks.length > 0) {
        // Get original content from records
        const entryIds = [...new Set(blocks.map((b: any) => b.entry_id))];
        const { data: records } = await supabase
          .from('records')
          .select('id, content')
          .in('id', entryIds);

        const recordsMap: Record<string, string> = {};
        records?.forEach((r: any) => {
          recordsMap[r.id] = r.content;
        });

        return NextResponse.json(blocks.map((b: any) => ({
          ...b,
          original_content: recordsMap[b.entry_id] || '',
        })));
      }
    }

    // Return empty if not authenticated
    return NextResponse.json([]);
  } catch (error) {
    console.error('Error fetching records:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}