import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_CATEGORIES } from '@/types';

// Valid categories mapping - strict mapping
const VALID_CATEGORIES: Record<string, string> = {
  '创意灵感': '创意灵感',
  '问题解决': '问题解决',
  '情绪变化': '情绪变化',
  '技术学习': '技术学习',
  '内心感受': '内心感受',
  '行动TODO': '行动TODO',
  '其他': '其他',
};

// Normalize category name to valid category
function normalizeCategory(cat: string): string {
  return VALID_CATEGORIES[cat] || '其他';
}

// Create Supabase clients
function createSupabaseClient(supabaseUrl: string, supabaseKey: string) {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

// Get Supabase admin client (service role key bypasses RLS)
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

// Get Supabase anon client
function getSupabaseAnon() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
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

  // Try to get token from cookie (Supabase session cookie)
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map(c => {
        const [key, ...val] = c.split('=');
        return [key, val.join('=')];
      })
    );
    const supabaseToken = cookies['sb-access-token'] || cookies['supabase-auth-token'];
    if (supabaseToken) {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(supabaseToken);
      if (!error && user) return user;
    }
  }

  return null;
}

// In-memory stores for local/demo mode
const inMemoryRecords: any[] = [];
const inMemoryBlocks: any[] = [];

export async function POST(request: NextRequest) {
  try {
    const { content, content_type = 'text', preferredCategory } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const user = await getUser(request);
    const userId = user?.id || 'anonymous';
    const now = new Date().toISOString();

    // Build category list for AI
    const categoryList = DEFAULT_CATEGORIES.map((c: any) =>
      `${c.icon} ${c.name}`
    ).join('\n');

    // Build preferred category instruction
    let preferredCategoryInstruction = '';
    if (preferredCategory) {
      preferredCategoryInstruction = `\n\n【重要】用户选择了优先分类"${preferredCategory}"，请务必将内容优先归类到该分类，除非内容明显不属于该分类。`;
    }

    // Call DeepSeek API
    let blocks: any[] = [];
    const aiApiKey = process.env.DEEPSEEK_API_KEY;

    if (aiApiKey && !aiApiKey.includes('your-')) {
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
1. 根据用户的[分类列表]，将输入内容拆解为多个独立的"知识碎片"。
2. 每个碎片必须：
   - 彻底脱离上下文也能读懂（AI需微调语义，补全主语，保持语言通顺）。
   - 极其精炼，只保留干货，删除所有冗余描述（背景、重复、客套话等）。
   - 准确归类到最合适的分类。
3. 如果输入内容包含"内心感受"，请只提取表达情绪和感悟的部分。
4. 保持语言自然流畅，不要生硬翻译。${preferredCategoryInstruction}

[分类列表 - 必须使用这些精确的分类名称]
💡 创意灵感
🔧 问题解决
💗 情绪变化
📚 技术学习
✨ 内心感受
✅ 行动TODO
📝 其他

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
- category必须与列表中的分类名称完全一致，不能自己发明分类名。
- content要自然通顺，不要机器翻译腔。
- 如果内容不属于任何特定分类，才使用"其他"。`,
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
                category: normalizeCategory(block.category),
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
                    category: normalizeCategory(block.category),
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
        category: normalizeCategory(preferredCategory || '其他'),
        content: content.slice(0, 200),
        keywords: [],
      }];
    }

    // Generate summary
    const summary = blocks.map(b => b.content).join('；').slice(0, 100);

    // Create record
    const recordId = crypto.randomUUID();
    const record = {
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
      blocks: blocks.map((b: any, i: number) => ({
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

    // Try to save to Supabase
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      try {
        // Save to records table
        const { error: recordError } = await supabaseAdmin
          .from('records')
          .insert({
            id: record.id,
            user_id: record.user_id,
            content: record.content,
            content_type: record.content_type,
            summary: record.summary,
            categories: record.categories,
            is_favorite: false,
          });

        if (recordError) {
          console.error('Failed to save record to Supabase:', recordError);
        } else {
          // Save blocks to content_blocks table (NOT blocks!)
          for (const block of record.blocks) {
            const { error: blockError } = await supabaseAdmin
              .from('content_blocks')
              .insert({
                id: block.id,
                user_id: block.user_id,
                entry_id: block.entry_id,
                category: block.category,
                content: block.content,
                keywords: block.keywords,
                favorite_keywords: [],
                is_manual: false,
                is_favorite: false,
              });

            if (blockError) {
              console.error('Failed to save block to Supabase:', blockError);
            }
          }
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
      }
    }

    // Always also store in memory for local access
    inMemoryRecords.unshift(record);
    record.blocks.forEach((block: any) => inMemoryBlocks.unshift(block));

    return NextResponse.json(record);
  } catch (error) {
    console.error('Error saving record:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const category = searchParams.get('category');
    const searchQuery = searchParams.get('q');
    const blocksOnly = searchParams.get('blocks_only') === 'true';
    const timeFilter = searchParams.get('time');

    const user = await getUser(request);
    const isLoggedIn = !!user;

    // Try Supabase first if logged in
    if (isLoggedIn) {
      const supabaseAdmin = getSupabaseAdmin();
      if (supabaseAdmin) {
        try {
          let query = supabaseAdmin
            .from('content_blocks')
            .select('*, records(content)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(limit);

          if (category) {
            query = query.eq('category', category);
          }

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
            query = query.gte('created_at', startDate.toISOString());
          }

          if (searchQuery) {
            query = query.or(`content.ilike.%${searchQuery}%,keywords.ilike.%${searchQuery}%`);
          }

          const { data: contentBlocks, error } = await query;

          if (!error && contentBlocks) {
            return NextResponse.json(contentBlocks);
          }
        } catch (error) {
          console.error('Supabase query error:', error);
        }
      }
    }

    // Fallback to in-memory storage
    let filteredBlocks = [...inMemoryBlocks];

    // Filter by category
    if (category) {
      filteredBlocks = filteredBlocks.filter(b => b.category === category);
    }

    // Filter by search query
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

    // Add original content
    const blocksWithOriginal = filteredBlocks.slice(0, limit).map(block => {
      const entry = inMemoryRecords.find(r => r.id === block.entry_id);
      return {
        ...block,
        original_content: entry?.content || '',
      };
    });

    return NextResponse.json(blocksWithOriginal);
  } catch (error) {
    console.error('Error fetching records:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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