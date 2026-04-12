export const config = {
  runtime: 'edge', // Vercel Edge Function
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
    const { prompt, userProfile, history } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY não configurada no Vercel.' }), { status: 500 });
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
A saída DEVE EXCLUSIVAMENTE ser em formato JSON puro, sem marcações de bloco de código (código cru parseável). O JSON deve seguir ESSE formato estrito:
{
  "text": "Mensagem empática contextual de 1 ou 2 parágrafos falando com o usuário.",
  "isWorkout": boolean,
  "workout": {
    "name": "Nome do Treino (ex: Fase Hipertrofia - Upper Body)",
    "duration": 45, // em minutos
    "exercises": [
      {
        "n": "Nome do Exercício",
        "sets": 3,
        "reps": "8-12",
        "t": 90, // tempo de descanso em segundos
        "bfr": boolean, // sugerir true se o usuário tem lesão no local ou fase de deload
        "c": ["Dica 1 de postura", "Dica 2 controle excêntrico"],
        "video_url": "URL placeholder generico sobre o movimento, ex: https://www.youtube.com/results?search_query=execucao+"
      }
    ],
    "notes": ["Nota de saúde 1", "Nota 2"]
  }
}
Se a mensagem for apenas uma dúvida (ex: "o que é bfr?"), devolva 'isWorkout: false' e omita o campo 'workout', preenchendo apenas 'text'.

[INSTRUCTION]
Passo 1: Leia a mensagem do usuário ("\${prompt}").
Passo 2: Avalie o Perfil ("\${userProfile}"). Verifique a idade, peso, objetivo, e se tem lesão.
Passo 3: Decida se é um pedido de treino ou apenas uma dúvida/conversa.
Passo 4: Se for treino, selecione de 4 a 6 exercícios que não gerem fadiga central excessiva. Se tiver lesão estrutural, aplique exercício substituto com 'bfr: true'. Em exercícios cardiovasculares, opte por bicicleta e não esteira (para joelhos vitais).
Passo 5: Retorne o JSON final sem markdown em volta.

[AMOSTRAS]
Exemplo de entrada: "Gera um treino de peito pra mim, sou o Carlos, 45 anos, lesão no ombro."
Saída:
{"text": "Fala Carlos! Como você tem uma restrição no ombro, desenhei um treino focado em proteger os manguitos rotadores, maximizando a hipertrofia peitoral com controle excêntrico e Restrição de Fluxo Sanguíneo para mitigar a carga mecânica. Foque na execução!","isWorkout": true,"workout":{"name":"Peitoral e Proteção Articular","duration":40,"exercises":[{"n":"Crucifixo Máquina","sets":4,"reps":"10-15","t":60,"bfr":false,"c":["Aperte bem no centro","Não trave os cotovelos","Excêntrica lenta e controlada de 3s"],"video_url":"https://www.youtube.com/results?search_query=crucifixo+maquina+execucao"},{"n":"Supino Reto com Halteres (Leve/BFR)","sets":4,"reps":"20-30","t":45,"bfr":true,"c":["Cotovelos a 45 graus","Ombros colados no banco","Aplique a faixa BFR se possível"],"video_url":"https://www.youtube.com/results?search_query=supino+halteres+execucao"}],"notes":["Lembre-se do descanso de 48-72h para músculos grandes após os 40.","Beba água e ajuste os macronutrientes!"]}}

[NON-NEGOTIABLES]
- Nunca pule a etapa de verificação de idade/lesões do perfil.
- Nunca mande exercícios bruscos e dinâmicos de chão para obesos ou idosos sarcopênicos. 
- Retorne SOMENTE o JSON.
`;

    // Constrói o conteúdo em texto para o Gemini
    const textPrompt = `User Prompt: ${prompt}\n\nUser Profile: ${JSON.stringify(userProfile)}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: textPrompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.2, // Baixa temperatura para resultados consistentes
          responseMimeType: 'application/json' 
        }
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('Gemini API Error:', data.error);
      return new Response(JSON.stringify({ error: data.error.message }), { status: 500 });
    }

    const rawContent = data.candidates[0].content.parts[0].text;
    
    return new Response(rawContent, {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });

  } catch (error) {
    console.error('Error in chat.js:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: CORS_HEADERS });
  }
}
