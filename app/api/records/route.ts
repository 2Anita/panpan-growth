import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Valid categories - MUST match exactly
const VALID_CATEGORIES = ['创意灵感', '问题解决', '情绪变化', '技术学习', '内心感受', '行动TODO', '其他'];

// Category keywords for fallback matching
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '创意灵感': ['创意', '想法', '灵感', '脑洞', '点子', '创新', '新颖', '有趣'],
  '问题解决': ['问题', '解决', '处理', '办法', '困难', '优化', '方案', '调试'],
  '情绪变化': ['心情', '感受', '情绪', '开心', '难过', '高兴', '沮丧', '焦虑'],
  '技术学习': ['学习', '代码', '编程', '技术', '知识', '教程', '函数', '算法'],
  '行动TODO': ['要做', '计划', '待办', '明天', '准备', '任务', '完成', '执行'],
  '内心感受': ['内心', '体会', '感悟', '体会', '领悟', '感受'],
};

// Create Supabase client
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

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// Match category by keywords
function matchCategoryByKeyword(text: string): string {
  const lowerText = text.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return category;
      }
    }
  }
  return '其他';
}

// Call DeepSeek AI
async function callDeepSeekAI(content: string, preferredCategory?: string): Promise<any> {
  const aiApiKey = process.env.DEEPSEEK_API_KEY;

  if (!aiApiKey || aiApiKey.includes('your-') || !aiApiKey.startsWith('sk-')) {
    console.log('DeepSeek API key not configured or invalid');
    return null;
  }

  try {
    const systemPrompt = `你是一个精准的个人成长复盘助手。用户会输入一段文字，你的任务是：

1. 提取文字中的核心内容（1-3句话）
2. 提取3-5个关键词
3. 判断最合适的分类

分类列表（必须严格使用这些名称）：
- 创意灵感：想法、创意、灵感、脑洞
- 问题解决：问题、解决、办法、方案
- 情绪变化：心情、感受、情绪、开心、难过
- 技术学习：学习、代码、编程、技术、知识
- 行动TODO：要做、计划、待办、任务
- 其他：以上都不是

${preferredCategory ? `【重要】用户选择了"${preferredCategory}"分类，请优先使用该分类。` : ''}

必须返回以下JSON格式（不要返回任何其他内容）：
{
  "summary": "核心内容摘要（1-3句话）",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "category": "分类名称",
  "todos": ["待办事项（如有）"]
}`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiApiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content }
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content || '';

    console.log('DeepSeek raw response:', aiContent);

    // Parse JSON from response
    let parsed = null;
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
    }

    if (parsed && parsed.category && VALID_CATEGORIES.includes(parsed.category)) {
      return parsed;
    }

    // If category is invalid, try to fix it
    if (parsed && parsed.category) {
      const normalizedCategory = matchCategoryByKeyword(parsed.category);
      parsed.category = normalizedCategory;
      return parsed;
    }

    return null;
  } catch (error) {
    console.error('DeepSeek API call error:', error);
    return null;
  }
}

// In-memory stores
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

    // Try DeepSeek AI first
    const aiResult = await callDeepSeekAI(content, preferredCategory);

    let summary = '';
    let keywords: string[] = [];
    let category = '其他';

    if (aiResult) {
      summary = aiResult.summary || content.slice(0, 100);
      keywords = Array.isArray(aiResult.keywords) ? aiResult.keywords.slice(0, 5) : [];
      category = aiResult.category || '其他';

      // Validate category
      if (!VALID_CATEGORIES.includes(category)) {
        category = matchCategoryByKeyword(content);
      }
    } else {
      // Fallback: use keyword matching
      summary = content.slice(0, 100);
      keywords = [];
      category = preferredCategory || matchCategoryByKeyword(content);
    }

    console.log('AI classification result:', { category, summary, keywords });

    // Create record
    const recordId = crypto.randomUUID();
    const record = {
      id: recordId,
      user_id: userId,
      content,
      content_type,
      summary,
      keywords,
      categories: [category],
      todos: aiResult?.todos || [],
      created_at: now,
      updated_at: now,
      is_favorite: false,
    };

    // Create block
    const blockId = crypto.randomUUID();
    const block = {
      id: blockId,
      user_id: userId,
      entry_id: recordId,
      category,
      content: summary,
      keywords,
      favorite_keywords: [],
      is_manual: false,
      is_favorite: false,
      created_at: now,
      updated_at: now,
    };

    // Save to Supabase
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      try {
        // Save record
        const { error: recordError } = await supabaseAdmin
          .from('records')
          .insert({
            id: record.id,
            user_id: record.user_id,
            content: record.content,
            content_type: record.content_type,
            summary: record.summary,
            keywords: record.keywords,
            categories: record.categories,
            is_favorite: false,
          });

        if (recordError) {
          console.error('Record insert error:', recordError);
        }

        // Save block
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
          console.error('Block insert error:', blockError);
        }

        console.log('Saved to Supabase:', { recordId, blockId, category });
      } catch (dbError) {
        console.error('Database error:', dbError);
      }
    }

    // Store in memory
    inMemoryRecords.unshift(record);
    inMemoryBlocks.unshift(block);

    return NextResponse.json({
      ...record,
      blocks: [block],
    });
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
    const timeFilter = searchParams.get('time');

    const user = await getUser(request);
    const isLoggedIn = !!user;

    // Try Supabase first
    if (isLoggedIn) {
      const supabaseAdmin = getSupabaseAdmin();
      if (supabaseAdmin) {
        try {
          let query = supabaseAdmin
            .from('content_blocks')
            .select('*')
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

          const { data: blocks, error } = await query;

          if (!error && blocks && blocks.length > 0) {
            // Get original content from records
            const entryIds = [...new Set(blocks.map(b => b.entry_id))];
            const { data: records } = await supabaseAdmin
              .from('records')
              .select('id, content')
              .in('id', entryIds);

            const recordMap: Record<string, string> = {};
            records?.forEach(r => { recordMap[r.id] = r.content; });

            const blocksWithOriginal = blocks.map(b => ({
              ...b,
              original_content: recordMap[b.entry_id] || '',
            }));

            return NextResponse.json(blocksWithOriginal);
          }
        } catch (error) {
          console.error('Supabase query error:', error);
        }
      }
    }

    // Fallback to in-memory
    let filteredBlocks = [...inMemoryBlocks];

    if (category) {
      filteredBlocks = filteredBlocks.filter(b => b.category === category);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredBlocks = filteredBlocks.filter(b =>
        b.content.toLowerCase().includes(query) ||
        (b.keywords && b.keywords.some((k: string) => k.toLowerCase().includes(query)))
      );
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
      filteredBlocks = filteredBlocks.filter(b => new Date(b.created_at) >= startDate);
    }

    filteredBlocks.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

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

    const supabaseAdmin = getSupabaseAdmin();

    if (supabaseAdmin) {
      try {
        if (keyword) {
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
              .update({ favorite_keywords: favoriteKeywords })
              .eq('id', block_id);

            return NextResponse.json({ id: block_id, favorite_keywords: favoriteKeywords });
          }
        } else {
          await supabaseAdmin
            .from('content_blocks')
            .update({ is_favorite })
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

    if (keyword) {
      let favoriteKeywords = inMemoryBlocks[blockIndex].favorite_keywords || [];
      if (is_favorite === true && !favoriteKeywords.includes(keyword)) {
        favoriteKeywords.push(keyword);
      } else if (is_favorite === false) {
        favoriteKeywords = favoriteKeywords.filter((k: string) => k !== keyword);
      }
      inMemoryBlocks[blockIndex].favorite_keywords = favoriteKeywords;
      return NextResponse.json(inMemoryBlocks[blockIndex]);
    }

    inMemoryBlocks[blockIndex].is_favorite = is_favorite;
    return NextResponse.json(inMemoryBlocks[blockIndex]);
  } catch (error) {
    console.error('Error updating block:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}