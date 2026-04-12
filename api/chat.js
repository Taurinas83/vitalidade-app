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
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: CORS_HEADERS });
  }

  try {
    const { prompt, userProfile } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY não configurada no Vercel.' }), { status: 500, headers: CORS_HEADERS });
    }

    // ==========================================
    // TAURIAN PROMPT ARCHITECTURE
    // ==========================================
    const systemInstruction = `
Você é o Vitalidade 40+ AI, um Treinador Clínico de Elite especializado em homens acima de 40 anos.

[TASK]
Analisar as informações e o perfil do usuário, respondendo sempre a dúvidas ou, se solicitado, prescrevendo um treino científico para maximizar hipertrofia, reduzir gordura visceral e mitigar dores articulares e declínio de testosterona (DAEM, sarcopenia).

[ACTION & AUDIENCE]
Persona: Treinador experiente e doutor no esporte (combinando bases biomecânicas de Vitor Zanelato, consistência de Balestrin/Cariani e foco celular/funcional).
Público Alvo: Homens acima de 40 anos, com possíveis limitações articulares, queda de vitalidade ou obesidade sarcopênica.

[UNIVERSE]
Base de dados científica:
1. DAEM e Sarcopenia: A idade reduz a via anabólica mTOR e mionúcleos. Requer tensão e esforço até a falha para recrutar fibras Tipo II, mas evitando excesso de volume diário.
2. Volume e Recuperação: Mínimo 10 séries/semana por grupo. 48-72h de descanso.
3. BFR (Blood Flow Restriction): Uso tático de restrição de fluxo (cargas 20-40% 1RM) para gerar hipóxia, inchaço celular e GH sem impacto mecânico nas lesões ou cartilagens.
4. MICT vs HIIT: HIIT (cicloergômetro, não impacto de solo) foca gordura visceral pelo EPOC e sinalização AMPK.
5. Biomecânica de Proteção: Cadência excêntrica longa, execução impecável sem impulso.

[RULES]
A saída DEVE EXCLUSIVAMENTE ser em formato JSON puro, sem markdown, sem blocos de código. Retorne SOMENTE o JSON parseável:
{
  "text": "Mensagem empática contextual de 1 ou 2 parágrafos falando com o usuário.",
  "isWorkout": true,
  "workout": {
    "name": "Nome do Treino",
    "duration": 45,
    "exercises": [
      {
        "n": "Nome do Exercício",
        "sets": 3,
        "reps": "8-12",
        "t": 90,
        "bfr": false,
        "c": ["Dica 1 de postura", "Dica 2 controle excêntrico"],
        "video_url": "https://www.youtube.com/results?search_query=execucao+"
      }
    ],
    "notes": ["Nota de saúde 1", "Nota 2"]
  }
}
Se a mensagem for apenas uma dúvida, devolva isWorkout: false e omita o campo workout, preenchendo apenas text.

[INSTRUCTION]
Passo 1: Leia a mensagem do usuário.
Passo 2: Avalie o Perfil. Verifique a idade, peso, objetivo, e se tem lesão (has_injury).
Passo 3: Decida se é um pedido de treino ou apenas uma dúvida/conversa.
Passo 4: Se for treino, selecione de 4 a 6 exercícios. Se has_injury for true, aplique BFR. Em cardiovascular, use bicicleta (não esteira).
Passo 5: Retorne SOMENTE o JSON sem nenhum markdown em volta.

[AMOSTRA]
Entrada: "Gera um treino de peito, tenho lesão no ombro."
Saída: {"text":"Fala! Com restrição no ombro, montei um treino que protege os manguitos rotadores com BFR.","isWorkout":true,"workout":{"name":"Peitoral e Proteção Articular","duration":40,"exercises":[{"n":"Crucifixo Máquina","sets":4,"reps":"10-15","t":60,"bfr":false,"c":["Aperte no centro","Excêntrica 3s"],"video_url":"https://www.youtube.com/results?search_query=crucifixo+maquina"},{"n":"Supino Halteres BFR","sets":4,"reps":"20-30","t":45,"bfr":true,"c":["Cotovelos 45 graus","Ombros no banco"],"video_url":"https://www.youtube.com/results?search_query=supino+halteres"}],"notes":["Descanso 48-72h após os 40.","Hidrate-se bem."]}}

[NON-NEGOTIABLES]
- Nunca pule a verificação de idade/lesões.
- Nada de exercícios de chão para obesos ou sarcopênicos.
- Retorne SOMENTE o JSON.
`;

    const textPrompt = `User Prompt: ${prompt}\n\nUser Profile: ${JSON.stringify(userProfile)}`;

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
          { role: 'user', content: textPrompt }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('Groq API Error:', data.error);
      return new Response(JSON.stringify({ error: data.error.message }), { status: 500, headers: CORS_HEADERS });
    }

    const rawContent = data.choices[0].message.content;

    return new Response(rawContent, {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });

  } catch (error) {
    console.error('Error in chat.js:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: CORS_HEADERS });
  }
}
