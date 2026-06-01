import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const VALID_CATEGORIES = ['创意灵感', '问题解决', '情绪变化', '技术学习', '行动TODO', '其他'];

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

// User's existing schema: entries, categories, tags
// Our schema: records, content_blocks

async function saveToUserSchema(supabaseAdmin: ReturnType<typeof createSupabaseClient>, record: any, blocks: any[], userId: string) {
  // Try user's schema first (entries, categories, tags)
  try {
    // Save to entries table
    const { error: entryError } = await supabaseAdmin
      .from('entries')
      .insert({
        id: record.id,
        user_id: userId,
        content: record.content,
        summary: record.summary,
        tags: record.categories || [],
        category: blocks[0]?.category || '其他',
        keywords: record.keywords || [],
        is_favorite: false,
      });

    if (!entryError) {
      console.log('Saved to entries table');
      return true;
    }
    console.log('entries table error:', entryError);
  } catch (e) {
    console.log('entries table not available');
  }
  return false;
}

async function saveToOurSchema(supabaseAdmin: ReturnType<typeof createSupabaseClient>, record: any, blocks: any[], userId: string) {
  try {
    // Save record
    const { error: recordError } = await supabaseAdmin
      .from('records')
      .insert({
        id: record.id,
        user_id: userId,
        content: record.content,
        content_type: record.content_type || 'text',
        summary: record.summary,
        keywords: record.keywords || [],
        categories: record.categories || [],
        is_favorite: false,
      });

    if (recordError) {
      console.log('records table error:', recordError);
    } else {
      // Save blocks
      for (const block of blocks) {
        await supabaseAdmin
          .from('content_blocks')
          .insert({
            id: block.id,
            user_id: userId,
            entry_id: block.entry_id,
            category: block.category,
            content: block.content,
            summary: block.summary,
            keywords: block.keywords || [],
            favorite_keywords: [],
            is_manual: false,
            is_favorite: false,
          });
      }
      console.log('Saved to records/content_blocks tables');
      return true;
    }
  } catch (e) {
    console.log('records table not available');
  }
  return false;
}

async function loadFromUserSchema(supabaseAdmin: ReturnType<typeof createSupabaseClient>, userId: string, limit: number) {
  try {
    const { data, error } = await supabaseAdmin
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!error && data && data.length > 0) {
      return data.map(entry => ({
        id: entry.id,
        entry_id: entry.id,
        user_id: entry.user_id,
        category: entry.category,
        content: entry.summary || entry.content?.slice(0, 50) || '',
        original_content: entry.content,
        summary: entry.summary,
        keywords: entry.keywords || [],
        favorite_keywords: [],
        is_favorite: entry.is_favorite || false,
        created_at: entry.created_at,
        record_summary: entry.summary,
        record_keywords: entry.keywords || [],
        record_categories: entry.tags || [entry.category],
      }));
    }
  } catch (e) {
    console.log('entries table query failed');
  }
  return null;
}

async function loadFromOurSchema(supabaseAdmin: ReturnType<typeof createSupabaseClient>, userId: string, limit: number) {
  try {
    const { data, error } = await supabaseAdmin
      .from('content_blocks')
      .select('*, records!inner(id, content, summary, keywords, categories)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!error && data && data.length > 0) {
      return data.map((b: any) => ({
        id: b.id,
        entry_id: b.entry_id,
        user_id: b.user_id,
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
    }
  } catch (e) {
    console.log('content_blocks table query failed');
  }
  return null;
}

// In-memory stores
const inMemoryRecords: any[] = [];
const inMemoryBlocks: any[] = [];

function matchCategoryByKeyword(text: string): string {
  const lowerText = text.toLowerCase();
  const keywords: Record<string, string[]> = {
    '创意灵感': ['创意', '想法', '灵感', '脑洞', '点子', '创新', '新颖', '启发'],
    '问题解决': ['问题', '解决', '处理', '办法', '困难', '优化', '方案', '调试', '突破'],
    '情绪变化': ['心情', '感受', '情绪', '开心', '难过', '高兴', '沮丧', '焦虑'],
    '技术学习': ['学习', '代码', '编程', '技术', '知识', '教程', '函数', '算法'],
    '行动TODO': ['要做', '计划', '待办', '明天', '准备', '任务', '完成', '执行'],
  };
  let bestMatch = '其他';
  let maxScore = 0;
  for (const [category, kws] of Object.entries(keywords)) {
    let score = 0;
    for (const kw of kws) {
      if (lowerText.includes(kw)) score++;
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = category;
    }
  }
  return maxScore > 0 ? bestMatch : '其他';
}

function splitIntoSentences(text: string): string[] {
  return text
    .replace(/[。！？.!?]+/g, '|')
    .replace(/[\n\r]+/g, '|')
    .split('|')
    .map(s => s.trim())
    .filter(s => s.length > 5 && s.length < 500);
}

export async function POST(request: NextRequest) {
  try {
    const { content, content_type = 'text', preferredCategory } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const user = await getUser(request);
    const userId = user?.id || 'anonymous';
    const now = new Date().toISOString();

    // Simple split and classify
    const sentences = splitIntoSentences(content);
    let blocksData = sentences.map(sentence => ({
      content: sentence,
      category: preferredCategory || matchCategoryByKeyword(sentence),
      keywords: [],
      summary: sentence.slice(0, 50),
    }));

    if (blocksData.length === 0) {
      blocksData = [{
        content: content.slice(0, 200),
        category: preferredCategory || '其他',
        keywords: [],
        summary: content.slice(0, 50),
      }];
    }

    // Create record
    const recordId = crypto.randomUUID();
    const record = {
      id: recordId,
      user_id: userId,
      content,
      content_type,
      summary: blocksData.map(b => b.summary).join('；').slice(0, 200),
      keywords: blocksData.flatMap(b => b.keywords || []).slice(0, 10),
      categories: [...new Set(blocksData.map(b => b.category))],
      created_at: now,
      updated_at: now,
      is_favorite: false,
    };

    // Create blocks
    const blocks = blocksData.map((data: any) => ({
      id: crypto.randomUUID(),
      user_id: userId,
      entry_id: recordId,
      category: data.category,
      content: data.content,
      summary: data.summary,
      keywords: data.keywords || [],
      favorite_keywords: [],
      is_manual: false,
      is_favorite: false,
      created_at: now,
      updated_at: now,
    }));

    // Save to database
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      // Try user's schema first, then our schema
      const saved = await saveToUserSchema(supabaseAdmin, record, blocks, userId) ||
                     await saveToOurSchema(supabaseAdmin, record, blocks, userId);
      if (saved) {
        console.log('Data saved to database');
      }
    }

    // Always save to memory
    inMemoryRecords.unshift(record);
    blocks.forEach(block => inMemoryBlocks.unshift(block));

    return NextResponse.json({ ...record, blocks });
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

    const user = await getUser(request);
    const isLoggedIn = !!user;

    if (isLoggedIn) {
      const supabaseAdmin = getSupabaseAdmin();
      if (supabaseAdmin) {
        // Try our schema first, then user's schema
        let blocks = await loadFromOurSchema(supabaseAdmin, user.id, limit);
        if (!blocks) {
          blocks = await loadFromUserSchema(supabaseAdmin, user.id, limit);
        }
        if (blocks && blocks.length > 0) {
          if (category) {
            blocks = blocks.filter(b => b.category === category);
          }
          return NextResponse.json(blocks);
        }
      }
    }

    // Fallback to in-memory
    let filteredBlocks = [...inMemoryBlocks];
    if (category) {
      filteredBlocks = filteredBlocks.filter(b => b.category === category);
    }
    filteredBlocks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
    const { block_id, is_favorite } = await request.json();

    if (!block_id) {
      return NextResponse.json({ error: 'block_id is required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Try both table schemas
    if (supabaseAdmin) {
      // Try content_blocks first
      try {
        await supabaseAdmin
          .from('content_blocks')
          .update({ is_favorite, updated_at: new Date().toISOString() })
          .eq('id', block_id);
        return NextResponse.json({ id: block_id, is_favorite });
      } catch (e) {}

      // Try entries
      try {
        await supabaseAdmin
          .from('entries')
          .update({ is_favorite })
          .eq('id', block_id);
        return NextResponse.json({ id: block_id, is_favorite });
      } catch (e) {}
    }

    // Fallback to in-memory
    const blockIndex = inMemoryBlocks.findIndex(b => b.id === block_id);
    if (blockIndex === -1) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }

    inMemoryBlocks[blockIndex].is_favorite = is_favorite;
    return NextResponse.json({ id: block_id, is_favorite });
  } catch (error) {
    console.error('Error updating block:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}