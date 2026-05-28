import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Valid categories - MUST match exactly
const VALID_CATEGORIES = ['创意灵感', '问题解决', '情绪变化', '技术学习', '行动TODO', '其他'];

// Category keywords for fallback matching
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '创意灵感': ['创意', '想法', '灵感', '脑洞', '点子', '创新', '新颖', '有趣', '启发'],
  '问题解决': ['问题', '解决', '处理', '办法', '困难', '优化', '方案', '调试', '修复', '突破'],
  '情绪变化': ['心情', '感受', '情绪', '开心', '难过', '高兴', '沮丧', '焦虑', '兴奋', '失落', '平静'],
  '技术学习': ['学习', '代码', '编程', '技术', '知识', '教程', '函数', '算法', '语法', '框架', '源码'],
  '行动TODO': ['要做', '计划', '待办', '明天', '准备', '任务', '完成', '执行', '开始', '继续', '跟进'],
  '其他': [],
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
  let bestMatch = '其他';
  let maxScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === '其他') continue;
    let score = 0;
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        score++;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = category;
    }
  }
  return maxScore > 0 ? bestMatch : '其他';
}

// Get user category preferences (for learning)
async function getUserCategoryPreferences(userId: string): Promise<Record<string, string[]>> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return {};

  try {
    const { data: adjustments } = await supabaseAdmin
      .from('category_adjustments')
      .select('original_category, new_category')
      .eq('user_id', userId)
      .limit(100);

    const preferences: Record<string, string[]> = {};
    adjustments?.forEach(adj => {
      if (!preferences[adj.original_category]) {
        preferences[adj.original_category] = [];
      }
      if (!preferences[adj.original_category].includes(adj.new_category)) {
        preferences[adj.original_category].push(adj.new_category);
      }
    });
    return preferences;
  } catch (error) {
    console.error('Failed to get user preferences:', error);
    return {};
  }
}

// Split text into sentences
function splitIntoSentences(text: string): string[] {
  const sentences = text
    .replace(/[。！？.!?]+/g, '|')
    .replace(/[\n\r]+/g, '|')
    .split('|')
    .map(s => s.trim())
    .filter(s => s.length > 5 && s.length < 500);
  return sentences;
}

// Call DeepSeek AI to split and classify
async function splitAndClassifyContent(content: string, preferredCategory?: string, userPreferences?: Record<string, string[]>): Promise<any[] | null> {
  const aiApiKey = process.env.DEEPSEEK_API_KEY;

  if (!aiApiKey || aiApiKey.includes('your-') || !aiApiKey.startsWith('sk-')) {
    console.log('DeepSeek API key not configured, using fallback split');
    const sentences = splitIntoSentences(content);
    return sentences.map(sentence => ({
      content: sentence,
      category: preferredCategory || matchCategoryByKeyword(sentence),
      keywords: [],
      summary: sentence.slice(0, 50),
    }));
  }

  try {
    const userPreferenceHint = Object.keys(userPreferences || {}).length > 0
      ? `\n【用户偏好】AI已学习到以下分类习惯：${JSON.stringify(userPreferences)}`
      : '';

    const systemPrompt = `你是一个精准的个人成长复盘助手。用户会输入一段复盘文字，你的任务是：

1. 把这段文字拆分成独立的短句（每句完整表达一个意思）
2. 给每个短句打上分类标签
3. 提取每个短句的3个核心关键词
4. 生成1句话总结

【分类标签】：
- 创意灵感：想法、创意、灵感、脑洞等
- 问题解决：问题、解决、办法、方案等
- 情绪变化：心情、感受、情绪、开心、难过等
- 技术学习：学习、代码、编程、技术等
- 行动TODO：要做、计划、待办、任务等
- 其他：以上都不是

${preferredCategory ? `【重要】用户选择了"${preferredCategory}"分类，优先使用该分类。` : ''}
${userPreferenceHint}

【返回格式】（必须是JSON数组，不要返回任何其他内容）：
[
  {
    "content": "独立的短句内容（保留用户原话，不要总结）",
    "category": "分类名称",
    "keywords": ["关键词1", "关键词2", "关键词3"],
    "summary": "一句话总结"
  }
]

【注意】：
- content必须保留用户原话
- 每句独立一行，语义完整
- 如果原句太短（少于5个字），跳过
- summary不要超过20个字`;

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
        temperature: 0.2,
        max_tokens: 3000,
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

    let parsed = null;
    try {
      const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
    }

    if (Array.isArray(parsed) && parsed.length > 0) {
      const validBlocks = parsed.filter((block: any) =>
        block.content && block.content.trim().length > 0
      ).map((block: any) => {
        let category = block.category || '其他';
        if (!VALID_CATEGORIES.includes(category)) {
          category = matchCategoryByKeyword(block.content);
        }
        return {
          content: block.content.trim(),
          category,
          keywords: Array.isArray(block.keywords) ? block.keywords.slice(0, 3) : [],
          summary: (block.summary || block.content || '').slice(0, 50),
        };
      });

      if (validBlocks.length > 0) {
        return validBlocks;
      }
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

    // Get user preferences for learning
    const userPreferences = user ? await getUserCategoryPreferences(user.id) : undefined;

    // Split and classify using DeepSeek AI
    let blocksData = await splitAndClassifyContent(content, preferredCategory, userPreferences);

    if (!blocksData || blocksData.length === 0) {
      const sentences = splitIntoSentences(content);
      if (sentences.length === 0) {
        return NextResponse.json({ error: 'Could not parse content' }, { status: 400 });
      }
      blocksData = sentences.map(sentence => ({
        content: sentence,
        category: preferredCategory || matchCategoryByKeyword(sentence),
        keywords: [],
        summary: sentence.slice(0, 50),
      }));
    }

    console.log('Split result:', blocksData.length, 'blocks');

    // Create record (entry)
    const recordId = crypto.randomUUID();
    const summary = blocksData.map(b => b.summary || b.content).join('；').slice(0, 200);
    const categories = [...new Set(blocksData.map(b => b.category))];

    const record = {
      id: recordId,
      user_id: userId,
      content,
      content_type,
      summary,
      keywords: blocksData.flatMap(b => b.keywords || []).slice(0, 10),
      categories,
      created_at: now,
      updated_at: now,
      is_favorite: false,
    };

    // Create blocks for each sentence
    const blocks = blocksData.map((data: any) => ({
      id: crypto.randomUUID(),
      user_id: userId,
      entry_id: recordId,
      category: data.category,
      content: data.content,
      summary: data.summary || data.content.slice(0, 50),
      keywords: data.keywords || [],
      favorite_keywords: [],
      is_manual: false,
      is_favorite: false,
      created_at: now,
      updated_at: now,
    }));

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

        // Save blocks in batch
        if (blocks.length > 0) {
          const { error: blockError } = await supabaseAdmin
            .from('content_blocks')
            .insert(blocks.map(block => ({
              id: block.id,
              user_id: block.user_id,
              entry_id: block.entry_id,
              category: block.category,
              content: block.content,
              summary: block.summary,
              keywords: block.keywords,
              favorite_keywords: [],
              is_manual: false,
              is_favorite: false,
            })));

          if (blockError) {
            console.error('Block batch insert error:', blockError);
          } else {
            console.log('Saved', blocks.length, 'blocks to Supabase');
          }
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
      }
    }

    // Store in memory
    inMemoryRecords.unshift(record);
    blocks.forEach(block => inMemoryBlocks.unshift(block));

    return NextResponse.json({
      ...record,
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
    const limit = parseInt(searchParams.get('limit') || '50');
    const category = searchParams.get('category');
    const searchQuery = searchParams.get('q');
    const timeFilter = searchParams.get('time');
    const entryId = searchParams.get('entry_id');

    const user = await getUser(request);
    const isLoggedIn = !!user;

    // Try Supabase first
    if (isLoggedIn) {
      const supabaseAdmin = getSupabaseAdmin();
      if (supabaseAdmin) {
        try {
          let query = supabaseAdmin
            .from('content_blocks')
            .select('*, records!inner(id, content, summary, keywords, categories)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(limit);

          if (entryId) {
            query = query.eq('entry_id', entryId);
          }

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
            const blocksWithOriginal = blocks.map((b: any) => ({
              id: b.id,
              entry_id: b.entry_id,
              category: b.category,
              content: b.content,
              summary: b.summary,
              keywords: b.keywords || [],
              favorite_keywords: b.favorite_keywords || [],
              is_favorite: b.is_favorite,
              created_at: b.created_at,
              original_content: b.records?.content || '',
              record_summary: b.records?.summary || '',
              record_keywords: b.records?.keywords || [],
              record_categories: b.records?.categories || [],
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

    if (entryId) {
      filteredBlocks = filteredBlocks.filter(b => b.entry_id === entryId);
    }

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
        record_summary: entry?.summary || '',
        record_keywords: entry?.keywords || [],
        record_categories: entry?.categories || [],
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
    const { block_id, keyword, is_favorite, category } = await request.json();

    if (!block_id) {
      return NextResponse.json({ error: 'block_id is required' }, { status: 400 });
    }

    const user = await getUser(request);
    const supabaseAdmin = getSupabaseAdmin();

    if (supabaseAdmin && user) {
      try {
        // Handle category adjustment
        if (category) {
          // Get original block to find its current category
          const { data: block } = await supabaseAdmin
            .from('content_blocks')
            .select('category, user_id')
            .eq('id', block_id)
            .single();

          if (block) {
            // Update block category
            await supabaseAdmin
              .from('content_blocks')
              .update({ category, updated_at: new Date().toISOString() })
              .eq('id', block_id);

            // Record adjustment for learning
            if (block.category !== category) {
              await supabaseAdmin
                .from('category_adjustments')
                .insert({
                  user_id: user.id,
                  block_id,
                  original_category: block.category,
                  new_category: category,
                });
            }

            return NextResponse.json({ id: block_id, category });
          }
        }

        // Handle keyword favorite toggle
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
        }

        // Handle block favorite toggle
        await supabaseAdmin
          .from('content_blocks')
          .update({ is_favorite })
          .eq('id', block_id);

        return NextResponse.json({ id: block_id, is_favorite });
      } catch (error) {
        console.error('Supabase PATCH error:', error);
      }
    }

    // Fallback to in-memory
    const blockIndex = inMemoryBlocks.findIndex(b => b.id === block_id);
    if (blockIndex === -1) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }

    if (category) {
      inMemoryBlocks[blockIndex].category = category;
      return NextResponse.json(inMemoryBlocks[blockIndex]);
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