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

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function classifyContent(text: string): string {
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

async function generateReport(startDate: Date, endDate: Date, userId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  let blocks: any[] = [];

  if (supabaseAdmin) {
    try {
      const { data } = await supabaseAdmin
        .from('content_blocks')
        .select('*, records!inner(content, summary)')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      blocks = data || [];
    } catch (error) {
      console.error('Failed to fetch blocks for report:', error);
    }
  }

  if (blocks.length === 0) {
    return {
      period: `${startDate.toLocaleDateString('zh-CN')} - ${endDate.toLocaleDateString('zh-CN')}`,
      total_records: 0,
      category_distribution: {},
      top_progress: [],
      improvements: [],
      todo_summary: [],
      generated_at: new Date().toISOString(),
    };
  }

  // Category distribution
  const categoryDistribution: Record<string, number> = {};
  const categoryColors: Record<string, string> = {
    '创意灵感': '#8B5CF6',
    '问题解决': '#3B82F6',
    '情绪变化': '#EC4899',
    '技术学习': '#10B981',
    '行动TODO': '#F97316',
    '其他': '#6B7280',
  };

  for (const block of blocks) {
    const cat = block.category || '其他';
    categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
  }

  // Extract progress and improvements based on keywords
  const progressKeywords = ['突破', '成功', '进步', '学会', '完成', '解决', '开心', '高兴'];
  const improvementKeywords = ['问题', '困难', '失败', '需要', '应该', '待改进', '不足'];

  const allContent = blocks.map(b => b.content + ' ' + (b.records?.content || '')).join(' ');
  const progressSet = new Set<string>();
  const improvementSet = new Set<string>();

  for (const block of blocks) {
    const content = block.content;
    const lowerContent = content.toLowerCase();

    // Progress: positive content with progress keywords
    if (progressKeywords.some(kw => lowerContent.includes(kw))) {
      progressSet.add(content.slice(0, 50));
    }

    // Improvements: content mentioning issues or needs
    if (improvementKeywords.some(kw => lowerContent.includes(kw))) {
      improvementSet.add(content.slice(0, 50));
    }
  }

  const topProgress = Array.from(progressSet).slice(0, 3);
  const improvements = Array.from(improvementSet).slice(0, 2);

  // Extract TODOs
  const todoSet = new Set<string>();
  for (const block of blocks) {
    if (block.category === '行动TODO') {
      todoSet.add(block.content.slice(0, 50));
    }
  }
  const todoSummary = Array.from(todoSet);

  return {
    period: `${startDate.toLocaleDateString('zh-CN')} - ${endDate.toLocaleDateString('zh-CN')}`,
    total_records: blocks.length,
    category_distribution: categoryDistribution,
    top_progress: topProgress,
    improvements: improvements,
    todo_summary: todoSummary,
    generated_at: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'weekly';

    const now = new Date();
    let startDate: Date;
    let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    if (type === 'weekly') {
      startDate = getWeekStart(now);
    } else {
      startDate = getMonthStart(now);
    }

    const report = await generateReport(startDate, endDate, user.id);
    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}