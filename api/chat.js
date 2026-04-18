export const config = {
  runtime: 'edge',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
      status: 405, 
      headers: CORS_HEADERS 
    });
  }

  try {
    const body = await req.json();
    const { prompt, userProfile, currentProgram, recentCheckins } = body;

    // Log para debug
    console.log('[CHAT] Received prompt:', prompt?.substring(0, 100));
    console.log('[CHAT] User profile:', JSON.stringify(userProfile));
    console.log('[CHAT] Has program:', !!currentProgram);
    console.log('[CHAT] Checkins count:', recentCheckins?.length || 0);

    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      console.error('[CHAT] GROQ_API_KEY não configurada');
      return new Response(JSON.stringify({ 
        error: 'GROQ_API_KEY não configurada no Vercel. Adicione nas variáveis de ambiente.',
        text: 'Configuração necessária: adicione GROQ_API_KEY nas variáveis de ambiente do Vercel.'
      }), { 
        status: 500, 
        headers: CORS_HEADERS 
      });
    }

    // Análise de progresso baseada em check-ins*
