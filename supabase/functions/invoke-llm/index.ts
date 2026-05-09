import OpenAI from 'npm:openai@5.12.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt, response_json_schema } = await req.json();
    const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

    const wantsJson = Boolean(response_json_schema);
    const completion = await openai.chat.completions.create({
      model: Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini',
      messages: [
        {
          role: 'user',
          content: wantsJson
            ? `${prompt}\n\nReturn only valid JSON matching this JSON schema:\n${JSON.stringify(response_json_schema)}`
            : prompt,
        },
      ],
      response_format: wantsJson ? { type: 'json_object' } : undefined,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content || '';
    const result = wantsJson ? JSON.parse(content) : content;

    return Response.json({ result }, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      { error: error.message || 'AI request failed' },
      { status: 500, headers: corsHeaders },
    );
  }
});
