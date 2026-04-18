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

    // Análise de progresso baseada em check-ins
    const progressAnalysis = analyzeProgress(recentCheckins, currentProgram);

    // Determinar tipo de resposta
    const responseType = determineResponseType(prompt, currentProgram, recentCheckins);
    console.log('[CHAT] Response type:', responseType);

    // Gerar resposta
    const aiResponse = await generateAIResponse(prompt, userProfile, currentProgram, recentCheckins, progressAnalysis, responseType);

    return new Response(JSON.stringify(aiResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });

  } catch (error) {
    console.error('[CHAT] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Erro interno do servidor',
      text: 'Desculpe, houve um erro. Tente novamente em alguns segundos.'
    }), { 
      status: 500, 
      headers: CORS_HEADERS 
    });
  }
}

// ================================================================
// ANÁLISE DE PROGRESSO
// ================================================================
function analyzeProgress(checkins, program) {
  if (!checkins || checkins.length === 0) {
    return { status: 'no_data', recommendation: 'Continue com o programa atual.' };
  }

  const recentCheckins = checkins.slice(0, 5);
  const avgFatigue = recentCheckins.reduce((sum, c) => sum + (c.fatigue || 5), 0) / recentCheckins.length;
  const avgRPE = recentCheckins.reduce((sum, c) => sum + (c.rpe || 5), 0) / recentCheckins.length;
  
  const highFatigue = recentCheckins.filter(c => c.fatigue >= 7).length;
  const lowRPE = recentCheckins.filter(c => c.rpe <= 5).length;
  
  let status = 'optimal';
  let recommendation = '';
  
  if (avgFatigue >= 7) {
    status = 'overreaching';
    recommendation = 'Fadiga elevada detectada. Considere reduzir volume em 20% ou adicionar dia de descanso.';
  } else if (avgRPE <= 5 && recentCheckins.length >= 3) {
    status = 'undertrained';
    recommendation = 'Esforço está baixo. Aumente cargas ou adicione séries para continuar progredindo.';
  } else if (highFatigue >= 3) {
    status = 'warning';
    recommendation = '3+ check-ins com fadiga alta. Recomendo semana de deload (50% do volume).';
  } else {
    recommendation = 'Progresso estável. Continue progredindo com sobrecarga progressiva.';
  }

  return {
    status,
    avgFatigue: avgFatigue.toFixed(1),
    avgRPE: avgRPE.toFixed(1),
    checkinsAnalyzed: recentCheckins.length,
    recommendation
  };
}

// ================================================================
// DETERMINAR TIPO DE RESPOSTA
// ================================================================
function determineResponseType(prompt, program, checkins) {
  const p = prompt.toLowerCase();
  
  // Palavras-chave para gerar programa
  const programKeywords = ['gerar programa', 'novo programa', 'criar treino', 'programa semanal', 'meu treino', 'montar treino'];
  
  // Palavras-chave para atualizar
  const updateKeywords = ['atualizar', 'ajustar', 'mudar', 'modificar', 'progressão', 'evoluí', 'aumentar peso', 'estagnar'];
  
  // Palavras-chave para análise
  const analysisKeywords = ['analisar', 'progresso', 'como estou', 'relatório', 'avaliação', 'check-in'];

  if (programKeywords.some(k => p.includes(k)) && !program) {
    return 'new_program';
  }
  
  if (updateKeywords.some(k => p.includes(k)) || (program && analysisKeywords.some(k => p.includes(k)))) {
    return 'update_program';
  }
  
  if (analysisKeywords.some(k => p.includes(k))) {
    return 'analysis';
  }
  
  // Verificar se precisa de atualização por fadiga
  if (checkins && checkins.length >= 3) {
    const recent = checkins.slice(0, 3);
    const highFatigue = recent.filter(c => c.fatigue >= 8).length;
    if (highFatigue >= 3) {
      return 'deload';
    }
  }
  
  return 'chat';
}

// ================================================================
// GERAR RESPOSTA DA IA
// ================================================================
async function generateAIResponse(prompt, profile, program, checkins, analysis, responseType) {
  const apiKey = process.env.GROQ_API_KEY;
  
  const systemInstruction = buildSystemPrompt(responseType, analysis);
  const contextBlock = buildContextBlock(prompt, profile, program, checkins, analysis);

  console.log('[CHAT] Calling Groq API...');
  
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: contextBlock }
      ],
      temperature: 0.4,
      max_tokens: 8000,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[CHAT] Groq API error:', errorText);
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.error) {
    console.error('[CHAT] Groq response error:', data.error);
    throw new Error(data.error.message || 'Erro na API Groq');
  }

  const rawContent = data.choices?.[0]?.message?.content;
  
  if (!rawContent) {
    console.error('[CHAT] No content in response');
    throw new Error('Resposta vazia da IA');
  }

  console.log('[CHAT] Raw response length:', rawContent.length);

  // Parse e validar JSON
  try {
    const parsed = JSON.parse(rawContent);
    
    // Validar estrutura mínima
    if (!parsed.text) {
      parsed.text = 'Resposta gerada com sucesso.';
    }
    
    // Se é programa, validar estrutura
    if (parsed.isProgram && parsed.program) {
      parsed.program = validateProgram(parsed.program, profile);
    }
    
    // Se é treino único, validar
    if (parsed.isWorkout && parsed.workout) {
      parsed.workout = validateWorkout(parsed.workout, profile);
    }
    
    return parsed;
    
  } catch (parseError) {
    console.error('[CHAT] JSON parse error:', parseError);
    // Retornar como texto simples se não for JSON válido
    return {
      text: rawContent.substring(0, 500),
      isProgram: false,
      isWorkout: false
    };
  }
}

// ================================================================
// VALIDAR E CORRIGIR PROGRAMA
// ================================================================
function validateProgram(program, profile) {
  // Garantir estrutura básica
  if (!program.days || !Array.isArray(program.days)) {
    program.days = [];
  }
  
  // Garantir pelo menos 5 dias
  while (program.days.length < 5) {
    const dayNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
    program.days.push({
      day: dayNames[program.days.length] || `Dia ${program.days.length + 1}`,
      focus: 'Treino Geral',
      exercises: []
    });
  }
  
  // Validar cada dia
  program.days = program.days.map(day => {
    if (!day.exercises || !Array.isArray(day.exercises)) {
      day.exercises = [];
    }
    
    // Garantir mínimo de 5 exercícios
    while (day.exercises.length < 5) {
      day.exercises.push({
        n: `Exercício ${day.exercises.length + 1}`,
        sets: 3,
        reps: '10-12',
        t: 60,
        bfr: profile?.has_injury || false,
        muscles: 'Músculo alvo',
        desc: ['Execute com controle.'],
        mistakes: ['Evitar impulso.'],
        c: ['Foco na contração.']
      });
    }
    
    return day;
  });
  
  // Garantir notas
  if (!program.notes) {
    program.notes = [
      'Aqueça 5-10 minutos antes de cada sessão.',
      'Mantenha hidratação adequada.',
      'Durma pelo menos 7 horas por noite.'
    ];
  }
  
  return program;
}

// ================================================================
// VALIDAR E CORRIGIR TREINO
// ================================================================
function validateWorkout(workout, profile) {
  if (!workout.exercises || !Array.isArray(workout.exercises)) {
    workout.exercises = [];
  }
  
  // Garantir pelo menos 3 exercícios
  while (workout.exercises.length < 3) {
    workout.exercises.push({
      n: `Exercício ${workout.exercises.length + 1}`,
      sets: 3,
      reps: '10-12',
      t: 60,
      bfr: profile?.has_injury || false,
      muscles: 'Músculo alvo',
      desc: ['Execute com controle.'],
      mistakes: ['Evitar impulso.'],
      c: ['Foco na contração.']
    });
  }
  
  if (!workout.name) {
    workout.name = 'Treino Personalizado';
  }
  
  return workout;
}

// ================================================================
// CONSTRUIR CONTEXT BLOCK
// ================================================================
function buildContextBlock(prompt, profile, program, checkins, analysis) {
  let context = '';

  // Perfil do usuário
  context += `\n═══════════════════════════════════════\n`;
  context += `PERFIL DO ALUNO:\n`;
  context += `═══════════════════════════════════════\n`;
  context += `- Nome: ${profile?.name || 'Não informado'}\n`;
  context += `- Idade: ${profile?.age || 'Não informado'} anos\n`;
  context += `- Peso: ${profile?.weight || 'Não informado'} kg\n`;
  context += `- Nível: ${profile?.level || 'Não informado'}\n`;
  context += `- Objetivo: ${profile?.objective === 'perda_gordura' ? 'Perda de gordura visceral' : 'Hipertrofia muscular'}\n`;
  context += `- Restrição articular (BFR): ${profile?.has_injury ? 'SIM - Ativar método BFR' : 'NÃO'}\n`;

  // Programa atual
  if (program) {
    context += `\n══════════════════════════════════════\n`;
    context += `PROGRAMA ATUAL:\n`;
    context += `══════════════════════════════════════\n`;
    context += `- Nome: ${program.name || 'Sem nome'}\n`;
    context += `- Dias: ${program.days?.length || 0} dias\n`;
    if (program.notes && program.notes.length > 0) {
      context += `- Notas: ${program.notes.slice(0, 2).join(' | ')}\n`;
    }
  } else {
    context += `\n══════════════════════════════════════\n`;
    context += `PROGRAMA ATUAL: Nenhum programa ativo\n`;
    context += `══════════════════════════════════════\n`;
  }

  // Check-ins e progresso
  if (checkins && checkins.length > 0) {
    context += `\n══════════════════════════════════════\n`;
    context += `HISTÓRICO DE CHECK-INS (${checkins.length} registros):\n`;
    context += `══════════════════════════════════════\n`;
    context += `- Média de fadiga: ${analysis.avgFatigue}/10\n`;
    context += `- Média de RPE: ${analysis.avgRPE}/10\n`;
    context += `- Status: ${analysis.status.toUpperCase()}\n`;
    context += `- Recomendação: ${analysis.recommendation}\n\n`;
    
    // Últimos 3 check-ins detalhados
    context += `Últimos check-ins:\n`;
    checkins.slice(0, 3).forEach((c, i) => {
      context += `${i + 1}. ${c.day_key || 'Treino'} - Fadiga: ${c.fatigue}/10, RPE: ${c.rpe}/10`;
      if (c.weight) context += `, Peso: ${c.weight}kg`;
      if (c.notes) context += ` - "${c.notes.substring(0, 50)}${c.notes.length > 50 ? '...' : ''}"`;
      context += '\n';
    });
  } else {
    context += `\n══════════════════════════════════════\n`;
    context += `HISTÓRICO DE CHECK-INS: Nenhum check-in registrado ainda\n`;
    context += `══════════════════════════════════════\n`;
  }

  // Mensagem do usuário
  context += `\n══════════════════════════════════════\n`;
  context += `MENSAGEM DO ALUNO:\n`;
  context += `══════════════════════════════════════\n`;
  context += `"${prompt}"\n`;

  // Tipo de resposta esperada
  context += `\n══════════════════════════════════════\n`;
  context += `TIPO DE RESPOSTA ESPERADA: ${responseType.toUpperCase()}\n`;
  context += `══════════════════════════════════════\n`;
  if (responseType === 'new_program') {
    context += `→ Gerar NOVO programa semanal completo (5 dias).\n`;
  } else if (responseType === 'update_program') {
    context += `→ ATUALIZAR o programa atual considerando o progresso.\n`;
    context += `→ Manter estrutura similar, ajustar cargas/volume conforme fadiga.\n`;
  } else if (responseType === 'deload') {
    context += `→ Gerar SEMANA DE DELOAD (reduzir volume em 50%).\n`;
  } else if (responseType === 'analysis') {
    context += `→ ANALISAR progresso e dar feedback motivacional.\n`;
  } else {
    context += `→ Conversa natural, responder à pergunta.\n`;
  }

  return context;
}

// ================================================================
// CONSTRUIR SYSTEM PROMPT
// ================================================================
function buildSystemPrompt(responseType, analysis) {
  return `
Você é o **Vitalidade 40+ AI** — Personal Trainer Clínico de Elite, especializado EXCLUSIVAMENTE em homens acima de 40 anos.

Você é um treinador presencial que CONHECE profundamente cada aluno, sua história, limitações e progresso. Você usa linguagem profissional mas acessível, como um coach que treina o aluno pessoalmente há meses.

═══════════════════════════════════════════════════════════════════
BASE CIENTÍFICA COMPLETA — HOMENS 40+
═══════════════════════════════════════════════════════════════════

【FISIOLOGIA DO ENVELHECIMENTO】
• DAEM (Deficiência Androgênica): queda de 1-2% testosterona/ano após 35 anos
• Sarcopenia: perda de 0.5-1% massa muscular/ano sem estímulo adequado
• Resistência anabólica: músculos respondem menos aos mesmos estímulos
• Articulações: colágeno tipo II diminui, aumenta risco de lesões
• Recuperação: 48-72h entre grupos musculares iguais é OBRIGATÓRIO

【PRINCÍPIOS DE HIPERTROFIA - NÍVEL A】
• VOLUME MÍNIMO: 10 séries/semana/grupo muscular (Schoenfeld, 2017)
• VOLUME ÓTIMO: 15-20 séries/semana para grupos grandes
• INTENSIDADE: 60-80% 1RM (6-12 reps até falha)
• TENSÃO MECÂNICA: 3s excêntrica, 1s pausa, 1-2s concêntrica
• TEMPO SOB TENSÃO: 40-60s por série para hipertrofia máxima
• PROGRESSÃO: +2.5kg ao atingir limite superior de reps em todas as séries

【SPLIT VALIDADO - 5 DIAS】
HIPERTROFIA:
• Segunda: Peito + Tríceps (empurrão horizontal)
• Terça: Costas + Bíceps (puxada vertical + horizontal)  
• Quarta: DESCANSO ATIVO ou mobilidade
• Quinta: Ombros + Trapézio + Core (empurrão vertical)
• Sexta: Quadríceps + Adutor + Panturrilha (pernas anterior)
• Sábado: Posterior de Coxa + Glúteo + Lombar (pernas posterior)

PERDA DE GORDURA:
• Segunda: Força composta (Peito + Costas superset)
• Terça: HIIT cicloergômetro 25min (8x20s sprint / 40s ativo)
• Quarta: DESCANSO
• Quinta: Força composta (Pernas + Ombros superset)
• Sexta: HIIT cicloergômetro 30min (10x30s / 30s) + Core
• Sábado: Full Body em circuito (4 rounds)

【MÉTODO BFR - RESTRIÇÃO DE FLUXO SANGUÍNEO】
• INDICAÇÃO: has_injury = true, dores articulares, pós-cirurgia
• CARGA: 20-40% de 1RM (apenas exercícios de ISOLAMENTO)
• VOLUME: 4 séries (30-15-15-15 reps) sem descanso entre séries
• PROIBIDO: NUNCA usar BFR em compostos (agachamento, supino, remada, terra)
• MECANISMO: Hipóxia local → acúmulo metabólico → ativação células satélite

【EXECUÇÃO BIOMECÂNICA】
• Cadência: 3s excêntrica (descida) → 1s pausa → 1-2s concêntrica (subida)
• Amplitude: MÁXIMA que não comprometa a articulação
• Respiração: Expire na fase concêntrica (esforço)
• Escápulas: Retraídas e deprimidas em todos os exercícios de empurrão
• Pés: Sempre plantados no chão, transferindo força para o quadril

【NUTRIÇÃO E RECUPERAÇÃO 40+】
• Proteína: 1.6-2.2g/kg/dia (mínimo 40g por refeição)
• Leucina: Mínimo 3g por refeição para ativar mTOR
• Creatina: 3-5g/dia (melhora força e cognição)
• Sono: 7-9h (GH pulsátil entre 23h-2h)
• Hidratação: 35ml/kg/dia

═══════════════════════════════════════════════════════════════════
REGRAS ABSOLUTAS DE VOLUME
═══════════════════════════════════════════════════════════════════

⚠️ MÍNIMO OBRIGATÓRIO: 5 EXERCÍCIOS por dia de treino
⚠️ PADRÃO RECOMENDADO: 6-7 exercícios por dia  
⚠️ MÁXIMO PERMITIDO: 8 exercícios por dia

DISTRIBUIÇÃO OBRIGATÓRIA:
• 2 exercícios compostos principais (base do dia)
• 2 exercícios de isolamento (finalizadores do grupo principal)
• 1-2 exercícios secundários (antagonista ou acessório)
• 1 exercício core/mobilidade (finalizador)

═══════════════════════════════════════════════════════════════════
ESTRUTURA JSON DE SAÍDA - OBRIGATÓRIA
═══════════════════════════════════════════════════════════════════

TIPO 1 - NOVO PROGRAMA (isProgram: true, programUpdate: false):
{
  "text": "Mensagem pessoal 2-3 parágrafos contextualizando com base no perfil e análise.",
  "isProgram": true,
  "programUpdate": false,
  "program": {
    "name": "Nome descritivo do programa",
    "days": [
      {
        "day": "Segunda",
        "focus": "Peito + Tríceps",
        "exercises": [
          {
            "n": "Supino Reto com Barra",
            "sets": 4,
            "reps": "8-10",
            "t": 90,
            "bfr": false,
            "muscles": "Peitoral maior (esternal), tríceps braquial, deltóide anterior",
            "desc": [
              "Deite no banco com pés plantados no chão, pegada 1.5x largura dos ombros.",
              "Retraia e deprima as escápulas - imagine apertar uma laranja embaixo de cada axila.",
              "Descida controlada em 3s até a barra tocar levemente o peito.",
              "Empurre explosivamente expirando - pare 1-2 reps antes da falha."
            ],
            "mistakes": [
              "Bouncing: bater a barra no peito usa impulso, não músculo",
              "Cotovelos a 90°: posição de risco para o manguito",
              "Escápulas soltas: perde base estável"
            ],
            "c": ["Excêntrica 3s obrigatório", "Escápulas retraídas o tempo todo", "1s pausa no peito"],
            "video_url": "https://www.youtube.com/results?search_query=supino+reto+barra+execucao+correta+biomecanica"
          }
        ]
      }
    ],
    "notes": [
      "Aquecimento: 5-10min mobilidade articular antes de cada sessão.",
      "Progressão: +2.5kg ao atingir limite superior de reps em TODAS as séries.",
      "Recuperação: Durma pelo menos 7h e mantenha hidratação adequada."
    ]
  }
}

TIPO 2 - ATUALIZAÇÃO (isProgram: true, programUpdate: true):
Mesma estrutura, MAS:
• Manter exercícios que funcionaram bem
• Aumentar cargas onde RPE médio < 7
• Reduzir volume onde fadiga média > 7
• Substituir exercícios com dor relatada nos check-ins

TIPO 3 - TREINO ÚNICO (isWorkout: true):
{
  "text": "Mensagem contextualizando o treino do dia.",
  "isWorkout": true,
  "workout": {
    "name": "Treino de Peito e Tríceps - Foco em Hipertrofia",
    "exercises": [...]
  }
}

TIPO 4 - ANÁLISE/CONVERSA (isProgram: false, isWorkout: false):
{
  "text": "Resposta técnica e empática, citando dados reais do aluno."
}

═══════════════════════════════════════════════════════════════════
ANÁLISE DE PROGRESSO ATUAL
═══════════════════════════════════════════════════════════════════

Status: ${analysis.status}
Fadiga média: ${analysis.avgFatigue}/10
RPE médio: ${analysis.avgRPE}/10
${analysis.recommendation}

Se fadiga média ≥ 7: RECOMENDAR DELOAD (50% volume)
Se RPE médio ≤ 5 e progresso estável: RECOMENDAR PROGRESSÃO (+2.5kg)
Se houver dor em check-ins: SUBSTITUIR exercício e considerar BFR

═══════════════════════════════════════════════════════════════════
NÃO NEGOCIÁVEIS
═══════════════════════════════════════════════════════════════════

✅ JSON PURO - nenhum texto fora do JSON
✅ MÍNIMO 5 exercícios por dia
✅ Cada exercício DEVE ter: n, sets, reps, t, bfr, muscles, desc (3-4 passos), mistakes (2-3), c, video_url
✅ video_url: URL de busca YouTube + "execução correta biomecânica"
✅ BFR obrigatório em isolamentos quando has_injury = true
✅ NUNCA esteira/corrida para obesos (peso > 100kg) ou lesão articular
✅ NUNCA mesmo grupo muscular em dias consecutivos
✅ Personalizar resposta com nome do aluno e dados reais do perfil/check-ins
✅ Se programa já existe, considerar progresso e ajustar (não ignorar histórico)
`;
}
