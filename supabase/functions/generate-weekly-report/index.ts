// supabase/functions/generate-weekly-report/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateReportRequest {
  user_id: string;
  week_start: string;
  week_end: string;
  period_type: 'weekly' | 'monthly';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, week_start, week_end, period_type }: GenerateReportRequest = await req.json();

    // Fetch records for the period
    const startDate = new Date(week_start);
    const endDate = new Date(week_end);
    endDate.setHours(23, 59, 59, 999);

    const { data: records, error } = await supabase
      .from('records')
      .select('*')
      .eq('user_id', user_id)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ error: 'No records found for this period' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate category statistics
    const categoryStats: Record<string, number> = {};
    const allTodos: string[] = [];
    const allContent = records.map((r) => r.content).join('\n---\n');

    records.forEach((record) => {
      record.categories?.forEach((cat: string) => {
        categoryStats[cat] = (categoryStats[cat] || 0) + 1;
      });
      if (record.todos) {
        allTodos.push(...record.todos);
      }
    });

    // Call DeepSeek V3 API for report generation
    const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `你是一个个人成长复盘报告生成助手。根据用户提供的复盘记录，生成周报或月报内容。

要求：
1. 列出本周/本月最大的3个进步点
2. 列出2个待改进的点
3. 汇总所有待办事项，生成一个简洁的TODO清单
4. 分析各分类的占比情况

输出格式（JSON）：
{
  "top_progress": ["进步点1", "进步点2", "进步点3"],
  "improvements": ["待改进点1", "待改进点2"],
  "todo_summary": ["TODO1", "TODO2", "TODO3"]
}

注意：只需要输出JSON，不要有其他文字。`,
          },
          {
            role: 'user',
            content: `请根据以下复盘记录生成${period_type === 'weekly' ? '周' : '月'}报：\n\n${allContent}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    let reportContent = {
      top_progress: [],
      improvements: [],
      todo_summary: allTodos.slice(0, 10),
    };

    if (deepseekResponse.ok) {
      const deepseekData = await deepseekResponse.json();
      const aiContent = deepseekData.choices?.[0]?.message?.content || '';

      try {
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          reportContent = {
            top_progress: Array.isArray(parsed.top_progress) ? parsed.top_progress : [],
            improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
            todo_summary: Array.isArray(parsed.todo_summary) ? parsed.todo_summary : allTodos.slice(0, 10),
          };
        }
      } catch {
        console.log('Failed to parse AI response, using basic report');
      }
    }

    const totalRecords = records.length;
    const categoryDistribution: Record<string, number> = {};
    Object.entries(categoryStats).forEach(([cat, count]) => {
      categoryDistribution[cat] = Math.round((count / totalRecords) * 100);
    });

    const report = {
      period: `${week_start} 至 ${week_end}`,
      total_records: totalRecords,
      category_distribution: categoryDistribution,
      category_stats: categoryStats,
      ...reportContent,
      generated_at: new Date().toISOString(),
    };

    // Store the report
    if (period_type === 'weekly') {
      const { error: insertError } = await supabase
        .from('weekly_reports')
        .upsert({
          user_id,
          week_start,
          week_end,
          category_stats: categoryStats,
          top_progress: reportContent.top_progress,
          improvements: reportContent.improvements,
          todo_summary: reportContent.todo_summary,
          content: report,
        }, {
          onConflict: 'user_id,week_start',
        });

      if (insertError) throw insertError;
    } else {
      const monthStart = week_start.slice(0, 7) + '-01';
      const { error: insertError } = await supabase
        .from('monthly_reports')
        .upsert({
          user_id,
          month: monthStart,
          category_stats: categoryStats,
          top_progress: reportContent.top_progress,
          improvements: reportContent.improvements,
          todo_summary: reportContent.todo_summary,
          content: report,
        }, {
          onConflict: 'user_id,month',
        });

      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});