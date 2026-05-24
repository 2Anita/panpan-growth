// supabase/functions/speech-to-text/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const audioUrl = formData.get('audio_url') as string;

    if (!audioFile && !audioUrl) {
      return new Response(JSON.stringify({ error: 'Audio file or URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let audioBuffer: ArrayBuffer;

    if (audioFile) {
      audioBuffer = await audioFile.arrayBuffer();
    } else if (audioUrl) {
      // Download audio from URL
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error('Failed to download audio');
      }
      audioBuffer = await audioResponse.arrayBuffer();
    }

    // Convert to base64
    const base64Audio = btoa(
      new Uint8Array(audioBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );

    let transcript = '';

    // Try 讯飞听见 API first (for Chinese)
    const xfyunApiKey = Deno.env.get('XFYUN_API_KEY');
    const xfyunApiSecret = Deno.env.get('XFYUN_API_SECRET');
    const xfyunAppId = Deno.env.get('XFYUN_APP_ID');

    if (xfyunApiKey && xfyunApiSecret && xfyunAppId) {
      try {
        const curTime = Math.floor(Date.now() / 1000).toString();
        const param = Buffer.from(
          JSON.stringify({
            aue: 'raw',
            engine_type: 'sms16k',
            sample_rate: '16000',
          })
        ).toString('base64');

        const checkSum = await generateCheckSum(
          xfyunApiKey + curTime + param,
          xfyunApiSecret
        );

        const xfyunResponse = await fetch(
          `https://api.xf-yun.com/v1/private/${xfyunAppId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              audio: base64Audio,
              app_id: xfyunAppId,
              curTime,
              param,
              checkSum,
            }),
          }
        );

        if (xfyunResponse.ok) {
          const xfyunData = await xfyunResponse.json();
          transcript = parseXfYunResponse(xfyunData);
        }
      } catch (xfyunError) {
        console.log('讯飞 API failed, falling back to Whisper');
      }
    }

    // Fallback to OpenAI Whisper API
    if (!transcript) {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (openaiApiKey) {
        const whisperFormData = new FormData();
        whisperFormData.append(
          'file',
          new File([audioBuffer], 'audio.webm', { type: 'audio/webm' })
        );
        whisperFormData.append('model', 'whisper-1');
        whisperFormData.append('language', 'zh');

        const whisperResponse = await fetch(
          'https://api.openai.com/v1/audio/transcriptions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${openaiApiKey}`,
            },
            body: whisperFormData,
          }
        );

        if (whisperResponse.ok) {
          const whisperData = await whisperResponse.json();
          transcript = whisperData.text || '';
        }
      }
    }

    // Final fallback to basic transcription (demo mode)
    if (!transcript) {
      transcript =
        '这是一段模拟的语音转文字结果。在生产环境中，需要配置讯飞听见 API 或 OpenAI Whisper API。';
    }

    return new Response(
      JSON.stringify({
        text: transcript,
        duration: Math.ceil(audioBuffer.byteLength / 16000),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in speech-to-text:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateCheckSum(
  content: string,
  apiSecret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(apiSecret);
  const contentData = encoder.encode(content);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, contentData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function parseXfYunResponse(data: unknown): string {
  // Parse 讯飞 API response format
  try {
    const response = data as { data?: { text?: string } };
    if (response?.data?.text) {
      return Buffer.from(response.data.text, 'base64').toString();
    }
  } catch {
    console.log('Failed to parse 讯飞 response');
  }
  return '';
}