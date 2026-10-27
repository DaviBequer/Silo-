/* Siloé — IA do Google (Gemini): perguntar, modelos, novas tentativas; usada no Louvor e no Assistente (saiu do louvor-extra.js em 27/10/2026) */
/* ---------- Importar/Organizar com IA (Google Gemini, plano grátis) ----------
   Com a chave salva em Dados do App, o PDF/foto (ou o texto) vai para a IA, que devolve título, artista, tom e as
   partes com os acordes no formato "[D]Lou[Bm]vai". O app monta no formato do Siloé ([Parte], acordes em cima, --).
   Sem chave, sem internet ou se a IA falhar: volta para a leitura simples de antes. Trocar de modelo: LVI_IA_MODELO. */
const LVI_IA_MODELO = 'gemini-3.8-flash';
const LVI_IA_MODELOS_RESERVA = ['gemini-3.6-flash'];   // grátis também: usado quando o principal está "com muita procura"
const LVI_IA_MODELO_RAPIDO = 'gemini-3.5-flash-lite';   // Assistente: responde em 2–3 s (o principal leva 4–5); sem "pensar pouco"
/* o nome do modelo pode ser trocado em Ajustes → Recursos (o Google às vezes muda os nomes); vazio = o daqui */
const lviModeloPrincipal = ()=>String(state.iaModelo || '').trim() || LVI_IA_MODELO;
const lviModeloRapido = ()=>String(state.iaModeloRapido || '').trim() || LVI_IA_MODELO_RAPIDO;
const LVI_IA_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
/* modo fiel: arquivo do Drive que já está no formato certo → importa como está (sem corrigir, juntar nem repetir) */
let lviModoFiel = false;
const LVI_IA_FIEL = '\n\nMODO FIEL (vale mais que tudo acima): este arquivo já está do jeito certo, feito pelo próprio usuário. Copie exatamente: os mesmos nomes de partes (com 2x, Repete e o que mais estiver escrito), a mesma ordem, as mesmas quebras de linha, os mesmos acordes no mesmo lugar e o texto como está. Não junte nem separe versos, não crie nem tire Repete, não renomeie partes, não corrija maiúsculas nem pontuação. Só ignore cabeçalho, créditos e rodapé.';
/* regras da IA + as instruções do Davi (Dados do App) + o modo fiel quando for o caso */
function lviRegrasIA(){
  const dele = typeof iaInstrucoes === 'function' ? iaInstrucoes() : '';
  return LVI_IA_REGRAS + (dele ? '\n\nINSTRUÇÕES DO USUÁRIO (valem mais que as regras acima):\n' + dele : '') + (lviModoFiel ? LVI_IA_FIEL : '');
}
function lviChaveIA(){ return String((typeof state!=='undefined' && state && state.iaGoogleChave) || '').trim(); }
const LVI_IA_REGRAS = `Você organiza cifras de louvor (músicas cristãs em português) para um app de igreja.
Leia a cifra recebida e devolva o JSON pedido, seguindo estas regras:

LETRA
- Copie a letra exatamente como está: não invente, não complete, não troque palavras, não traduza.
- Corrija só erros de leitura óbvios: acorde grudado no meio da palavra (ex.: "particiCpar" é a palavra "participar" com o acorde C), letras ou espaços trocados por causa de colunas.
- Um verso = uma linha. Muitos PDFs quebram o verso no meio, logo antes de um acorde. Junte de volta numa linha só, com o acorde no lugar:
  PDF:  "A Preciso fazer muito mais do que" / "E tenho feito"
  Certo: "[A]Preciso fazer muito mais do que [E]tenho feito"
  PDF:  "Bm D Preciso falar desta paz que" / "A trago em meu peito"
  Certo: "[Bm]Preciso [D]falar desta paz que [A]trago em meu peito"
  Uma linha só fica curta quando o verso é curto de verdade (rima, pausa da melodia).

ACORDES (formato ChordPro)
- Cada linha vai com o acorde entre colchetes logo antes da sílaba onde ele é tocado. Ex.: "[D]Louvai a Je[Bm]sus, amoroso".
- Linha só de acordes (intro, solo, passagem, final): só os acordes entre colchetes separados por espaço. Ex.: "[A] [A7] [D] [E]".
- Mantenha os acordes como estão escritos (C#m7, E/G#, A4, Bb...). Não transponha.

PARTES
- Nomes em português, só a primeira letra maiúscula em cada palavra: Intro, Primeira Parte, Segunda Parte, Terceira Parte, Quarta Parte..., Pré-Refrão, Refrão, Ponte, Solo, Final.
- Se o arquivo já nomeia as partes, use esses nomes (ajustando para o padrão acima).
- Se não nomeia: a estrofe que volta igual várias vezes é o Refrão; as estrofes diferentes são Primeira Parte, Segunda Parte, e assim por diante, na ordem.
- Parte cantada mais de uma vez SEGUIDA (o arquivo marca "2x", "(3x)", "x2", ou a mesma letra aparece duas vezes em seguida): escreva a letra uma vez só e ponha o número em "vezes" (2 para 2x). Não crie repetição para isso.
- Quando uma parte volta igual (mesma letra) mais tarde, depois de outra parte: não escreva a letra de novo; crie uma parte com "repete" = nome da parte repetida, "linhas" vazio e "vezes" = quantas vezes ela é cantada nessa volta.
- O nome da parte não leva o "2x": isso vai só em "vezes".

O QUE IGNORAR
- Tudo o que não é letra nem acorde, esteja no topo, no meio ou no fim: cabeçalho (título, artista, "Tom: X"), créditos, compositor, cantor, intérprete, ministério, participação (feat.), versão, gravadora, álbum, arranjo, "composto por", "enviado por", "cifrado por", nome do site, links, @ de redes sociais, número de página, data/hora de impressão, afinação, capotraste, tablatura, "Cifra Club", avisos do site, rodapés.
- Na dúvida se uma linha é letra cantada ou informação sobre a música, só mantenha se ela for cantada.

MANTER SEMPRE
- Intro / Introdução com os acordes dela (é parte da música). Se o arquivo escreve "Introdução", o nome da parte é "Introdução"; se escreve "Intro", é "Intro".

DADOS DA MÚSICA
- titulo: só o nome da música.
- artista: cantor, banda ou ministério. Hino da Harpa Cristã: "Harpa Cristã - <número do hino>" e categoria "Harpa Cristã".
- categoria: "Corinhos" quando são corinhos (vários cânticos curtos juntos ou o arquivo diz Corinhos); senão "Louvor".
- tom: o tom indicado no arquivo (ex.: D, Bb, F#m). Se não houver, deduza pelo primeiro e último acorde.

Se receber uma cifra já em texto com linhas contendo só "-" ou "---", mantenha essas linhas no mesmo lugar dentro das linhas da parte.`;
const LVI_IA_ESQUEMA = {
  type:'object',
  properties:{
    titulo:{ type:'string', description:'Nome da música, sem artista e sem tom' },
    artista:{ type:'string', description:'Cantor, banda ou ministério. Hino da Harpa Cristã: "Harpa Cristã - <número>". Vazio se não houver.' },
    categoria:{ type:'string', enum:['Louvor','Harpa Cristã','Corinhos'] },
    tom:{ type:'string', description:'Tom como escrito no arquivo, ex.: D, Bb, F#m. Vazio se não souber.' },
    secoes:{ type:'array', items:{ type:'object', properties:{
      nome:{ type:'string', description:'Nome da parte, ex.: Primeira Parte, Refrão' },
      repete:{ type:'string', description:'Nome da parte anterior que esta parte só repete. Vazio quando a parte tem letra própria.' },
      vezes:{ type:'integer', description:'Quantas vezes a parte é cantada seguida (2 para 2x). 1 quando é uma vez só.' },
      linhas:{ type:'array', items:{ type:'string' }, description:'Linhas da parte em ChordPro. Vazio quando "repete" está preenchido.' }
    }, required:['nome','repete','vezes','linhas'] } }
  },
  required:['titulo','artista','categoria','tom','secoes']
};
function lviArquivoBase64(file){
  return new Promise((ok, erro)=>{
    const fr = new FileReader();
    fr.onload = ()=> ok(String(fr.result).split(',')[1] || '');
    fr.onerror = ()=> erro(new Error('não consegui ler o arquivo'));
    fr.readAsDataURL(file);
  });
}
function lviTipoImagem(f){
  if(f.type) return f.type;
  const ext = String(f.name||'').split('.').pop().toLowerCase();
  return ({ jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', heic:'image/heic', heif:'image/heif' })[ext] || 'image/jpeg';
}
/* texto gerado, nos formatos de resposta que o Google usa */
function lviTextoDaRespostaIA(c){
  if(!c) return '';
  if(typeof c.output_text === 'string') return c.output_text;
  for(const p of (c.steps || c.outputs || [])){
    if(p && Array.isArray(p.content)){ const t = p.content.filter(x=>x && x.type==='text').map(x=>x.text||'').join(''); if(t) return t; }
    if(p && p.type==='text' && p.text) return p.text;
  }
  const cand = c.candidates && c.candidates[0];
  if(cand && cand.content && cand.content.parts) return cand.content.parts.map(x=>x.text||'').join('');
  return '';
}
/* Google "com muita procura" (comum no plano grátis): tenta de novo e depois com o modelo reserva */
/* Google ocupado: insiste por cerca de 1 minuto, alternando o modelo principal e o reserva,
   com a contagem na tela. Só desiste antes se o erro não for passageiro (chave errada etc.). */
const LVI_IA_ESPERAS = [0, 3, 5, 8, 10, 12, 15];   // segundos antes de cada tentativa (~53 s no total)
async function lviPerguntarIA(partes, status, esquema, rapido){
  /* rapido (Assistente): começa no modelo leve (2–3 s); se falhar, o principal entra na hora, sem esperar */
  const principal = lviModeloPrincipal(), leve = lviModeloRapido();
  const modelos = [...new Set(rapido ? [leve, principal, ...LVI_IA_MODELOS_RESERVA] : [principal, ...LVI_IA_MODELOS_RESERVA])];
  let limite = false; const sumiram = new Set();
  for(let i = 0; i < LVI_IA_ESPERAS.length; i++){
    for(let s = rapido && i === 1 ? 0 : LVI_IA_ESPERAS[i]; s > 0; s--){
      if(status) status(`Google ocupado — tentando de novo em ${s} s (tentativa ${i+1} de ${LVI_IA_ESPERAS.length})`);
      await new Promise(r=>setTimeout(r, 1000));
    }
    if(i > 0 && status) status(`Tentando de novo (tentativa ${i+1} de ${LVI_IA_ESPERAS.length})…`);
    const modelo = modelos[i % modelos.length];
    if(sumiram.has(modelo)){ if(modelos.every(m=>sumiram.has(m))) break; continue; }
    if(status && status.modelo) status.modelo(modelo);
    if(status && status.log) status.log(`Perguntando ao ${lviNomeModelo(modelo)}${i ? ' (tentativa ' + (i+1) + ')' : ''}`);
    const t0 = Date.now();
    try{
      const resp = await lviPerguntarIAUmaVez(partes, modelo, esquema, rapido);
      if(status && status.log) status.log(`${lviNomeModelo(modelo)} respondeu em ${((Date.now()-t0)/1000).toFixed(1).replace('.',',')} s`, 'ok');
      return resp;
    }
    catch(e){
      if(status && status.log) status.log(`${lviNomeModelo(modelo)}: ${e.limite ? 'limite do plano atingido' : e.passageiro ? 'ocupado agora' : (e.message || 'erro')}`, 'aviso');
      if(e.naoExiste) sumiram.add(modelo);
      const reserva = modelo !== principal;
      if(!e.passageiro && !e.naoExiste && !reserva) throw e;   // chave errada, resposta estranha...: não adianta insistir
      if(!reserva) limite = limite || !!e.limite;
    }
  }
  if(sumiram.size) throw new Error(`o Google não tem mais o modelo ${[...sumiram].join(', ')}: troque o nome em Ajustes → Recursos → Modelos da IA`);
  throw new Error(limite ? 'limite grátis do Google atingido, tente daqui a pouco' : 'o Google está com muita procura agora, tente daqui a pouco');
}
/* rapido: pede à IA para pensar pouco (conversa do Atualizar). Se o Google recusar o ajuste, tenta sem ele e não usa mais. */
let lviSemPensarPouco = false;
async function lviPerguntarIAUmaVez(partes, modelo, esquema, rapido){
  const chave = lviChaveIA();
  if(!chave) throw new Error('sem chave');
  const ctrl = new AbortController(), t = setTimeout(()=>ctrl.abort(), 120000);
  let res, corpo;
  const comRapido = rapido && !lviSemPensarPouco && modelo !== lviModeloRapido();
  try{
    res = await fetch(LVI_IA_URL, {
      method:'POST', signal: ctrl.signal,
      headers:{ 'Content-Type':'application/json', 'x-goog-api-key': chave },
      body: JSON.stringify({ model: modelo, input: partes, response_format:{ type:'text', mime_type:'application/json', schema: esquema || LVI_IA_ESQUEMA },
        ...(comRapido ? { generation_config:{ thinking_level:'low' } } : {}) })
    });
    if(comRapido && res.status === 400){ lviSemPensarPouco = true; clearTimeout(t); return lviPerguntarIAUmaVez(partes, modelo, esquema, false); }
    corpo = await res.json().catch(()=>null);
  }catch(e){ throw new Error(e && e.name==='AbortError' ? 'a IA demorou demais' : 'sem conexão com a IA'); }
  finally{ clearTimeout(t); }
  const erro = (Array.isArray(corpo) ? corpo[0] : corpo || {}).error || (corpo && corpo.status==='failed' && (corpo.errors||[])[0]);
  if(!res.ok || erro){
    const msg = String((erro && erro.message) || res.status);
    if(/api.?key/i.test(msg)) throw new Error('a chave do Google não foi aceita (confira em Dados do App)');
    const e = new Error('a IA respondeu com erro: ' + msg.slice(0,90));
    /* 429 = limite do plano grátis (por minuto passa sozinho); 5xx/"high demand" = Google ocupado */
    e.limite = res.status === 429 || /quota|exhaust|rate.?limit/i.test(msg);
    e.passageiro = e.limite || res.status >= 500 || /demand|overload|unavailable|try again|temporar/i.test(msg);
    /* modelo que o Google tirou ou renomeou: passa para o próximo e avisa no fim */
    e.naoExiste = res.status === 404 || /model[^.]*(not found|does not exist)|unknown model/i.test(msg);
    throw e;
  }
  const texto = lviTextoDaRespostaIA(corpo);
  if(!texto) throw new Error('a IA não devolveu nada');
  try{ return JSON.parse(texto); }catch(e){ throw new Error('a resposta da IA veio incompleta'); }
}
/* "[D]Louvai a Je[Bm]sus" → { type:'lyric', text, chords:[{name, idx}] } (idx = coluna da sílaba) */
function lviLinhaChordPro(s){
  s = String(s||'').replace(/\s+$/,'');
  if(/^-{1,3}$/.test(s.trim())) return { type:'marca', text: s.trim() };   // "-" e "---" do usuário
  let texto = '', ult = 0, m;
  const chords = [], re = /\[([^\]]+)\]/g;
  while((m = re.exec(s))){ texto += s.slice(ult, m.index); chords.push({ name: m[1].trim(), idx: texto.length }); ult = re.lastIndex; }
  texto += s.slice(ult);
  if(!texto.trim()) return chords.length ? { type:'chords', chords: chords.map(c=>({ name:c.name })) } : { type:'lyric', text:'', chords:[] };
  return { type:'lyric', text: texto, chords };
}
/* A IA acerta as partes, mas chuta a posição dos acordes. Num PDF com texto, a leitura simples sabe a posição exata
   (pela coordenada de cada acorde em cima da letra). Para cada verso da IA, procura o mesmo verso (ou ele quebrado
   em duas linhas) na leitura simples e, se os acordes forem os mesmos, usa as posições de lá. */
const lviEhLetra = ch => /[a-z0-9à-ü]/.test(ch.toLowerCase());
function lviSoLetras(s){ return Array.from(String(s||'')).filter(lviEhLetra).join('').toLowerCase(); }
function lviLetrasAntes(texto, p){ let n = 0; for(let i = 0; i < Math.min(p, texto.length); i++) if(lviEhLetra(texto[i])) n++; return n; }
function lviPosDaLetra(texto, k){ let n = 0; for(let i = 0; i < texto.length; i++){ if(lviEhLetra(texto[i])){ if(n === k) return i; n++; } } return -1; }
function lviMesmoAcorde(a, b){ return String(a).replace(/\s/g,'').toLowerCase() === String(b).replace(/\s/g,'').toLowerCase(); }
function lviCorrigirAcordesPeloPdf(linhas, simples){
  if(!simples || !simples.length) return 0;
  let corrigidas = 0, inicio = 0;
  linhas.forEach(r=>{
    if(r.type !== 'lyric' || !r.chords || !r.chords.length) return;
    const alvo = lviSoLetras(r.text);
    if(alvo.length < 4) return;
    for(let k = 0; k < simples.length; k++){
      const i = (inicio + k) % simples.length;
      const grupo = [simples[i]];
      if(lviSoLetras(simples[i].text) !== alvo){
        if(i + 1 < simples.length && lviSoLetras(simples[i].text + simples[i+1].text) === alvo) grupo.push(simples[i+1]);
        else continue;
      }
      /* posição de cada acorde do PDF = mesma letra no verso da IA */
      let base = 0; const novos = [];
      grupo.forEach(s=>{
        const fim = s.text.replace(/\s+$/,'').length;
        (s.chords || []).forEach(c=>{
          let pos;
          if(c.idx >= fim){ pos = r.text.replace(/\s+$/,'').length + (c.idx - fim); if(grupo.length > 1 && s === grupo[0]) pos = lviPosDaLetra(r.text, base + lviLetrasAntes(s.text, fim)); }
          else { const p = lviPosDaLetra(r.text, base + lviLetrasAntes(s.text, c.idx)); pos = p < 0 ? r.text.length : p; }
          novos.push({ name: c.name, idx: Math.max(0, pos) });
        });
        base += lviLetrasAntes(s.text, s.text.length);
      });
      if(novos.length === r.chords.length && novos.every((c, x)=>lviMesmoAcorde(c.name, r.chords[x].name))){
        r.chords = novos.map((c, x)=>({ name: r.chords[x].name, idx: c.idx }));
        r.conferido = true;
        corrigidas++; inicio = i + grupo.length;
      }
      break;
    }
  });
  return corrigidas;
}
/* JSON da IA → mesmo formato de resultado do lviImportar */
function lviMontarDaIA(j, fi, simples){
  let secoes = (j && j.secoes || []).map(s=>{
    const rep = String(s.repete||'').trim();
    const v = Math.max(1, Number(s.vezes)||1);
    if(rep){ const r = lvVezesDoRotulo(rep); return { repeatOf:{ name: r.nome }, vezes: Math.max(v, r.vezes), lines:[] }; }
    const lines = (s.linhas||[]).filter(x=>String(x).trim() !== '--' && !(!/\[/.test(x) && lviEhInfoNaoLetra(x))).map(lviLinhaChordPro);   // crédito que a IA deixou passar
    lviCorrigirAcordesPeloPdf(lines, simples);
    while(lines.length && lines[lines.length-1].type==='lyric' && !lines[lines.length-1].text.trim()) lines.pop();   // linhas vazias no fim da parte
    const nm = lvVezesDoRotulo(String(s.nome||'Parte'));
    return { name: nm.nome || 'Parte', vezes: Math.max(v, nm.vezes), lines };
  });
  if(!lviModoFiel) lviJuntarSeguidas(secoes);
  secoes = secoes.filter(s=>s.repeatOf || s.lines.some(r=>r.type!=='lyric' || r.text.trim()));
  if(!secoes.some(s=>!s.repeatOf)) throw new Error('a IA não encontrou a letra');
  const km = /^([A-G][#b]?)(m?)/.exec(String(j.tom||'').trim());
  const raiz = (fi && fi.tom) || (km && km[1]) || null;
  const menor = fi && fi.tom ? fi.menor : !!(km && km[2]);
  const cat = ['Louvor','Harpa Cristã','Corinhos'].includes(j.categoria) ? j.categoria : '';
  const titulo = String(j.titulo||'').trim() || (fi && fi.titulo) || '';
  const artista = String(j.artista||'').trim() || (fi && fi.artista) || '';
  const conferencia = typeof lviConferenciaIA==='function' ? lviConferenciaIA(secoes, simples) : null;
  if(conferencia){   // título/artista do cabeçalho do PDF não são letra que "ficou de fora"
    const cab = [titulo, artista].map(lviSoLetras).filter(Boolean);
    conferencia.faltando = conferencia.faltando.filter(t=>{ const k = lviSoLetras(t); return !cab.some(c=>k.includes(c) || c.includes(k)); });
  }
  return {
    titulo,
    artista,
    categoria: cat,
    tom: lviTomSiloe(raiz, menor),
    conteudo: lviBlocosParaTexto(cat === 'Harpa Cristã' || lviEhHarpa(artista) ? lviPadraoHarpa(secoes) : secoes),
    blocos: secoes.length,
    usouIA: true,
    conferencia
  };
}
async function lviImportarComIA(file, status){
  status('Abrindo o arquivo', 'ler');
  const b64 = await lviArquivoBase64(file);
  status('Lendo letra e acordes com IA', 'ia');
  status('leva alguns segundos…');
  /* em paralelo: a leitura simples do PDF, só para pegar a posição exata dos acordes */
  const simplesP = lviEhImagem(file) ? Promise.resolve(null) : lviImportarSimples(file, ()=>{}).catch(()=>null);
  if(status.log && !lviEhImagem(file)) status.log('Lendo o PDF direto também, para pegar a posição exata de cada acorde');
  const arquivo = lviEhImagem(file)
    ? { type:'image', data: b64, mime_type: lviTipoImagem(file) }
    : { type:'document', data: b64, mime_type: 'application/pdf' };
  const j = await lviPerguntarIA([ arquivo, { type:'text', text: lviRegrasIA() + '\n\nNome do arquivo: ' + (file.name||'') } ], status);
  status('Separando as partes (estrofes, refrão…)', 'partes');
  const simples = await simplesP;
  const linhasPdf = simples ? lviTextoParaLinhas(simples.conteudo).filter(r=>r.type==='lyric') : null;
  if(status.log && linhasPdf) status.log(`Leitura direta do PDF: ${linhasPdf.length} linhas de letra`);
  status(linhasPdf ? 'Conferindo cada acorde com o PDF' : 'Conferindo a letra', 'conferir');
  return lviMontarDaIA(j, lviNomeDoArquivo(file.name||''), linhasPdf);
}

