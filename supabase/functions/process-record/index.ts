// supabase/functions/process-record/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessRecordRequest {
  content: string;
  content_type: 'text' | 'voice' | 'image';
  user_id: string;
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

    const { content, content_type, user_id }: ProcessRecordRequest = await req.json();

    if (!content) {
      return new Response(JSON.stringify({ error: 'Content is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call DeepSeek V3 API for processing
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
            content: `你是一个个人成长复盘助手。用户会输入一段文字（可能是语音转文字、手写OCR或直接输入），你的任务是：
1. 生成一句精炼的总结（不超过50字）
2. 提取3个核心关键词
3. 自动分类（可多分类）：创意灵感、问题解决、情绪变化、技术学习、行动TODO、其他
4. 提取待办事项（如果有）

输出格式（JSON）：
{
  "summary": "一句话总结",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "categories": ["分类1", "分类2"],
  "todos": ["待办1", "待办2"]
}

注意：只需要输出JSON，不要有其他文字。`,
          },
          {
            role: 'user',
            content: content,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!deepseekResponse.ok) {
      throw new Error('DeepSeek API error');
    }

    const deepseekData = await deepseekResponse.json();
    const aiContent = deepseekData.choices?.[0]?.message?.content || '';

    // Parse JSON from AI response
    let result = {
      summary: content.slice(0, 50),
      keywords: [],
      categories: ['其他'],
      todos: [],
    };

    try {
      // Try to parse JSON from the response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        result = {
          summary: parsed.summary || result.summary,
          keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 3) : result.keywords,
          categories: Array.isArray(parsed.categories) ? parsed.categories : result.categories,
          todos: Array.isArray(parsed.todos) ? parsed.todos : result.todos,
        };
      }
    } catch {
      // If JSON parsing fails, use basic fallback
      console.log('Failed to parse AI response, using fallback');
    }

    // Store the record in Supabase
    const { data, error } = await supabase
      .from('records')
      .insert({
        user_id,
        content,
        content_type: content_type || 'text',
        summary: result.summary,
        keywords: result.keywords,
        categories: result.categories,
        todos: result.todos,
        raw_ai_response: result,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing record:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});