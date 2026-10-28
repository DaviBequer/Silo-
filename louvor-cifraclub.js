/* Siloé — Cifra Club, Refazer pelo Cifra Club e Letras (saíram do louvor-extra.js em 27/10/2026, sem mudança) */
/* ---------- Cifra Club dentro do app: cola o link ou busca pelo nome → a cifra entra sozinha ----------
   Quem lê o Cifra Club é a função "cifra" do Supabase (o site não deixa o navegador ler direto).
   O texto vem com [Partes] e acordes em cima da letra: passa pelo Organizar simples + "-" dos slides. */
let ccResultados = [];
function ccAbrir(termo, refazerId){
  if(typeof lvFabMenu === 'function') lvFabMenu(false);
  ccRefazerId = refazerId || null;   // com id: o escolhido substitui a cifra dessa música (não cria outra)
  document.querySelector('#modalCifraClub .modal-header h3').textContent = 'Cifra Club';
  const inp = document.getElementById('ccBusca');
  inp.value = String(termo || '').trim();
  document.getElementById('ccLista').innerHTML = '';
  document.getElementById('modalCifraClub').classList.add('active');
  if(inp.value) ccBuscar(); else setTimeout(()=>inp.focus(), 80);
}
async function ccChamar(corpo){
  const sb = window.SiloSupabase && window.SiloSupabase.client;
  if(!sb) throw new Error('sem conexão');
  const { data, error } = await sb.functions.invoke('cifra', { body: corpo });
  if(error){
    const st = error.context && error.context.status;
    if(st === 404 || /Failed to send/i.test(error.message || '')) throw new Error('Não consegui falar com a função "cifra" do Supabase — ela já foi criada? (ou está sem internet)');
    let msg = error.message; try{ const j = await error.context.json(); if(j && j.erro) msg = j.erro; }catch(e){}
    throw new Error(msg);
  }
  if(data && data.erro) throw new Error(data.erro);
  return data;
}
/* busca sozinha enquanto digita (espera parar de digitar); o ✓/Enter do teclado busca na hora e fecha o teclado */
let ccDigitando = 0, ccBuscaN = 0;
function ccBuscarAoDigitar(){
  clearTimeout(ccDigitando);
  const t = document.getElementById('ccBusca').value.trim();
  if(t.length < 3 || /^https?:\/\//i.test(t)) return;
  ccDigitando = setTimeout(ccBuscar, 650);
}
async function ccBuscar(){
  clearTimeout(ccDigitando);
  const termo = document.getElementById('ccBusca').value.trim(), el = document.getElementById('ccLista');
  if(!termo) return;
  if(/^https?:\/\//i.test(termo)){ ccImportar(termo); return; }
  const n = ++ccBuscaN;   // só a última busca aparece (as respostas podem chegar fora de ordem)
  el.innerHTML = '<div class="voz-carregando">Buscando no Cifra Club…</div>';
  try{
    const lista = (await ccChamar({ busca: termo })).musicas || [];
    if(n !== ccBuscaN) return;
    ccResultados = lista;
    el.innerHTML = ccResultados.length ? ccResultados.map((m, i)=>`
      <button type="button" class="cu-escolher-item" onclick="ccImportar(ccResultados[${i}].url)">
        <span class="cu-escolher-nome">${lvEsc(m.titulo)}<small>${lvEsc(m.artista)}</small></span>
        <span class="cu-escolher-tom">${ICO(ICO_D.baixar, 18)}</span>
      </button>`).join('') : '<div class="gm-vazio">Nada encontrado no Cifra Club.</div>';
  }catch(e){ if(n === ccBuscaN) el.innerHTML = `<div class="drive-linha erro">${lvEsc(e.message)}</div>`; }
}
/* Cifra Club → cria a música direto (sem a tela Nova música) e abre ela.
   Se a música estiver no Letras, a letra de lá é a base (ordem das partes, frases, partes que faltam)
   e os acordes do Cifra Club são encaixados palavra por palavra. */
async function ccImportar(url){
  const el = document.getElementById('ccLista');
  /* cada passo aparece na tela (Cifra Club, Letras, junção) e o resumo fica na música depois */
  const passos = [];
  /* na tela só a onda com a frase do passo atual; os detalhes ficam para o resumo na música */
  el.innerHTML = lvOndaHtml('Lendo a cifra');
  const passo = (txt, tipo)=>{ passos.push({ txt, tipo: tipo || '' }); if(!tipo) lvOndaFrase(el, lviFraseCurta(txt)); };
  try{
    const r = await ccMontar(url, passo, ()=>passos.pop());
    closeModal('modalCifraClub');
    if(ccRefazerId){ ccAplicarRefazer(ccRefazerId, r, url, passos); return; }
    const l = lvCriarDireto(r.dados);
    ccGuardarOrigem(l, r, url);
    lvAtualizarBtnComparar(l);
    const st = document.getElementById('lvEdicaoImportStatus');
    if(st){
      st.classList.remove('erro');
      /* resumo curto: só os avisos (o que não deu certo); o resto já está na música */
      st.innerHTML = `<div class="cc-passos">${passos.filter(p=>p.tipo === 'erro').map(p=>`<div class="drive-linha ${p.tipo}">${lvEsc(p.txt)}</div>`).join('')}
        <div class="cc-passos-acoes"><button type="button" class="lvi-rel-ok" onclick="lvCompararAbrir()">Comparar com o original</button><button type="button" class="lvi-rel-ok" onclick="lviFecharRelatorio()">Ok</button></div></div>`;
    }
    showToast(r.comLetras ? '✓ Criada · letra do Letras + acordes do Cifra Club' : '✓ Criada pelo Cifra Club');
    lvEscreverNoEditor();
  }catch(e){ el.innerHTML = ccOutroCaminhoHtml(e, url); }
}
/* o Cifra Club falhou: diz o que houve e oferece outro caminho (abrir no site, puxar do Drive, escrever à mão) */
function ccOutroCaminhoHtml(e, url){
  const link = /^https?:\/\//.test(String(url || '')) ? url : '';
  return `<div class="drive-linha erro">${lvEsc((e && e.message) || 'O Cifra Club não respondeu')}</div>
    <div class="cc-outro"><span>Outro caminho:</span>
      ${link ? `<a class="link-txt" href="${lvEsc(link)}" target="_blank" rel="noopener">Abrir no site do Cifra Club</a>` : ''}
      ${typeof driveEscolherPdf === 'function' ? `<button type="button" class="link-txt" onclick="closeModal('modalCifraClub');driveEscolherPdf('novo')">Puxar o PDF do Drive</button>` : ''}
      <button type="button" class="link-txt" onclick="closeModal('modalCifraClub');openLouvorForm()">Escrever à mão</button></div>`;
}
/* ---------- Refazer pelo Cifra Club: a música que já existe ganha a cifra nova (com a junção Letras + acordes de hoje),
   mas continua a mesma: nome, cantor, categoria, data, status e lugar nos roteiros do Culto ficam; o tom em que ela
   estava é mantido (a cifra nova é transposta para ele). Desfazer volta como era. ---------- */
let ccRefazerId = null;
function lvRefazerCifraClub(){
  const l = getLouvorAtual(); if(!l) return;
  if(l.medley){ showToast('Medley se refaz pelas músicas dele (Montar o medley)'); return; }
  const url = l.origem && l.origem.tipo === 'cifraclub' && l.origem.url;
  ccAbrir(url ? '' : [l.titulo, (l.artista || '').replace(/^Harpa Cristã.*$/i, '')].filter(Boolean).join(' '), l.id);   // sem a origem: busca pelo nome e você escolhe
  document.querySelector('#modalCifraClub .modal-header h3').textContent = 'Refazer pelo Cifra Club';
  if(url) ccImportar(url);   // já sabe de onde veio: vai direto (os passos aparecem na janela)
}
function ccAplicarRefazer(id, r, url, passos){
  const l = state.louvores.find(x=>x.id === id); if(!l) return;
  const antes = { maior: lvTomMaiorAtual(l), menor: !!l.tomModoMenor };
  comDesfazer('Cifra refeita pelo Cifra Club', ()=>{
    l.conteudo = r.dados.conteudo;
    delete l.conteudoAntesOrganizar; delete l.conteudoOrganizado; delete l.medleyEditado;
    l.tomOriginal = r.dados.tomOriginal || ''; l.tomModoMenor = !!r.dados.tomModoMenor; l.transpose = 0; l.capo = r.dados.capo || 0;
    if(antes.maior && l.tomOriginal) lvAplicarTom(l, antes.maior, antes.menor);   // continua no tom em que estava
    ccGuardarOrigem(l, r, url);
    persist();
  }, ()=>{ if(louvorAtualId === id) abrirLouvorDetalhe(id); });
  ccRefazerId = null;
  renderLouvor();
  abrirLouvorDetalhe(id);
  lvEscreverNoEditor();
  const st = document.getElementById('lvEdicaoImportStatus');
  if(st){
    st.classList.remove('erro');
    st.innerHTML = `<div class="cc-passos">${passos.filter(p=>p.tipo === "erro").map(p=>`<div class="drive-linha ${p.tipo}">${lvEsc(p.txt)}</div>`).join('')}
      ${antes.maior && !r.dados.tomOriginal ? '<div class="drive-linha erro">O Cifra Club não disse o tom: confira o tom da música</div>' : ''}
      <div class="cc-passos-acoes"><button type="button" class="lvi-rel-ok" onclick="lvCompararAbrir()">Comparar com o original</button><button type="button" class="lvi-rel-ok" onclick="lviFecharRelatorio()">Ok</button></div></div>`;
  }
}
/* o original (texto do Cifra Club e a letra do Letras) fica guardado para comparar */
function ccGuardarOrigem(l, r, url){
  const textos = new Set((l.conteudo || '').split('\n').map(x=>x.trim()));
  l.revisar = lviCorrigirTextos(r.revisar).filter(t=>textos.has(t));
  if(!l.revisar.length) delete l.revisar;
  l.origem = { tipo:'cifraclub', url, texto: r.c.texto, letras: r.lt.achou ? { url: r.lt.url, titulo: r.lt.titulo, estrofes: r.lt.estrofes } : null, quando: Date.now() };
  persist();
}
/* lê a cifra (Cifra Club + Letras) e devolve os dados da música, sem criar nada.
   passo(texto, tipo) mostra o andamento; tirar() apaga a última linha de "carregando" */
async function ccMontar(url, passo, tirar){
  passo = passo || (()=>{}); tirar = tirar || (()=>{});
  passo('Lendo a cifra no Cifra Club…');
  {
    const c = await ccChamar({ url });
    if(!c || !(c.texto||'').trim()) throw new Error('a página não tem cifra');
    /* hino da Harpa: o Cifra Club põe o número no lugar do cantor → "Harpa Cristã - 525" */
    if(/harpa-crista/i.test(url) && !/harpa/i.test(c.artista || '')){
      const num = (/(\d+)/.exec(c.artista || '') || /\/(\d+)-/.exec(url) || [])[1];
      c.artista = 'Harpa Cristã' + (num ? ' - ' + num : '');
    }
    tirar(); passo(`✓ Cifra Club: "${c.titulo}" · ${c.artista}${c.tom ? ' · tom ' + c.tom : ''}`, 'ok');
    /* "[Intro] F#m  E5" → "[Intro]" + linha de acordes; tablaturas (E|---3---|) e "Parte 1 de 4" saem */
    /* desde out/2026 o Cifra Club põe um espaço invisível (​) no começo de cada linha: sem tirar, nenhuma linha de acordes é reconhecida */
    c.texto = c.texto.replace(/[​-‍⁠﻿]/g, '');
    let texto = c.texto.split('\n').flatMap(l=>{
      if(/^\s*[eEBGDAb]\|[-\d|hpbrvx\/\~().\s]*$/.test(l) || /^\s*Parte \d+ de \d+\s*$/i.test(l)) return [];
      const m = /^\s*(\[[^\]]+\])\s+(\S.*)$/.exec(l);
      return m ? [m[1], m[2]] : [l];
    }).join('\n').replace(/\n{3,}/g, '\n\n');
    passo('Buscando a letra no Letras…');
    let revisar = [], comLetras = false;
    const lt = await lviLetrasDe(c.titulo, c.artista);
    tirar();
    if(lt.achou){
      passo(`✓ Letras: "${lt.titulo}" · ${lt.artista} · ${lt.estrofes.length} estrofes`, 'ok');
      const j = lviJuntarComLetras(texto, lt.estrofes);
      /* a cifra é obrigatória: se a letra do Letras perdeu os acordes, fica só o Cifra Club */
      const acordes = t=>t.split('\n').filter(x=>x.trim() && isChordLine(x.trim())).length;
      if(j && acordes(j.texto) < acordes(texto) * .6){ passo('A letra do Letras perdia os acordes: fiquei com a cifra do Cifra Club', 'erro'); }
      else if(j){
        texto = j.texto; revisar = j.revisar; comLetras = true;
        const versos = lt.estrofes.reduce((s, e)=>s + e.length, 0);
        passo(`✓ Letra do Letras com os acordes do Cifra Club · ${versos - j.revisar.length} de ${versos} versos batidos${j.revisar.length ? ' · ' + j.revisar.length + ' para conferir (amarelo)' : ''}`, 'ok');
      } else passo('A letra do Letras é diferente da cifra (outra versão): fiquei só com o Cifra Club', 'erro');
    } else passo('Letras: ' + lt.motivo + ' — fiquei só com o Cifra Club', 'erro');
    const doc = lviMontaBlocos(lviTextoParaLinhas(texto));
    const harpa = lviEhHarpa(c.artista + ' ' + c.titulo);
    if(harpa){ lviPadraoHarpa(doc.secoes); passo('✓ Hino da Harpa: Refrão depois de cada parte', 'ok'); }
    else if(lviChaveIA()){
      passo('A IA está dando nome às partes (Primeira Parte, Pré-Refrão, Refrão, Ponte…)');
      const ok = await lviNomearPartesIA(doc.secoes, c.titulo, c.artista, ()=>{});
      tirar();
      passo(ok ? '✓ Partes nomeadas pela IA' : 'A IA não respondeu: ficaram os nomes da leitura simples', ok ? 'ok' : 'erro');
    }
    const conteudo = lvQuebrarSlides(lviBlocosParaTexto(doc.secoes));
    passo(`✓ ${doc.secoes.filter(s=>!s.repeatOf).length} partes · texto arrumado (maiúsculas, pontos, versos)`, 'ok');
    const m = /^([A-G](?:#|b)?)(m?)$/.exec(c.tom || '');
    const tom = m ? lviTomSiloe(m[1], !!m[2]) : null;
    /* capotraste: a cifra do Cifra Club vem escrita na forma (E) e o "Tom" é o que soa (F#) */
    const capo = tom ? ccCapoDaCifra(c, tom.tomOriginal, conteudo) : 0;
    if(capo) passo(`✓ Capotraste na ${capo}ª casa: tom ${c.tom}, acordes na forma de ${lvFormaDe(tom.tomOriginal, capo)}${tom.tomModoMenor ? 'm' : ''}`, 'ok');
    return { c, lt, revisar, comLetras, dados: {
      titulo: c.titulo || '', artista: c.artista || '', categoria: harpa ? 'Harpa Cristã' : 'Louvor',
      tomOriginal: tom ? tom.tomOriginal : '', tomModoMenor: tom ? tom.tomModoMenor : false, capo,
      conteudo
    } };
  }
}
/* casa do capotraste de uma cifra do Cifra Club (0 = sem):
   1º o que a página diz ("Capotraste: 2ª casa" / "com forma de E", vindo da função "cifra");
   sem isso, compara o tom da página com o tom em que os acordes estão escritos (campo harmônico) */
function ccCapoDaCifra(c, tomMaior, conteudo){
  const pcTom = lvPc(tomMaior); if(pcTom < 0) return 0;
  const n = parseInt(c.capo, 10);
  if(n > 0 && n < 12) return n;
  const f = /^([A-G](?:#|b)?)(m?)$/.exec(c.forma || '');
  if(f){ const pcF = lvPc(lviTomSiloe(f[1], !!f[2]).tomOriginal); if(pcF >= 0) return ((pcTom - pcF) % 12 + 12) % 12; }
  const forma = lvTomDosAcordes(conteudo);
  if(!forma || forma.pc === pcTom || forma.nota(pcTom) > .6 || forma.melhor < .85) return 0;
  const capo = ((pcTom - forma.pc) % 12 + 12) % 12;
  return capo >= 1 && capo <= 7 ? capo : 0;   // capo acima da 7ª casa quase não existe: aí é outra coisa (melhor não mexer)
}
/* tom maior em que os acordes de um texto estão escritos: { pc, melhor (0..1), nota(pc) } — fração dos acordes que cabem no campo de cada tom
   (o 1º e o último acorde contam em dobro: costumam ser o tom) */
function lvTomDosAcordes(texto){
  const raizes = [];
  (texto || '').split('\n').forEach(linha=>{
    if(!isChordLine(linha.trim())) return;
    lvAcordesDaLinha(linha).forEach(a=>{ const m = /^([A-G](?:#|b)?)/.exec(a.name || ''); const pc = m ? lvPc(m[1]) : -1; if(pc >= 0) raizes.push(pc); });
  });
  if(raizes.length < 4) return null;
  const pesos = raizes.map((pc, i)=>({ pc, p: i === 0 || i === raizes.length - 1 ? 2 : 1 }));
  const total = pesos.reduce((s, x)=>s + x.p, 0);
  const nota = k=>pesos.reduce((s, x)=>s + (LV_ESCALA_MAIOR.includes(((x.pc - k) % 12 + 12) % 12) ? x.p : 0), 0) / total;
  /* empate (E e A cabem nos mesmos acordes E A B C#m): vence o tom do 1º/último acorde ou do relativo menor dele */
  const ponta = k=>[raizes[0], raizes[raizes.length - 1]].filter(pc=>pc === k || pc === (k + 9) % 12).length * .03;
  let pc = 0;
  for(let k = 1; k < 12; k++) if(nota(k) + ponta(k) > nota(pc) + ponta(pc)) pc = k;
  return { pc, melhor: nota(pc), nota };
}
/* cria a música já com os dados e abre a tela dela (Cifra Club e Drive); abrir:false = só cria (roteiro colado do WhatsApp) */
function lvCriarDireto(d, abrir){
  const novo = {
    id: 'lv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    titulo: d.titulo || '', artista: d.artista || '', categoria: d.categoria || 'Louvor',
    tom: '', tomOriginal: d.tomOriginal || '', tomModoMenor: !!d.tomModoMenor, transpose: 0, capo: d.capo || 0,
    dataAgendamento: '', status: 'producao', colunas: 'auto', conteudo: d.conteudo || '', criadoEm: Date.now()
  };
  state.louvores.push(novo);
  persist();
  renderLouvor();
  if(abrir !== false) abrirLouvorDetalhe(novo.id);
  return novo;
}

/* ---------- Letras: busca pela função "cifra" do Supabase ---------- */
/* → { achou:true, titulo, artista, url, estrofes } ou { achou:false, motivo } (o motivo aparece nos passos da importação) */
async function lviLetrasDe(titulo, artista){
  if(!(titulo||'').trim()) return { achou:false, motivo:'música sem título' };
  /* a busca do Letras não acha nada com "-" no texto: limpa; se não achar com o cantor, tenta só pelo título */
  const limpa = s=>String(s||'').replace(/[-–—|()]/g, ' ').replace(/\s+/g, ' ').trim();
  for(const art of [limpa(artista), '']){
    try{
      const r = await Promise.race([ ccChamar({ letras:{ titulo: limpa(titulo), artista: art } }), new Promise(ok=>setTimeout(()=>ok('demorou'), 15000)) ]);
      if(r === 'demorou') return { achou:false, motivo:'o Letras demorou demais para responder' };
      if(r && r.achou && Array.isArray(r.estrofes) && r.estrofes.length) return r;
    }catch(e){ return { achou:false, motivo:'não consegui acessar (' + ((e && e.message) || 'erro') + ')' }; }
    if(!art) break;
  }
  return { achou:false, motivo:'essa música não está no Letras' };
}
const lviNormPalavra = w=>String(w||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
/* maior sequência de palavras em comum (na ordem) entre a linha do Letras e um trecho da cifra → pares [i, k] */
function lviLcsPares(a, b){
  const n = a.length, m = b.length, t = Array.from({ length:n+1 }, ()=>new Array(m+1).fill(0));
  for(let i = n-1; i >= 0; i--) for(let k = m-1; k >= 0; k--) t[i][k] = a[i] && a[i] === b[k] ? t[i+1][k+1] + 1 : Math.max(t[i+1][k], t[i][k+1]);
  const pares = []; let i = 0, k = 0;
  while(i < n && k < m){
    if(a[i] && a[i] === b[k]){ pares.push([i, k]); i++; k++; }
    else if(t[i+1][k] >= t[i][k+1]) i++; else k++;
  }
  return pares;
}
/* texto da cifra (formato do Siloé) + estrofes do Letras → { texto, revisar } ou null se não for a mesma música */
function lviJuntarComLetras(textoCifra, estrofes){
  const rows = lviTextoParaLinhas(textoCifra);
  const W = [], soAcordes = [];   // W: palavras da cifra com os acordes; soAcordes: linhas só de acordes (intro, solo, final)
  let rotulo = '', linhaN = 0;
  const ehSolo = t=>/^(intro|introdu|solo|instrumental|interl|final|ponte|passagem)/i.test(t || '');
  rows.forEach(r=>{
    if(r.type === 'label'){ rotulo = lvVezesDoRotulo(r.text).nome; return; }
    if(r.type === 'chords'){
      if(!r.chords.length) return;
      const rot = ehSolo(rotulo) ? rotulo : '', ant = soAcordes[soAcordes.length - 1];
      if(ant && ant.pos === W.length && ant.rotulo === rot) ant.linhas.push(r.chords);   // solo de várias linhas = um bloco só
      else soAcordes.push({ pos: W.length, rotulo: rot, linhas: [r.chords] });
      return;
    }
    if(r.type !== 'lyric' || !(r.text||'').trim()) return;
    const pal = []; const re = /\S+/g; let m;
    while((m = re.exec(r.text))) pal.push({ n: lviNormPalavra(m[0]), ini: m.index, fim: m.index + m[0].length, chords: [], rotulo, linha: linhaN });
    if(!pal.length) return;
    linhaN++;
    (r.chords||[]).forEach(c=>{
      const w = pal.find(p=>c.idx >= p.ini && c.idx < p.fim) || pal.find(p=>p.ini >= c.idx) || pal[pal.length-1];
      w.chords.push({ name: c.name, off: Math.max(0, c.idx - w.ini) });
    });
    pal.forEach(p=>W.push(p));
  });
  if(!W.length) return null;
  const Wn = W.map(w=>w.n);
  let ptr = 0, total = 0, achadas = 0;
  const revisar = [], fimDaEstrofe = [], rotVotos = [];   // nome que a parte tinha na cifra (Refrão, Pré-Refrão, Segunda Parte…), por estrofe
  const saida = estrofes.map((est, e)=>est.map(linha=>{
    const pal = []; const re = /\S+/g; let m;
    while((m = re.exec(linha))) pal.push({ n: lviNormPalavra(m[0]), ini: m.index, fim: m.index + m[0].length });
    const ln = pal.map(p=>p.n);
    total += ln.length;
    /* onde essa linha está na cifra: testa os começos possíveis e fica com o que mais bate (prefere seguir em frente) */
    let melhor = null;
    for(let j = 0; j < Wn.length; j++){
      if(Wn[j] !== ln[0] && Wn[j] !== ln[1]) continue;
      const pares = lviLcsPares(ln, Wn.slice(j, j < ptr ? Math.min(j + ln.length * 2 + 2, ptr) : j + ln.length * 2 + 2));   // voltando (refrão repetido): não invade o que vem depois
      const nota = pares.length - (j < ptr ? 0.5 : 0) - Math.abs(j - ptr) / 100000;
      if(!melhor || nota > melhor.nota) melhor = { j, pares, nota };
    }
    const chords = [];
    if(melhor && melhor.pares.length >= Math.max(1, ln.length * 0.5)){
      achadas += melhor.pares.length;
      let ult = -1;
      const naPalavra = (i, c)=>chords.push({ name: c.name, idx: pal[i].ini + Math.min(c.off, Math.max(0, pal[i].fim - pal[i].ini - 1)) });
      melhor.pares.forEach(([i, k])=>{
        const w = W[melhor.j + k]; ult = melhor.j + k; w.usada = true;
        const vt = rotVotos[e] = rotVotos[e] || {}; vt[w.rotulo || ''] = (vt[w.rotulo || ''] || 0) + 1;
        w.chords.forEach(c=>naPalavra(i, c));
      });
      /* acorde numa palavra da cifra que não bateu (escrita diferente: "pra"/"para", "Tô"/"Estou"): vai para a palavra
         do Letras que está no mesmo lugar entre as que bateram — nenhum acorde se perde */
      const P = melhor.pares, k0 = Math.max(0, P[0][1] - P[0][0]), k9 = P[P.length-1][1] + (ln.length - 1 - P[P.length-1][0]);
      for(let k = k0; k <= k9 && melhor.j + k < W.length; k++){
        const w = W[melhor.j + k];
        if(w.usada || !w.chords.length || melhor.j + k < ptr) continue;
        const ant = [...P].reverse().find(p=>p[1] < k), dep = P.find(p=>p[1] > k);
        let i = ant && dep ? ant[0] + Math.round((k - ant[1]) * (dep[0] - ant[0]) / (dep[1] - ant[1])) : ant ? ant[0] + (k - ant[1]) : dep[0] - (dep[1] - k);
        i = Math.max(0, Math.min(pal.length - 1, i));
        w.usada = true; ult = Math.max(ult, melhor.j + k);
        w.chords.forEach(c=>naPalavra(i, c));
      }
      ptr = ult + 1;
      fimDaEstrofe[e] = Math.max(fimDaEstrofe[e] ?? -1, ult);
      /* o verso fica escrito como no Letras (uma linha só), mesmo que no Cifra Club esteja quebrado em duas */
      chords.sort((a, b)=>a.idx - b.idx);
      if(melhor.pares.length < ln.length * 0.8) revisar.push(linha.trim());
      return [{ text: linha.trim(), chords: chords.map(c=>({ name: c.name, idx: Math.max(0, c.idx - (linha.length - linha.trimStart().length)) })) }];
    }
    revisar.push(linha.trim());
    return [{ text: linha, chords }];
  }).flat());
  if(!total || achadas / total < 0.55) return null;   // letra diferente demais: não é a mesma música (ou é outra versão)
  /* monta o texto: intro → estrofes (com solo/instrumental onde estavam na cifra) → final */
  const linhaTxt = r=>(r.chords.length ? [lviLinhaDeAcordes(r.chords)] : []).concat([r.text]);
  const acordesTxt = s=>s.linhas.map(ch=>ch.map(c=>c.name).join('   ')).join('\n');
  const out = [];
  let ultimoRot = null;
  soAcordes.filter(s=>s.pos === 0).forEach(s=>{
    if(s.rotulo !== ultimoRot) out.push('[' + (s.rotulo || 'Intro') + ']');
    ultimoRot = s.rotulo; out.push(acordesTxt(s));
  });
  if(out.length) out.push('--');
  const meio = soAcordes.filter(s=>s.pos > 0 && s.pos < W.length), usados = new Set();
  saida.forEach((est, e)=>{
    /* a estrofe leva o nome que tinha na cifra (o mais comum entre as palavras dela) */
    const vt = rotVotos[e] || {}, top = Object.keys(vt).sort((a, b)=>vt[b] - vt[a])[0];
    if(top && !/^(intro|introdu|solo|instrumental|interl|tab)/i.test(top) && vt[top] * 2 > Object.values(vt).reduce((s, n)=>s + n, 0)) out.push('[' + top + ']');
    est.forEach(r=>out.push(...linhaTxt(r)));
    out.push('--');   // estrofe do Letras = uma parte (a linha divisória fecha a parte; linha em branco não fecharia numa cifra com nomes)
    const ate = fimDaEstrofe[e] ?? -1;
    meio.forEach((s, x)=>{
      if(usados.has(x) || ate < 0 || s.pos > ate + 1) return;
      usados.add(x); out.push('[' + (s.rotulo || 'Instrumental') + ']', acordesTxt(s), '--');
    });
  });
  soAcordes.filter(s=>s.pos >= W.length && s.pos > 0).forEach(s=>out.push('[' + (s.rotulo || 'Final') + ']', acordesTxt(s), ''));
  return { texto: out.join('\n').replace(/^\n+|\s+$/g, ''), revisar };   // sem trim no começo: a 1ª linha de acordes começa com espaços
}

