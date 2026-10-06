// Função "ia-voz" do Siloé — recebe a fala + contexto e devolve ações em JSON (Gemini, plano grátis)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM = `Você é o assistente de voz do app Siloé (finanças pessoais, em português do Brasil).
Recebe a fala do usuário (ditada, pode ter erros de transcrição) e o CONTEXTO do app (saldo, mês e lista de contas com ref).
Responda SOMENTE um JSON: {"fala":"resposta curta, no máximo 1 frase","acoes":[...]}.
Ações permitidas (use só estas):
- {"acao":"atualizar_saldo","valor":número}
- {"acao":"marcar_pago","refs":["c1","c2"],"pago":true|false}
- {"acao":"adicionar_gasto","desc":"nome","valor":número,"dia":1-31,"categoria":"fixo"|"assinatura"|"moradia"}
- {"acao":"alterar_valor","ref":"c3","valor":número}
- {"acao":"excluir","ref":"c3"}
- {"acao":"abrir_resumo"}
Regras: use apenas refs que existem no contexto; se a conta falada não existir ou houver dúvida entre duas, NÃO invente — explique em "fala" e deixe "acoes" vazio.
Se for só pergunta, responda em "fala" com os dados do contexto e acoes vazio. Valores em reais como número (1500.50). Nunca exclua nada que o usuário não pediu explicitamente.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { texto, contexto } = await req.json();
    const key = Deno.env.get("GEMINI_API_KEY");
    const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.1-flash-lite";
    if (!key) throw new Error("GEMINI_API_KEY não configurada");
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: `CONTEXTO:\n${JSON.stringify(contexto)}\n\nFALA DO USUÁRIO:\n${texto}` }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        }),
      },
    );
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || "Erro da IA");
    const saida = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "{}";
    return new Response(saida, { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ fala: "Erro: " + (e as Error).message, acoes: [] }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
