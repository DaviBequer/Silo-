
/* ================= LOUVOR ================= */
const LOUVOR_CATEGORIAS = ['Louvor','Harpa Cristã','Corinhos'];
let louvorFiltroAtivo = 'Atual';
let louvorSearchTerm = '';
let louvorAtualId = null;
let lvSlideIndex = 0;
let louvorFiltrosVisiveis = true;

function getLouvorAtual(){ return state.louvores.find(l=>l.id===louvorAtualId); }

/* capas padrão por tipo (escolha do Davi, v12): Louvor = ondas de som no grafite, Harpa = harpa no dourado, Corinho de fogo = chama */
const LV_CAPA = {
  'Louvor': { cls:'lou', d:'<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>' },
  'Harpa Cristã': { cls:'har', d:'<path d="M6 20.5V5.2"/><circle cx="6" cy="4" r="1.1"/><path d="M6 5.2c2.6-2.2 5.4 1.6 8.4-.2 1.9-1.1 3.4-1.4 4.8-.6"/><path d="M19.4 4.2L8.2 20.5" stroke-width="2.3"/><path d="M4.4 20.8h6"/><path d="M9 4.9v13.6M11.8 5.6v8.9M14.6 5v5.4M17.2 4.4v2.4" stroke-width="1"/>' },
  'Corinhos': { cls:'fog', d:'<path d="M12 21.2c-3.9 0-6.6-2.7-6.6-6.3 0-3.4 2.4-5.5 3.7-8.5.4 1.9 1.4 3.1 2.6 3.7-.2-2.9.9-5.5 3.1-7.3-.1 3 1.3 4.7 2.6 6.5 1 1.4 1.7 3 1.7 5.2 0 3.9-3.1 6.7-7.1 6.7z"/><path d="M12 18.6c-1.6 0-2.7-1.1-2.7-2.6 0-1.4 1-2.4 1.8-3.7.3 1 .9 1.6 1.6 1.9.1-1 .6-1.9 1.4-2.5 0 1.3.7 2.1 1.1 2.9.3.5.5 1 .5 1.6 0 1.4-1.4 2.4-3.7 2.4z"/>' }
};
function lvCapaHtml(categoria, tom){
  const c = LV_CAPA[categoria] || LV_CAPA['Louvor'];
  return `<span class="lv-capa ${c.cls}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${c.d}</svg>${tom ? `<b class="lv-capa-tom">${tom}</b>` : ''}</span>`;
}

function lvEstaAtual(l){
  if(l.status !== 'finalizada') return true;
  if(!l.dataAgendamento) return false;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const data = new Date(l.dataAgendamento+'T00:00:00');
  return data >= hoje;
}

function renderLouvor(){
  renderLouvorFilterChips();
  if(typeof renderCultoBotao==='function') renderCultoBotao();
  renderLouvorLista();
}

function toggleLouvorFiltros(){
  louvorFiltrosVisiveis = !louvorFiltrosVisiveis;
  renderLouvorFilterChips();
}
function renderLouvorFilterChips(){
  const btn = document.getElementById('louvorFiltroToggle');
  if(btn) btn.classList.toggle('active', louvorFiltrosVisiveis);
  const el = document.getElementById('louvorFilterChips');
  if(!louvorFiltrosVisiveis){ el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const chips = ['Atual', ...LOUVOR_CATEGORIAS];
  el.innerHTML = chips.map(c=>
    `<button class="filter-chip${louvorFiltroAtivo===c?' active':''}" onclick="setLouvorFiltro('${c}')">${c}</button>`
  ).join('');
}
function setLouvorFiltro(c){
  louvorFiltroAtivo = c;
  renderLouvorFilterChips();
  renderLouvorLista();
}
function onLouvorSearchInput(v){
  louvorSearchTerm = v.trim().toLowerCase();
  document.getElementById('louvorSearchClear').style.display = v ? 'block' : 'none';
  renderLouvorLista();
}
function limparLouvorSearch(){
  louvorSearchTerm = '';
  document.getElementById('louvorSearchInput').value = '';
  document.getElementById('louvorSearchClear').style.display = 'none';
  renderLouvorLista();
}
function renderLouvorLista(){
  const el = document.getElementById('louvorLista');
  let items = state.louvores.slice();
  if(louvorFiltroAtivo === 'Atual') items = items.filter(lvEstaAtual);
  else items = items.filter(l=>l.categoria===louvorFiltroAtivo);
  if(louvorSearchTerm){
    items = items.filter(l=>
      (l.titulo||'').toLowerCase().includes(louvorSearchTerm) ||
      (l.artista||'').toLowerCase().includes(louvorSearchTerm)
    );
  }
  const porNome = (a,b)=> (a.titulo||'').localeCompare(b.titulo||'');
  /* Atual: por data (a mais próxima primeiro); sem data vão para o fim, por nome. Nas categorias: por nome */
  if(louvorFiltroAtivo === 'Atual'){
    items.sort((a,b)=>{
      const da = a.dataAgendamento || '', db = b.dataAgendamento || '';
      if(da && db && da !== db) return da < db ? -1 : 1;
      if(!da !== !db) return da ? -1 : 1;
      return porNome(a,b);
    });
  } else items.sort(porNome);
  if(items.length===0){
    /* pesquisou e não achou: oferece buscar no Cifra Club (abre no navegador) */
    const termo = (document.getElementById('louvorSearchInput')?.value || '').trim();
    el.innerHTML = termo
      ? `<div class="lv-cifraclub">
          <div class="lv-cc-titulo">“${lvEsc(termo)}” não está no app</div>
          <button type="button" class="lv-cc-btn" onclick="ccAbrir(document.getElementById('louvorSearchInput').value)">
            <img class="cc-logo-mini" src="logo-cifraclub.png" alt="" width="22" height="22">
            <span>Buscar no Cifra Club</span>
          </button>
          <div class="lv-cc-dica">O app busca e já importa a cifra</div>
        </div>`
      : `<div class="empty-state"><div class="title">Nenhum louvor encontrado</div><div class="desc">Toque no + para adicionar</div></div>`;
    return;
  }
  /* v12: capa do tipo (Louvor = ondas, Harpa = harpa dourada, Corinho de fogo = chama) com o tom no canto;
     nome, cantor e status um embaixo do outro; o calendário com o dia fica sempre na coluna da direita */
  el.innerHTML = items.map(l=>{
    ensureLouvorConfig(l);
    const tomAtual = lvTomAtual(l);
    const finalizada = l.status === 'finalizada';
    const quem = l.medley ? `Medley · ${l.medley.musicas.length} música${l.medley.musicas.length===1?'':'s'}` : (l.artista || (l.categoria === 'Harpa Cristã' ? 'Harpa Cristã' : l.categoria === 'Corinhos' ? 'Corinho de fogo' : 'Artista desconhecido'));
    const dia = l.dataAgendamento ? Number(l.dataAgendamento.split('-')[2]) : 0;
    return `<div class="lv-card" onclick="abrirLouvorDetalhe('${l.id}')">
      ${lvCapaHtml(l.categoria, tomAtual)}
      <div class="lv-card-info">
        <div class="lv-card-titulo">${lvEsc(l.titulo||'Sem título')}</div>
        <div class="lv-card-meta">${lvEsc(quem)}</div>
        <span class="lv-card-status${finalizada?' finalizada':''}">${finalizada?'Pronto':'Em produção'}</span>
      </div>
      ${dia ? `<span class="cal" title="${l.dataAgendamento.split('-').reverse().join('/')}"><b>${dia}</b></span>` : '<span class="lv-card-semdata"></span>'}
    </div>`;
  }).join('');
}

/* botão + do Louvor: menu rápido (Drive, importar, medley, à mão) */
function lvFabMenu(abrir){
  const m = document.getElementById('lvFabMenu'), fab = document.getElementById('lvFab'); if(!m) return;
  if(abrir === undefined) abrir = !m.classList.contains('aberto');
  if(abrir && typeof atualizarStatusDrive === 'function') atualizarStatusDrive();
  m.classList.toggle('aberto', !!abrir);
  fab?.classList.toggle('aberto', !!abrir);
}
/* ---------- Novo louvor ---------- */
function openLouvorForm(){
  document.getElementById('lvNovoTitulo').value = '';
  document.getElementById('lvNovoArtista').value = '';
  document.getElementById('lvNovoData').value = '';
  window.lvNovoCategoriaSelecionada = 'Louvor';
  window.lvNovoTomOriginal = '';
  window.lvNovoTomModoMenor = false;
  window.lvNovoConteudo = '';   // preenchido se importar um PDF/foto
  window.lvNovoRevisar = [];
  document.getElementById('pageLouvorForm').classList.remove('importando');
  const st = document.getElementById('lvNovoImportStatus'); if(st){ st.textContent = ''; st.classList.remove('erro'); }
  /* selo da IA no botão Importar e a dica do formulário */
  const chip = document.getElementById('lvnIaChip');
  if(chip){ const ia = typeof lviChaveIA==='function' && lviChaveIA(); chip.classList.toggle('sem', !ia); chip.lastChild.textContent = ia ? 'Gemini' : 'Sem IA'; }
  const form = document.querySelector('#pageLouvorForm .lvn-form'); if(form) form.classList.remove('preenchido');
  const dica = document.getElementById('lvnFormDica'); if(dica) dica.textContent = 'ou preencha à mão';
  renderLvNovoCategoriaChips();
  atualizarLvNovoTomBox();
  document.getElementById('pageLouvorForm').classList.add('active');
  window.scrollTo(0,0);
}
function closeLouvorForm(){
  document.getElementById('pageLouvorForm').classList.remove('active');
  document.body.style.overflow = '';
}
function renderLvNovoCategoriaChips(){
  document.getElementById('lvNovoCategoriaChips').innerHTML = LOUVOR_CATEGORIAS.map(c=>
    `<button type="button" class="dif-chip${window.lvNovoCategoriaSelecionada===c?' active':''}" onclick="selecionarLvNovaCategoria('${c}')">${c}</button>`
  ).join('');
}
function selecionarLvNovaCategoria(c){
  window.lvNovoCategoriaSelecionada = c;
  renderLvNovoCategoriaChips();
}
function criarLouvor(){
  const titulo = document.getElementById('lvNovoTitulo').value.trim();
  const id = 'lv_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  const novo = {
    id,
    titulo,
    artista: document.getElementById('lvNovoArtista').value.trim(),
    categoria: window.lvNovoCategoriaSelecionada || 'Louvor',
    tom: '',
    tomOriginal: window.lvNovoTomOriginal || '',
    tomModoMenor: !!window.lvNovoTomModoMenor,
    transpose: 0,
    dataAgendamento: document.getElementById('lvNovoData').value || '',
    status: 'producao',
    colunas: 'auto',
    conteudo: window.lvNovoConteudo || '',
    ...(window.lvNovoRevisar && window.lvNovoRevisar.length ? { revisar: window.lvNovoRevisar.slice() } : {}),
    criadoEm: Date.now()
  };
  state.louvores.push(novo);
  persist();
  closeLouvorForm();
  renderLouvor();
  abrirLouvorDetalhe(id);
}

/* ---------- Detalhe / Edição ---------- */
function abrirLouvorDetalhe(id){
  louvorAtualId = id;
  const l = getLouvorAtual();
  if(!l) return;
  lvPdfCarregarFonte();   // fonte do PDF já pronta quando tocar em PDF, Drive ou WhatsApp
  if(typeof lvAtualizarBtnDrive === 'function') setTimeout(lvAtualizarBtnDrive, 0);
  if(typeof lvAtualizarBtnComparar === 'function') lvAtualizarBtnComparar(l);
  ensureLouvorConfig(l);
  if(typeof lvAoAbrirDetalhe==='function') lvAoAbrirDetalhe(l);
  document.getElementById('louvorDetalheHeaderTitle').textContent = l.titulo || 'Sem título';
  document.getElementById('lvTitulo').value = l.titulo || '';
  document.getElementById('lvArtista').value = l.artista || '';
  document.getElementById('lvConteudo').value = l.conteudo || '';
  document.getElementById('lvDataAgendamento').value = l.dataAgendamento || '';
  renderLvCategoriaChips();
  atualizarLvTomBox();
  renderLvStatusBtn();
  /* abre na última aba usada neste aparelho (Música = editor de texto, Visualizar = folha); sem letra ainda: Música, para colar */
  let aba = 'edicao'; try{ aba = localStorage.getItem('siloe-lv-aba') || 'edicao'; }catch(e){}
  if(!(l.conteudo||'').trim() || !['edicao','visualizar','slides'].includes(aba)) aba = 'edicao';
  switchLouvorSubtab(aba);
  document.getElementById('pageLouvorDetalhe').classList.add('active');
  lvAtualizarEditor();
  if(typeof lvAtualizarBtnOrganizar==='function') lvAtualizarBtnOrganizar();
  window.scrollTo(0,0);
  /* música que veio do Drive só com o arquivo (roteiro colado): abre direto o PDF */
  if(l.origem && l.origem.soArquivo && !(l.conteudo||'').trim() && typeof lvCompararAbrir==='function') lvCompararAbrir();
}
function renderLvStatusBtn(){
  const l = getLouvorAtual(); if(!l) return;
  const finalizada = l.status === 'finalizada';
  /* o mesmo botão na música e no Comparar (música só com o PDF do Drive abre direto no Comparar) */
  ['lvStatusBtn', 'lvcmpStatus'].forEach(id=>{
    const btn = document.getElementById(id); if(!btn) return;
    btn.textContent = finalizada ? 'Pronto' : 'Em Produção';
    btn.classList.toggle('finalizada', finalizada);
  });
}
function toggleLouvorStatus(){
  const l = getLouvorAtual(); if(!l) return;
  l.status = l.status === 'finalizada' ? 'producao' : 'finalizada';
  /* Pronto = o arquivo está certo: nada para conferir; trocar o tom depois só muda a nota */
  if(l.status === 'finalizada'){
    delete l.revisar;
    if(l.origem && l.origem.tipo === 'drive') showToast('Pronto: o PDF do Drive está certo. Se trocar o tom, o app só muda a nota');
    lvAtualizarEditor();
    if(document.getElementById('pageLvComparar')?.classList.contains('active') && typeof lvCompararRenderApp === 'function') lvCompararRenderApp(l);
  }
  persist();
  renderLvStatusBtn();
  renderLouvorLista();
}
function closeLouvorDetalhe(){
  if(document.getElementById('lvPdfWrap')?.classList.contains('lv-tela-cheia')) lvTelaCheia(false);
  document.getElementById('pageLouvorDetalhe').classList.remove('active');
  louvorAtualId = null;
  renderLouvor();
}
function renderLvCategoriaChips(){
  const l = getLouvorAtual(); if(!l) return;
  document.getElementById('lvCategoriaChips').innerHTML = LOUVOR_CATEGORIAS.map(c=>
    `<button type="button" class="dif-chip${l.categoria===c?' active':''}" onclick="selecionarLvCategoria('${c}')">${c}</button>`
  ).join('');
}
function selecionarLvCategoria(c){
  const l = getLouvorAtual(); if(!l) return;
  l.categoria = c;
  renderLvCategoriaChips();
  persist();
}
/* ===== Editor estilo Word =====
   O texto fica num textarea transparente; por trás, uma camada igualzinha pinta cada linha
   (acordes em laranja, [blocos] em azul, marcadores - -- --- em cinza). A caixa cresce com o texto:
   sem barras de rolagem internas, só a página rola. */
function lvAtualizarEditor(){
  const ta = document.getElementById('lvConteudo'), realce = document.getElementById('lvConteudoRealce');
  if(!ta || !realce) return;
  const olhar = typeof lvLinhasRevisar==='function' ? lvLinhasRevisar() : new Set();   // linhas que a importação não conseguiu conferir
  realce.innerHTML = ta.value.split('\n').map(linha=>{
    const t = linha.trim(), esc = lvEsc(linha) || '';
    if(t && olhar.has(t)) return `<span class="rl-olhar">${esc}</span>`;
    if(/^\[.+\]$/.test(t)) return `<span class="rl-bloco">${esc}</span>`;
    if(/^-{1,3}$/.test(t)) return `<span class="rl-marca">${esc}</span>`;
    if(t && isChordLine(t)) return `<span class="rl-acorde">${esc}</span>`;
    return esc;
  }).join('\n') + '\n';   // linha extra: a camada acompanha o cursor numa linha nova vazia
  if(!ta.offsetParent) return;   // painel escondido: mede quando voltar para a Edição
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}
window.addEventListener('resize', ()=>{ if(document.getElementById('pageLouvorDetalhe')?.classList.contains('active')) lvAtualizarEditor(); });
/* texto que acabou de chegar (importação, Cifra Club, Drive): aparece sendo escrito no editor, como num chat.
   Só na tela — l.conteudo já está inteiro e gravado; tocar no editor (ou mexer em outro campo) mostra tudo na hora. */
let lvEscrevendoParar = null;
function lvEscreverNoEditor(){
  const l = getLouvorAtual(), ta = document.getElementById('lvConteudo'), realce = document.getElementById('lvConteudoRealce');
  if(!l || !ta || !realce || !(l.conteudo || '').trim()) return;
  if(lvEscrevendoParar) lvEscrevendoParar();
  if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  switchLouvorSubtab('edicao');
  const alvo = l.conteudo, id = l.id, total = alvo.length, wrap = ta.closest('.lv-editor-wrap');
  const dur = Math.min(3200, 900 + total * 1.4), t0 = performance.now();
  let vivo = true;
  const parar = ()=>{
    if(!vivo) return; vivo = false; lvEscrevendoParar = null;
    ta.readOnly = false; wrap && wrap.classList.remove('escrevendo');
    if(louvorAtualId === id){ ta.value = (getLouvorAtual() || {}).conteudo || ''; lvAtualizarEditor(); }
    ta.removeEventListener('pointerdown', parar);
  };
  lvEscrevendoParar = parar;
  ta.readOnly = true; wrap && wrap.classList.add('escrevendo');
  ta.addEventListener('pointerdown', parar);
  const passo = ()=>{
    if(!vivo) return;
    if(louvorAtualId !== id || (getLouvorAtual() || {}).conteudo !== alvo){ parar(); return; }
    const p = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - p, 1.6);   // começa rápido e assenta no fim
    let n = Math.floor(total * e);
    const nl = alvo.indexOf('\n', n); if(p < 1 && nl > -1 && nl - n < 3) n = nl;   // não para no meio de um acorde curto
    ta.value = alvo.slice(0, n);
    lvAtualizarEditor();
    realce.innerHTML = realce.innerHTML.replace(/\n$/, '<span class="rl-cursor"></span>\n');
    if(p < 1) setTimeout(passo, 16); else parar();   // setTimeout (e não rAF): continua mesmo se a tela ficar em segundo plano
  };
  passo();
}
function salvarLouvorCampo(){
  if(lvEscrevendoParar) lvEscrevendoParar();   // ainda escrevendo: mostra o texto inteiro antes de ler os campos
  const l = getLouvorAtual(); if(!l) return;
  l.titulo = document.getElementById('lvTitulo').value;
  l.artista = document.getElementById('lvArtista').value;
  const conteudoNovo = document.getElementById('lvConteudo').value;
  if(l.medley && conteudoNovo !== l.conteudo) l.medleyEditado = true;   // mexeu à mão: o medley para de acompanhar as originais
  l.conteudo = conteudoNovo;
  lvAtualizarEditor();
  document.getElementById('louvorDetalheHeaderTitle').textContent = l.titulo || 'Sem título';
  renderLouvorLista();
  persist();
}
function salvarLouvorData(v){
  const l = getLouvorAtual(); if(!l) return;
  /* a data antiga que já passou fica no histórico de tocadas (Culto → Histórico) */
  const antiga = l.dataAgendamento, hoje = calISO(new Date());
  if(antiga && antiga !== v && antiga <= hoje){ l.tocadaEm = [...new Set([...(l.tocadaEm||[]), antiga])].sort(); }
  l.dataAgendamento = v || '';
  persist();
}
function excluirLouvorAtual(){
  const l = getLouvorAtual(); if(!l) return;
  iosConfirm(`Excluir "${l.titulo||'este louvor'}"?`).then(ok=>{
    if(!ok) return;
    state.louvores = state.louvores.filter(x=>x.id!==l.id);
    persist();
    closeLouvorDetalhe();
  });
}

/* aba Música = a folha (igual ao Visualizar), editável com um toque; o ícone de texto troca para o editor completo
   (criar/apagar linhas, mexer nos acordes, "-", "--"). Música sem letra abre direto no texto. */
/* Música = o texto inteiro num editor (como Word: [Parte] vira seção); Visualizar = a folha como vai sair no PDF (só para ver).
   Os dois usam o mesmo painel (#lvPanelEdicao), com data-modo texto/folha. */
function lvModoTexto(ligar){
  const p = document.getElementById('lvPanelEdicao'); if(!p) return;
  if(ligar === undefined) ligar = p.dataset.modo !== 'texto';
  p.dataset.modo = ligar ? 'texto' : 'folha';
  if(ligar) lvAtualizarEditor(); else renderLouvorPdfPreview();
}
function switchLouvorSubtab(tab){
  if(tab === 'pdf') tab = 'visualizar';
  try{ localStorage.setItem('siloe-lv-aba', tab); }catch(e){}
  document.querySelectorAll('.lv-subtab').forEach(el=>el.classList.toggle('active', el.dataset.tab===tab));
  document.querySelectorAll('.lv-panel').forEach(el=>el.classList.remove('active'));
  const conteudo = document.getElementById('louvorDetalheConteudo');
  if(conteudo) conteudo.scrollTop = 0;
  if(tab==='edicao' || tab==='visualizar'){
    document.getElementById('lvPanelEdicao').classList.add('active');
    lvModoTexto(tab === 'edicao');
  }
  if(tab==='slides'){
    document.getElementById('lvPanelSlides').classList.add('active');
    lvSlideIndex = 0;
    renderLouvorSlidePreview();
  }
}

/* ---------- Configurações padrão (PDF e Slides) ---------- */
function ensureLouvorConfig(l){
  if(!l.colunas) l.colunas = 2;
  if(l.pdfTamanhoTexto === undefined) l.pdfTamanhoTexto = 11;
  if(l.pdfTamanhoTitulo === undefined) l.pdfTamanhoTitulo = 17;
  if(l.pdfOrientacao === undefined) l.pdfOrientacao = 'retrato';
  if(l.pdfAlturaLinha === undefined) l.pdfAlturaLinha = 1.5;
  if(l.pdfEspacamento === undefined) l.pdfEspacamento = 0;
  if(l.pdfMargem === undefined) l.pdfMargem = 40;
  if(l.slideTituloTamanho === undefined) l.slideTituloTamanho = 44;
  if(l.slideTextoTamanho === undefined) l.slideTextoTamanho = 32;
  if(l.slideAlturaLinha === undefined) l.slideAlturaLinha = 1.4;
  if(l.slideEspacamento === undefined) l.slideEspacamento = 0;
  if(l.transpose === undefined) l.transpose = 0;
  if(l.tomOriginal === undefined){
    let base = (l.tom||'').trim();
    let isMinor = false;
    if(/m$/i.test(base) && !/maj$/i.test(base)){ isMinor = true; base = base.slice(0,-1); }
    const m = base.match(/^([A-G])(#|b)?/);
    l.tomOriginal = m ? (m[1]+(m[2]||'')) : '';
    l.tomModoMenor = isMinor;
  }
  if(l.tomModoMenor === undefined) l.tomModoMenor = false;
  if(l.status === undefined) l.status = 'producao';
  if(l.dataAgendamento === undefined) l.dataAgendamento = '';
}
/* tom maior do louvor com o nome exato escolhido (Gb continua Gb) */
function lvTomMaiorAtual(l){
  if(!l.tomOriginal) return '';
  return l.transpose ? (lvShiftNote(l.tomOriginal, l.transpose) || l.tomOriginal) : l.tomOriginal;
}
function lvTomAtual(l){
  const maior = lvTomMaiorAtual(l);
  if(!maior) return '';
  return l.tomModoMenor ? lvRelativoMenor(maior) + 'm' : maior;
}
function atualizarLvTomBox(){
  const l = getLouvorAtual(); if(!l) return;
  document.getElementById('lvTomBoxValor').textContent = lvTomAtual(l) || '—';
  renderLvHarmonicBar(l);
}
const LV_GRAUS_MAIOR = [
  { grau:'I', semitom:0, qualidade:'' },
  { grau:'II', semitom:2, qualidade:'m' },
  { grau:'III', semitom:4, qualidade:'m' },
  { grau:'IV', semitom:5, qualidade:'' },
  { grau:'V', semitom:7, qualidade:'' },
  { grau:'VI', semitom:9, qualidade:'m' },
  { grau:'VII', semitom:11, qualidade:'º' }
];
/* campo menor (relativo): começa no VI grau do maior → i iiº III iv v VI VII */
const LV_GRAUS_MENOR = [
  { grau:'I', idx:5, qualidade:'m' },
  { grau:'II', idx:6, qualidade:'º' },
  { grau:'III', idx:0, qualidade:'' },
  { grau:'IV', idx:1, qualidade:'m' },
  { grau:'V', idx:2, qualidade:'m' },
  { grau:'VI', idx:3, qualidade:'' },
  { grau:'VII', idx:4, qualidade:'' }
];
/* campo harmônico do tom escolhido, com os nomes literais do tom (e o dominante de cada grau embaixo) */
function renderLvHarmonicBar(l){
  const el = document.getElementById('lvHarmonicBar');
  if(!el) return;
  const esc = lvEscalaDoTom(lvTomMaiorAtual(l));
  if(!esc){ el.innerHTML = ''; return; }
  const graus = l.tomModoMenor ? LV_GRAUS_MENOR : LV_GRAUS_MAIOR.map((g,i)=>({ grau:g.grau, idx:i, qualidade:g.qualidade }));
  el.innerHTML = graus.map(g=>{
    const nota = esc[g.idx];
    const acorde = nota + g.qualidade;
    const li = LV_LETRAS.indexOf(nota[0]), pcDom = (lvPc(nota)+7)%12;
    const alt = (lvSoletrar(li+4, pcDom) || lvNomeNoTom(pcDom, lvTomMaiorAtual(l))) + '7';
    return `<div class="lv-grau-col">
      <div class="lv-grau-chip"><div class="lv-grau-num">${g.grau}</div><div class="lv-grau-chord">${acorde}</div></div>
      <div class="lv-grau-alt">${alt}</div>
    </div>`;
  }).join('');
}

/* ---------- Seletor de Tom (grid cromático + relativo menor no duplo toque) ---------- */
const LV_TOM_GRID = ['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B'];
let lvTomPickerModo = 'edit';
function abrirLvTomPicker(modo){
  lvTomPickerModo = modo || 'edit';
  renderLvTomGrid();
  document.getElementById('modalLvTom').classList.add('active');
}
function lvNovoTomAtual(){
  if(!window.lvNovoTomOriginal) return '';
  return window.lvNovoTomModoMenor ? lvRelativoMenor(window.lvNovoTomOriginal) + 'm' : window.lvNovoTomOriginal;
}
function atualizarLvNovoTomBox(){
  const el = document.getElementById('lvNovoTomBoxValor');
  if(el) el.textContent = lvNovoTomAtual() || 'Selecione';
}
/* marca exatamente a nota escolhida (F# e Gb são botões diferentes); no menor, mostra o relativo embaixo */
function renderLvTomGrid(){
  let maior, menor;
  if(lvTomPickerModo==='novo'){
    maior = window.lvNovoTomOriginal || ''; menor = !!window.lvNovoTomModoMenor;
  }else if(lvTomPickerModo==='medley'){
    const t = lmTomDoPicker(); maior = t.tom; menor = t.menor;
  }else{
    const l = getLouvorAtual(); if(!l) return;
    maior = lvTomMaiorAtual(l); menor = !!l.tomModoMenor;
  }
  const grid = document.getElementById('lvTomGrid');
  grid.innerHTML = LV_TOM_GRID.map(nota=>{
    const isActive = nota === maior;
    const sub = isActive && menor ? `<small>${lvRelativoMenor(nota)}m</small>` : '';
    return `<button type="button" class="lv-tom-grid-btn${isActive?' active':''}${sub?' menor':''}" data-nota="${nota}">${nota}${sub}</button>`;
  }).join('');
  lvLigarToqueTom(grid);
}
/* toque = tom maior; tocar e segurar = relativo menor (segurar D escolhe Bm) */
const LV_TOM_SEGURAR_MS = 450;
function lvLigarToqueTom(grid){
  if(grid._lvToque) return;
  grid._lvToque = true;
  let timer = null, btnAtivo = null, segurou = false;
  const limpa = ()=>{ clearTimeout(timer); timer = null; if(btnAtivo) btnAtivo.classList.remove('segurando'); btnAtivo = null; };
  grid.addEventListener('pointerdown', e=>{
    const btn = e.target.closest('.lv-tom-grid-btn'); if(!btn) return;
    limpa(); segurou = false; btnAtivo = btn;
    btn.classList.add('segurando');
    timer = setTimeout(()=>{
      segurou = true;
      if(navigator.vibrate) try{ navigator.vibrate(15); }catch(_){}
      const nota = btn.dataset.nota;
      limpa();
      lvTomGridEscolher(nota, true);
    }, LV_TOM_SEGURAR_MS);
  });
  grid.addEventListener('pointerup', e=>{
    const btn = btnAtivo;
    const tocou = timer && btn && !segurou;
    limpa();
    if(tocou) lvTomGridEscolher(btn.dataset.nota, false);
  });
  ['pointercancel','pointerleave'].forEach(ev=>grid.addEventListener(ev, limpa));
  grid.addEventListener('contextmenu', e=>e.preventDefault());   // segurar no celular não abre o menu
  grid.addEventListener('click', e=>{   // teclado (Enter/espaço): escolhe o maior
    const btn = e.target.closest('.lv-tom-grid-btn');
    if(btn && e.detail === 0) lvTomGridEscolher(btn.dataset.nota, false);
  });
}
/* reescreve as linhas de acordes: sobe/desce "delta" e usa os nomes do tom de destino */
function lvTransposeConteudoTexto(conteudo, delta, tom, tomAntes){
  if(!delta && !tom) return conteudo;
  return (conteudo||'').split('\n').map(line=>{
    const trimmed = line.trim();
    if(isChordLine(trimmed)) return lvTransposeChordLine(line, delta, tom, tomAntes);
    return line;
  }).join('\n');
}
function lvTomGridEscolher(nota, modoMenor){
  if(lvTomPickerModo==='medley'){ lmTomEscolhido(nota, modoMenor); return; }
  if(lvTomPickerModo==='novo'){
    window.lvNovoTomOriginal = nota;
    window.lvNovoTomModoMenor = modoMenor;
    atualizarLvNovoTomBox();
    closeModal('modalLvTom');
    return;
  }
  const l = getLouvorAtual(); if(!l) return;
  /* música só com o PDF do Drive: para mudar a nota o app precisa do texto → lê o PDF (como está) e passa para o tom novo */
  if(typeof driveSoArquivo === 'function' && driveSoArquivo(l) && (nota !== l.tomOriginal || !!modoMenor !== !!l.tomModoMenor)){
    closeModal('modalLvTom');
    lvConverterDoDrive({ nota, modoMenor });
    return;
  }
  ensureLouvorConfig(l);
  /* sobe/desce a cifra até o tom novo e escreve tudo com os nomes desse tom
     (mesmo de F# para Gb, que soa igual, os nomes mudam). Sem tom anterior: só ajusta os nomes. */
  const pcNota = lvPc(nota), pcAntes = lvPc(lvTomMaiorAtual(l));
  const delta = (pcAntes===-1 || pcNota===-1) ? 0 : ((pcNota - pcAntes)%12+12)%12;
  l.conteudo = lvTransposeConteudoTexto(l.conteudo, delta, nota, lvTomMaiorAtual(l));
  /* medley: cada música sobe/desce junto, para continuar igual quando o medley se atualizar */
  if(l.medley){
    l.medley.musicas.forEach((m, i)=>{ if(m.tom && delta) m.tom = lvShiftNote(m.tom, delta) || m.tom; });
    const primeira = l.medley.musicas.find(m=>l.medley.seq.some(s=>s.id===m.id));
    if(primeira){ primeira.tom = nota; primeira.menor = modoMenor; }
    if(!l.medleyEditado) l.conteudo = lmGerarTexto(l.medley);
  }
  const conteudoEl = document.getElementById('lvConteudo');
  if(conteudoEl){ conteudoEl.value = l.conteudo; lvAtualizarEditor(); }
  l.tomOriginal = nota;
  l.transpose = 0;
  l.tomModoMenor = modoMenor;
  persist();
  atualizarLvTomBox();
  renderLouvorPdfPreview();
  closeModal('modalLvTom');
  if(typeof driveTomMudou === 'function') driveTomMudou(l);   // já estava no Drive: troca o arquivo pelo do tom novo
}
/* muda o tom de uma música sem abrir a tela (roteiro colado do WhatsApp): sobe/desce a cifra e escreve no tom novo */
function lvAplicarTom(l, nota, modoMenor){
  if(!l || !nota || l.medley) return;
  ensureLouvorConfig(l);
  const pcNota = lvPc(nota), pcAntes = lvPc(lvTomMaiorAtual(l));
  const delta = (pcAntes===-1 || pcNota===-1) ? 0 : ((pcNota - pcAntes)%12+12)%12;
  if(l.conteudo) l.conteudo = lvTransposeConteudoTexto(l.conteudo, delta, nota, lvTomMaiorAtual(l));
  l.tomOriginal = nota;
  l.transpose = 0;
  l.tomModoMenor = !!modoMenor;
}

/* ---------- Motor de cifras: detecção automática, seções e marcadores ----------
   Sintaxe do texto bruto:
   [Nome da Seção]  -> cabeçalho de seção (Refrão, Primeira Parte...)
   Linha só com acordes (ex: "E   A9   B") -> detectada automaticamente, fica laranja no PDF
   -    (um traço sozinho)  -> quebra para o próximo slide (continua a mesma seção)
   --   (dois traços)       -> linha divisória no PDF
   ---  (três traços)       -> força quebra de coluna no PDF
------------------------------------------------------------------------------ */
const LV_CHORD_SUFFIXES = ['maj7','majsus4','madd9','madd11','msus2','msus4','mdim7','m7b5','m7M','maj9','maj','min','dim7','dim','aug','sus2','sus4','sus','add9','add11','add2',
  'm7','m9','m6','m11','m13','m4','7M','9M','2','4','5','6','7','9','11','13','m','M','º7','°7','º','°'];
const LV_CHORD_SUFFIX_RE = LV_CHORD_SUFFIXES.sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
/* aceita também extensões entre parênteses, ex.: E(9), A7(4) */
const LV_CHORD_RE = new RegExp(`^[A-G](##|bb|#|b)?(${LV_CHORD_SUFFIX_RE})?(\\([^)]*\\))?(\\/[A-G](##|bb|#|b)?)?$`);
function isChordLine(line){
  const trimmed = line.trim();
  if(!trimmed) return false;
  /* "( Bb  D7 )" (acordes de passagem entre parênteses, como no Cifra Club) também é linha de acordes */
  const tokens = trimmed.split(/\s+/).filter(t=>t && !/^[()]+$/.test(t));
  const acorde = t=>[t, t.replace(/^\(+/, ''), t.replace(/\)+$/, ''), t.replace(/^\(+|\)+$/g, '')].some(x=>x && LV_CHORD_RE.test(x));   // "D9(11)" e "(Bb"
  return tokens.length > 0 && tokens.every(acorde);
}
const LV_CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const LV_FLAT = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

/* ---------- Nomes das notas pelo campo harmônico ----------
   Cada tom tem seus próprios nomes: F# = F# G# A# B C# D# E#, Gb = Gb Ab Bb Cb Db Eb F.
   Mesmo som, nomes diferentes: a cifra e o campo mostram literalmente os nomes do tom escolhido. */
const LV_LETRAS = ['C','D','E','F','G','A','B'];
const LV_LETRA_PC = [0,2,4,5,7,9,11];
const LV_ESCALA_MAIOR = [0,2,4,5,7,9,11];
/* nota → altura (0..11); aceita #, b, ## e bb */
function lvPc(nota){
  const m = /^([A-G])(##|bb|#|b)?$/.exec(nota||'');
  if(!m) return -1;
  const acc = ({ '#':1, '##':2, 'b':-1, 'bb':-2 })[m[2]] || 0;
  return ((LV_LETRA_PC[LV_LETRAS.indexOf(m[1])] + acc) % 12 + 12) % 12;
}
/* escreve a altura usando uma letra fixa (ex.: letra E + altura de F = E#) */
function lvSoletrar(letraIdx, pc){
  letraIdx = ((letraIdx % 7) + 7) % 7;
  let d = ((pc - LV_LETRA_PC[letraIdx]) % 12 + 12) % 12;
  if(d > 6) d -= 12;
  const acc = ({ '0':'', '1':'#', '2':'##', '-1':'b', '-2':'bb' })[d];
  return acc === undefined ? null : LV_LETRAS[letraIdx] + acc;
}
/* as 7 notas da escala maior do tom, com os nomes certos */
function lvEscalaDoTom(tom){
  const m = /^([A-G])/.exec(tom||''), pc = lvPc(tom);
  if(!m || pc < 0) return null;
  const li = LV_LETRAS.indexOf(m[1]);
  return LV_ESCALA_MAIOR.map((s,i)=>lvSoletrar(li+i, (pc+s) % 12));
}
/* notas fora da escala: bemol nos tons com bemol (e em F), sustenido nos outros */
function lvTomUsaBemol(tom){ return /b/.test(tom||'') || tom === 'F'; }
function lvNomeNoTom(pc, tom){
  const esc = lvEscalaDoTom(tom);
  if(esc){ const n = esc.find(x=>lvPc(x) === pc); if(n) return n; }
  return (lvTomUsaBemol(tom) ? LV_FLAT : LV_CHROMATIC)[pc];
}
/* relativo menor de um tom maior (D → B) e relativo maior de um tom menor (B → D), com os nomes certos */
function lvRelativoMenor(tomMaior){ const esc = lvEscalaDoTom(tomMaior); return esc ? esc[5] : tomMaior; }
function lvRelativoMaior(raizMenor){
  const m = /^([A-G])/.exec(raizMenor||''), pc = lvPc(raizMenor);
  if(!m || pc < 0) return raizMenor;
  return lvSoletrar(LV_LETRAS.indexOf(m[1]) + 2, (pc + 3) % 12) || LV_CHROMATIC[(pc + 3) % 12];
}

function lvShiftNote(note, delta){
  const idx = lvPc(note);
  if(idx===-1) return null;
  return LV_CHROMATIC[((idx+delta)%12+12)%12];
}
/* nome de uma nota da cifra no tom novo:
   do campo → nome da escala (Gb: Cb, não B); fora do campo → mantém a função que tinha no tom antigo (bVI de E = C → bVI de D = Bb) */
function lvNomeTransposto(nota, delta, tom, tomAntes){
  const pc = lvPc(nota); if(pc < 0) return null;
  const npc = ((pc+(delta||0))%12+12)%12;
  if(!tom) return LV_CHROMATIC[npc];
  const esc = lvEscalaDoTom(tom);
  const doCampo = esc && esc.find(x=>lvPc(x) === npc);
  if(doCampo) return doCampo;
  if(lvPc(tomAntes) >= 0 && esc){
    const off = LV_LETRAS.indexOf(nota[0]) - LV_LETRAS.indexOf(tomAntes[0]);
    const s = lvSoletrar(LV_LETRAS.indexOf(tom[0]) + off, npc);
    if(s && !/##|bb/.test(s)) return s;
  }
  return lvNomeNoTom(npc, tom);
}
/* sobe/desce o acorde "delta" semitons. Com "tom", escreve com os nomes daquele tom (Gb → Cb, não B) */
function lvTransposeChord(chord, delta, tom, tomAntes){
  if(!chord || (!delta && !tom)) return chord;
  const nomeNovo = nota => lvNomeTransposto(nota, delta, tom, tomAntes);
  const m = chord.match(/^([A-G])(##|bb|#|b)?/);
  if(!m) return chord;
  const rootFull = m[1] + (m[2]||'');
  let rest = chord.slice(rootFull.length);
  const newRoot = nomeNovo(rootFull);
  if(!newRoot) return chord;
  const slashIdx = rest.indexOf('/');
  if(slashIdx !== -1){
    const bassPart = rest.slice(slashIdx+1);
    const bm = bassPart.match(/^([A-G])(##|bb|#|b)?/);
    if(bm){
      const bassFull = bm[1] + (bm[2]||'');
      const newBass = nomeNovo(bassFull) || bassFull;
      const bassRest = bassPart.slice(bassFull.length);
      return newRoot + rest.slice(0,slashIdx) + '/' + newBass + bassRest;
    }
  }
  return newRoot + rest;
}
/* mantém cada acorde na mesma coluna (em cima da mesma sílaba) mesmo quando o nome muda de tamanho */
function lvTransposeChordLine(line, delta, tom, tomAntes){
  if(!delta && !tom) return line;
  let out = '';
  const re = /\S+/g; let m;
  while((m = re.exec(line))){
    const novo = lvTransposeChord(m[0], delta, tom, tomAntes);
    const pos = Math.max(m.index, out.length ? out.length+1 : 0);
    while(out.length < pos) out += ' ';
    out += novo;
  }
  return out;
}

/* Faz uma única passada pelo texto bruto e devolve:
   items -> sequência pra montar o PDF (seções, pares cifra+letra, divisores, quebras de coluna, espaços em branco)
   slides -> lista de slides (cada um só com as linhas de letra, sem cifra), quebrados por seção e por "-" */
/* Slides do tamanho certo: numa parte com mais de LV_SLIDE_MAX linhas de letra, entra "-" (próximo slide)
   dividindo por igual (6 → 3+3, 9 → 3+3+3). Os "-", "--" e "---" que já existem continuam e contam como divisão.
   Usado ao importar e ao organizar. */
const LV_SLIDE_MAX = 4, LV_SLIDE_CURTA = 28;
/* regra do Davi: até 4 linhas = 1 slide; 5 linhas curtas (até LV_SLIDE_CURTA letras cada) = 1 slide, 5 compridas = 3 + 2;
   6 ou mais = divide por igual (6 → 3+3, 7 → 4+3, 8 → 4+4, 9 → 3+3+3). Devolve quantas linhas vão em cada slide */
function lvDivisaoSlides(linhas){
  const n = linhas.length;
  if(n <= LV_SLIDE_MAX) return [n];
  if(n === 5) return linhas.every(t=>String(t).trim().length <= LV_SLIDE_CURTA) ? [5] : [3, 2];
  const k = Math.ceil(n / LV_SLIDE_MAX), base = Math.floor(n / k), resto = n % k;
  return Array.from({ length:k }, (_, i)=>base + (i < resto ? 1 : 0));
}
function lvQuebrarSlides(texto){
  const linhas = String(texto||'').split('\n'), out = [];
  let seg = [];
  const fecha = ()=>{
    const letra = seg.map((l, i)=>({ l, i })).filter(x=>x.l.trim() && !isChordLine(x.l.trim()));
    const tam = lvDivisaoSlides(letra.map(x=>x.l));
    if(tam.length > 1){
      const cortes = new Set();
      for(let k = tam[0], s = 1; s < tam.length; k += tam[s], s++){
        let pos = letra[k].i;
        if(pos > 0 && seg[pos-1].trim() && isChordLine(seg[pos-1].trim())) pos--;   // o acorde vai junto com a letra
        cortes.add(pos);
      }
      seg.forEach((l, i)=>{ if(cortes.has(i)) out.push('-'); out.push(l); });
    } else out.push(...seg);
    seg = [];
  };
  linhas.forEach(l=>{
    const t = l.trim();
    if(/^\[.+\]$/.test(t) || t === '-' || t === '--' || t === '---'){ fecha(); out.push(l); }
    else seg.push(l);
  });
  fecha();
  return out.join('\n');
}
/* Parte cantada mais de uma vez seguida: "[Primeira Parte | 2x]", "[Repete - Refrão | 3x]".
   Também entende o jeito antigo ("Refrão 2x", "Refrão (2x)", "Refrão x2") */
function lvVezesDoRotulo(rotulo){
  const t = String(rotulo||'').trim();
  const m = /^(.*?)\s*\|?\s*[(\[]?\s*(?:(\d+)\s*[xX×]|[xX×]\s*(\d+))\s*[)\]]?$/.exec(t);
  if(m && m[1].trim()) return { nome: m[1].replace(/\s*[|\-–:]\s*$/,'').trim(), vezes: Math.max(1, Number(m[2]||m[3])||1) };
  return { nome: t, vezes: 1 };
}
function lvRotuloComVezes(nome, vezes){ return nome + (vezes > 1 ? ' | ' + vezes + 'x' : ''); }
/* deixa o texto no padrão: "[Nome | 2x]", "[Repete - Nome | 2x]"; e o "Repete" logo depois da mesma parte
   vira vezes dela ("[Refrão]…[Repete - Refrão]" → "[Refrão | 2x]") */
function lvNormalizarVezes(texto){
  const linhas = String(texto||'').split('\n'), out = [];
  const ehSep = t=>!t || t==='-' || t==='--' || t==='---';
  let ultimo = null;   // última parte com letra: { idx no out, nome, vezes }
  for(let i = 0; i < linhas.length; i++){
    const t = linhas[i].trim();
    const m = /^\[(.+)\]$/.exec(t);
    if(!m || /^♪/.test(m[1])){ if(m) ultimo = null; out.push(linhas[i]); continue; }
    const { nome, vezes } = lvVezesDoRotulo(m[1]);
    const rep = /^repete\b\s*[-–:]?\s*(.*)$/i.exec(nome);
    if(rep){
      const alvo = rep[1].trim();
      let j = i + 1; while(j < linhas.length && ehSep(linhas[j].trim())) j++;
      const semLetra = j >= linhas.length || /^\[.+\]$/.test(linhas[j].trim());
      if(semLetra && ultimo && ultimo.nome.toLowerCase() === alvo.toLowerCase()){
        while(out.length > ultimo.idx + 1 && ehSep(out[out.length-1].trim())) out.pop();
        ultimo.vezes += vezes;
        out[ultimo.idx] = '[' + lvRotuloComVezes(ultimo.nome, ultimo.vezes) + ']';
        continue;
      }
      out.push('[' + lvRotuloComVezes('Repete - ' + alvo, vezes) + ']');
      ultimo = null;
      continue;
    }
    out.push('[' + lvRotuloComVezes(nome, vezes) + ']');
    ultimo = { idx: out.length - 1, nome, vezes };
  }
  return out.join('\n');
}
function lvParseContent(conteudo){
  const rawLines = (conteudo||'').split('\n');
  const items = [];
  let pendingChord = null;   // { text, idx } — idx = número da linha no texto (para editar direto na folha)
  let currentLabel = '';
  const slides = [];
  let currentSlideLines = null;

  function flushPendingChord(){
    if(pendingChord !== null){
      items.push({ type:'pair', chordLine: pendingChord.text, chordIdx: pendingChord.idx, lyricLine: '', lyricIdx: null });
      pendingChord = null;
    }
  }
  function startNewSlide(){
    currentSlideLines = [];
    slides.push({ label: currentLabel, lines: currentSlideLines });
  }

  rawLines.forEach((raw, i)=>{
    const trimmed = raw.trim();
    if(trimmed === '---'){ flushPendingChord(); items.push({type:'colbreak'}); return; }
    if(trimmed === '--'){ flushPendingChord(); items.push({type:'divider'}); return; }
    if(trimmed === '-'){ flushPendingChord(); items.push({type:'slidebreak'}); startNewSlide(); return; }   // a folha ignora; o Organizar usa para manter o "-"
    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if(sectionMatch){
      flushPendingChord();
      currentLabel = sectionMatch[1];
      items.push({ type:'section', label: currentLabel, idx: i });
      startNewSlide();
      return;
    }
    if(trimmed === ''){
      flushPendingChord();
      items.push({ type:'blank' });
      return;
    }
    if(isChordLine(trimmed)){
      flushPendingChord();
      pendingChord = { text: raw, idx: i };
      return;
    }
    items.push({ type:'pair', chordLine: pendingChord ? pendingChord.text : '', chordIdx: pendingChord ? pendingChord.idx : null, lyricLine: raw, lyricIdx: i });
    pendingChord = null;
    if(currentSlideLines === null) startNewSlide();
    currentSlideLines.push(raw);
  });
  flushPendingChord();

  /* "[Repete - Refrão]" sem letra: nos slides, repete a letra do bloco original */
  const expandidos = [];
  let originais = [];
  const semVezes = t=>lvVezesDoRotulo(t).nome.toLowerCase();   // "Refrão | 2x" = "Refrão"
  slides.forEach(s=>{
    if(/^♪/.test(s.label||'')){ originais = []; return; }   // medley: começou outra música, o "Repete" vale só dentro dela
    const { nome, vezes } = lvVezesDoRotulo(s.label);
    s.vezes = vezes;   // "2x" no canto do slide
    const rep = /^repete\b\s*[-–:]?\s*(.*)$/i.exec(nome);
    if(rep && !s.lines.length){
      const alvo = semVezes(rep[1]);
      expandidos.push(...originais.filter(o=>semVezes(o.label)===alvo).map(o=>({ label:o.label, lines:o.lines.slice(), vezes })));
      return;
    }
    originais.push(s);
    expandidos.push(s);
  });
  /* parte grande sem "-" (escrita à mão ou importada antes): divide na hora pela mesma regra (lvDivisaoSlides) */
  const prontos = expandidos.filter(s=>s.lines.length>0).flatMap(s=>{
    const tam = lvDivisaoSlides(s.lines);
    if(tam.length === 1) return [s];
    let ini = 0;
    return tam.map(t=>{ const p = { ...s, lines: s.lines.slice(ini, ini + t) }; ini += t; return p; });
  });
  return { items, slides: prontos };
}

/* ---------- PDF ---------- */
function setLouvorColunas(n){
  const l = getLouvorAtual(); if(!l) return;
  l.colunas = n;   // 1, 2 ou 'auto'
  persist();
  renderLouvorPdfPreview();
}
function setLvPdfFonte(v){
  const l = getLouvorAtual(); if(!l) return;
  l.pdfFonte = v;   // 'mono' | 'sans'
  persist();
  renderLouvorPdfPreview();
}
/* colunas que valem de fato (no automático, decide na hora de desenhar a folha) */
const lvColsAuto = {};
function lvColunasEfetivas(l){ return l.colunas==='auto' ? (lvColsAuto[l.id] || 2) : (Number(l.colunas)||2); }
function lvEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
/* linha de acordes (texto) → lista de acordes com a posição (coluna) de cada um */
function lvAcordesDaLinha(chordLine){
  const out = [], re = /\S+/g; let m;
  while((m = re.exec(chordLine||''))) out.push({ name: m[0], idx: m.index });
  return out;
}
/* um par acorde+letra vira trechos: cada acorde fica em cima do pedaço da letra onde ele começa */
function lvPairHtml(it, delta, olhar){
  const acordes = lvAcordesDaLinha(it.chordLine).map(c=>({ name: lvTransposeChord(c.name, delta), idx: c.idx }));
  const letra = it.lyricLine || '';
  const seg = (c, t, pad)=>`<span class="lv-seg"><span class="lv-c">${lvEsc(c)}</span><span class="lv-t${pad?' pad':''}">${lvEsc(t)}</span></span>`;
  let html = '';
  if(!letra.trim()){
    html = acordes.map(c=>seg(c.name, '   ', true)).join('');
  } else if(!acordes.length){
    html = seg('', letra);
  } else {
    const cs = acordes.map(c=>({ name:c.name, idx: Math.min(c.idx, letra.length) }));
    if(cs[0].idx > 0) html += seg('', letra.slice(0, cs[0].idx));
    cs.forEach((c, i)=>{ html += seg(c.name, letra.slice(c.idx, i+1<cs.length ? cs[i+1].idx : letra.length)); });
  }
  const conferir = olhar && letra.trim() && olhar.has(letra.trim()) ? ' olhar' : '';   // linha para conferir (amarelo, só na tela)
  return `<div class="lv-linha${acordes.length?'':' sem-acorde'}${conferir}" data-ci="${it.chordIdx??''}" data-li="${it.lyricIdx??''}">${html}</div>`;
}
function setLvPdfOrientacao(v){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.pdfOrientacao = v;
  persist();
  renderLouvorPdfPreview();
}
function ajustarLvPdfTamanhoTexto(delta){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.pdfTamanhoTexto = Math.max(8, Math.min(16, l.pdfTamanhoTexto + delta));
  persist();
  renderLouvorPdfPreview();
}
function ajustarLvPdfTamanhoTitulo(delta){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.pdfTamanhoTitulo = Math.max(12, Math.min(26, l.pdfTamanhoTitulo + delta));
  persist();
  renderLouvorPdfPreview();
}
function ajustarLvPdfAlturaLinha(delta){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.pdfAlturaLinha = Math.round(Math.max(1.0, Math.min(2.2, l.pdfAlturaLinha + delta))*10)/10;
  persist();
  renderLouvorPdfPreview();
}
function ajustarLvPdfEspacamento(delta){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.pdfEspacamento = Math.round(Math.max(0, Math.min(3, l.pdfEspacamento + delta))*10)/10;
  persist();
  renderLouvorPdfPreview();
}
function ajustarLvPdfMargem(delta){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.pdfMargem = Math.max(20, Math.min(72, l.pdfMargem + delta));
  persist();
  renderLouvorPdfPreview();
}
function renderLouvorPdfPreview(){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  document.getElementById('lvColuna1').classList.toggle('active', l.colunas===1);
  document.getElementById('lvColuna2').classList.toggle('active', l.colunas===2);
  document.getElementById('lvOrientRetrato').classList.toggle('active', l.pdfOrientacao==='retrato');
  document.getElementById('lvOrientPaisagem').classList.toggle('active', l.pdfOrientacao==='paisagem');
  document.getElementById('lvPdfTextoLabel').textContent = l.pdfTamanhoTexto+'pt';
  document.getElementById('lvPdfTituloLabel').textContent = l.pdfTamanhoTitulo+'pt';
  document.getElementById('lvPdfAlturaLinhaLabel').textContent = l.pdfAlturaLinha.toFixed(1);
  document.getElementById('lvPdfEspacamentoLabel').textContent = l.pdfEspacamento.toFixed(1);
  document.getElementById('lvPdfMargemLabel').textContent = l.pdfMargem+'pt';

  ['auto',1,2].forEach(n=>document.getElementById('lvColuna'+(n==='auto'?'Auto':n))?.classList.toggle('active', l.colunas===n));
  document.getElementById('lvFonteMono')?.classList.toggle('active', (l.pdfFonte||'mono')==='mono');
  document.getElementById('lvFonteSans')?.classList.toggle('active', l.pdfFonte==='sans');

  const delta = l.transpose || 0;
  const olhar = new Set((l.revisar || []).map(t=>t.trim()));
  const { items } = lvParseContent(l.conteudo);
  let bodyHtml = '', nSecoes = 0, aberta = false, blocoHtml = '', blocoLinhas = 0;
  /* cada bloco (pílula + linhas) fica junto e separado do próximo por uma linha fina;
     bloco muito comprido (ex.: música sem seções) pode quebrar entre colunas */
  const fecha = ()=>{ if(aberta){ bodyHtml += `<div class="lv-bloco${blocoLinhas>14?' longo':''}">${blocoHtml}</div>`; aberta = false; blocoHtml = ''; blocoLinhas = 0; } };
  const abre = ()=>{ if(!aberta){ aberta = true; blocoHtml = ''; blocoLinhas = 0; } };
  items.forEach(it=>{
    if(it.type==='section'){
      const musica = /^♪\s*(.+?)(?:\s+—\s+Tom\s+(\S+))?$/.exec(it.label);   // medley: começo de cada música
      /* a primeira parte de cada música fica no mesmo bloco do nome dela (não se separam entre colunas) */
      if(musica || !(aberta && /^<div class="lv-sheet-musica"/.test(blocoHtml) && !/lv-sheet-section/.test(blocoHtml))) fecha();
      abre(); nSecoes++;
      if(musica){ blocoHtml += `<div class="lv-sheet-musica" data-si="${it.idx}"><b>${lvEsc(musica[1])}</b>${musica[2]?`<span>Tom ${lvEsc(musica[2])}</span>`:''}</div>`; return; }
      const rep = /^repete\b/i.test(it.label);
      blocoHtml += `<div class="lv-sheet-section-wrap${rep?' rep':''}"><span class="lv-sheet-section" data-si="${it.idx}">${lvEsc(it.label)}</span></div>`;
    }else if(it.type==='divider'){
      abre(); blocoHtml += `<div class="lv-sheet-divider"></div>`;
    }else if(it.type==='slidebreak'){
      if(aberta) blocoHtml += `<div class="lv-sheet-slide"></div>`;   // "-": próximo slide; na folha, um respiro com uma linha curta à esquerda
    }else if(it.type==='colbreak'){
      fecha(); bodyHtml += `<div class="lv-colbreak"></div>`;
    }else if(it.type==='blank'){
      if(aberta) blocoHtml += `<div class="lv-sheet-blank"></div>`;
    }else if(it.type==='pair'){
      abre(); blocoHtml += lvPairHtml(it, delta, olhar); blocoLinhas++;
    }
  });
  fecha();
  const tomAtual = lvTomAtual(l);
  const previewEl = document.getElementById('lvPdfPreview');
  const paisagem = l.pdfOrientacao==='paisagem';
  previewEl.style.zoom = 1;   // mede no tamanho real; o zoom de tela é aplicado no fim
  previewEl.classList.toggle('paisagem', paisagem);
  previewEl.classList.toggle('sans', l.pdfFonte==='sans');
  /* cifra antiga, sem nenhum "--": mantém a linha automática embaixo de cada bloco, como era antes */
  previewEl.classList.toggle('linhas-auto', !/^[ \t]*--[ \t]*$/m.test(l.conteudo||''));
  previewEl.classList.toggle('editando', !!window.lvEditandoFolha);
  previewEl.style.padding = l.pdfMargem+'pt';
  previewEl.style.setProperty('--lv-fs', l.pdfTamanhoTexto+'pt');
  previewEl.style.setProperty('--lv-lh', l.pdfAlturaLinha);
  previewEl.style.setProperty('--lv-ls', l.pdfEspacamento+'px');
  previewEl.innerHTML = `
    <div class="lv-sheet-header">
      <div class="lv-sheet-header-text">
        <div class="lv-sheet-title" data-campo="titulo" style="font-size:${l.pdfTamanhoTitulo+8}pt">${lvEsc(l.titulo||'Sem título')}</div>
        <div class="lv-sheet-artist" data-campo="artista">${lvEsc(l.artista||'')}</div>
      </div>
      ${tomAtual?`<div class="lv-sheet-tom-box"><span>TOM</span><b>${tomAtual}</b></div>`:''}
    </div>
    <div class="lv-sheet-cols">${bodyHtml || '<p class="empty-hint">Sem conteúdo ainda.</p>'}</div>
  `;
  if(typeof lvAplicarEdicaoFolha==='function') lvAplicarEdicaoFolha();

  /* colunas e tamanho: reduz a letra só o necessário para a linha mais larga caber na coluna */
  const cols = previewEl.querySelector('.lv-sheet-cols');
  const largura = cols.clientWidth;
  let maxW = 0;
  cols.querySelectorAll('.lv-linha').forEach(li=>{ let w = 0; li.childNodes.forEach(c=>{ w += c.getBoundingClientRect().width; }); if(w > maxW) maxW = w; });
  const gap = 30;
  const fsPara = n => { const colW = (largura - gap*(n-1))/n; return maxW > colW ? Math.max(6, l.pdfTamanhoTexto * colW / maxW * 0.98) : l.pdfTamanhoTexto; };
  let n;
  if(l.colunas==='auto'){ n = (nSecoes >= 3 && fsPara(2) >= l.pdfTamanhoTexto*0.8) ? 2 : 1; lvColsAuto[l.id] = n; }
  else n = Number(l.colunas)||2;
  cols.style.columnCount = n;
  previewEl.style.setProperty('--lv-fs', fsPara(n).toFixed(2)+'pt');
  lvCaberNumaPagina(previewEl, fsPara(n), paisagem);
  lvAjustarZoomFolha();
}
/* Prioridade: tudo numa folha A4. Se passou um pouco, a letra encolhe aos poucos até caber; se precisaria
   ficar pequena demais (abaixo de 9pt ou de 78% do tamanho escolhido), volta ao tamanho normal e segue na 2ª página. */
function lvCaberNumaPagina(el, fsBase, paisagem){
  const alturaPagina = (paisagem ? 210 : 297) * 96 / 25.4 - 2;   // A4 em px (o PDF sai pela impressão desta folha)
  if(el.offsetHeight <= alturaPagina) return;
  const minimo = Math.max(9, fsBase * 0.78);
  let fs = fsBase;
  while(fs > minimo){
    fs = Math.max(minimo, fs * 0.96);
    el.style.setProperty('--lv-fs', fs.toFixed(2)+'pt');
    if(el.offsetHeight <= alturaPagina) return;
    if(fs <= minimo) break;
  }
  el.style.setProperty('--lv-fs', fsBase.toFixed(2)+'pt');   // não coube nem pequeno: 2 páginas no tamanho normal
}
/* a folha tem o tamanho real do A4; em tela pequena ela só é mostrada menor (zoom), sem mudar o desenho */
function lvAjustarZoomFolha(){
  const el = document.getElementById('lvPdfPreview');
  if(!el || !el.parentElement) return;
  el.style.zoom = 1;
  const pai = el.parentElement, cs = getComputedStyle(pai);
  const disp = pai.clientWidth - (parseFloat(cs.paddingLeft)||0) - (parseFloat(cs.paddingRight)||0);
  const w = el.offsetWidth;
  if(!w || !disp) return;
  if(pai.classList.contains('lv-tela-cheia')) el.style.zoom = Math.min(disp / w, 2).toFixed(3);   // tela cheia: ocupa a largura (até 2x)
  else if(w > disp) el.style.zoom = (disp / w).toFixed(3);
}
/* Tela cheia da folha: ocupa a tela toda (e usa a tela cheia do navegador quando ele deixa) */
function lvTelaCheia(ligar){
  const wrap = document.getElementById('lvPdfWrap');
  if(!wrap) return;
  wrap.classList.toggle('lv-tela-cheia', !!ligar);
  if(ligar && window.lvEditandoFolha){ window.lvEditandoFolha = false; renderLouvorPdfPreview(); }   // tela cheia = só ler (a folha não é mais editável: editar é na aba Música)
  document.body.style.overflow = ligar ? 'hidden' : '';
  try{
    if(ligar && wrap.requestFullscreen && !document.fullscreenElement) wrap.requestFullscreen().catch(()=>{});
    if(!ligar && document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  }catch(e){}
  if(ligar) wrap.scrollTop = 0;
  if(!ligar) lvRolarAlternar(false);
  else lvRolarMostrarVel();
  lvAjustarZoomFolha();
}
/* Rolagem automática na tela cheia: velocidade 1–10 (guardada em cada louvor); toque em ▶/⏸ liga e desliga */
let lvRolarTimer = null, lvRolarResto = 0, lvRolarUltimo = 0;
function lvRolarVelAtual(){ const l = getLouvorAtual(); return Math.min(10, Math.max(1, Number(l && l.rolagemVel) || 3)); }
function lvRolarMostrarVel(){ const e = document.getElementById('lvRolarVel'); if(e) e.textContent = lvRolarVelAtual(); }
function lvRolarVel(d){
  const l = getLouvorAtual(); if(!l) return;
  l.rolagemVel = Math.min(10, Math.max(1, lvRolarVelAtual() + d));
  lvRolarMostrarVel();
  persist();
}
function lvRolarAlternar(ligar){
  const wrap = document.getElementById('lvPdfWrap'), play = document.getElementById('lvRolarPlay');
  if(ligar === undefined) ligar = !lvRolarTimer;
  if(lvRolarTimer){ cancelAnimationFrame(lvRolarTimer); lvRolarTimer = null; }
  if(play){
    play.classList.toggle('ligado', !!ligar);
    play.innerHTML = ligar ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  }
  if(!ligar || !wrap) return;
  lvRolarResto = 0; lvRolarUltimo = 0;
  const passo = t=>{
    if(!wrap.classList.contains('lv-tela-cheia')){ lvRolarAlternar(false); return; }
    const dt = lvRolarUltimo ? Math.min(100, t - lvRolarUltimo) : 0; lvRolarUltimo = t;
    lvRolarResto += dt * lvRolarVelAtual() * 0.006;   // vel 3 ≈ 18 px/s
    const px = Math.floor(lvRolarResto);
    if(px >= 1){ lvRolarResto -= px; wrap.scrollTop += px; }
    if(wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 1){ lvRolarAlternar(false); return; }   // chegou no fim
    lvRolarTimer = requestAnimationFrame(passo);
  };
  lvRolarTimer = requestAnimationFrame(passo);
}
/* saiu da tela cheia do navegador (Esc, gesto de voltar): sai do modo também */
document.addEventListener('fullscreenchange', ()=>{
  if(!document.fullscreenElement && document.getElementById('lvPdfWrap')?.classList.contains('lv-tela-cheia')) lvTelaCheia(false);
});
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape' && document.getElementById('lvPdfWrap')?.classList.contains('lv-tela-cheia')) lvTelaCheia(false);
});
/* a folha se ajusta à largura sempre que o espaço muda (abrir a música, girar o celular, trocar de modo) */
if(window.ResizeObserver){ const _w = document.getElementById('lvPdfWrap'); let _larg = 0; if(_w) new ResizeObserver(()=>{ if(_w.clientWidth && _w.clientWidth !== _larg){ _larg = _w.clientWidth; lvAjustarZoomFolha(); } }).observe(_w); }   // só quando a largura muda
window.addEventListener('resize', ()=>{ if(document.getElementById('lvPanelEdicao')?.classList.contains('active')) lvAjustarZoomFolha(); });
/* fonte da letra no PDF (fonts/Inconsolata, licença OFL): carregada uma vez (ao abrir uma música ou o Culto) e guardada em base64 */
let lvPdfFonte = null, lvPdfFontePedido = null;
function lvPdfCarregarFonte(){
  if(lvPdfFonte) return Promise.resolve(lvPdfFonte);
  if(lvPdfFontePedido) return lvPdfFontePedido;
  const b64 = async f=>{
    const u = new Uint8Array(await (await fetch('fonts/' + f)).arrayBuffer());
    let s = ''; for(let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  };
  lvPdfFontePedido = Promise.all([b64('Inconsolata-Regular.ttf'), b64('Inconsolata-Bold.ttf')])
    .then(([r, b])=>(lvPdfFonte = { r, b })).catch(()=>{ lvPdfFontePedido = null; return null; });
  return lvPdfFontePedido;
}
async function exportarLouvorPdf(){
  const l = getLouvorAtual(); if(!l) return;
  await lvPdfCarregarFonte();
  const r = lvMontarPdf(l);
  if(r) r.doc.save(r.nome);
}
/* monta o PDF (jsPDF) de um louvor qualquer → { doc, nome } (também usado no envio ao Drive) */
function lvMontarPdf(l){
  ensureLouvorConfig(l);
  if(typeof window.jspdf === 'undefined'){
    showToast('Não foi possível carregar o gerador de PDF.');
    return null;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4', orientation: l.pdfOrientacao==='paisagem' ? 'landscape' : 'portrait' });
  /* as letras do PDF (Helvetica/Courier) não têm "♪" e outros símbolos: um só desses estraga a linha inteira
     ("&j S A L M O S" no medley). Tira o que a letra não tem antes de escrever */
  const seguro = t=>Array.isArray(t) ? t.map(seguro) : String(t ?? '').replace(/♪\s*/g, '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^\x00-\xFF—–•…]/g, '');
  const escrever = doc.text.bind(doc), medir = doc.getTextWidth.bind(doc);
  doc.text = (t, ...resto)=>escrever(seguro(t), ...resto);
  doc.getTextWidth = t=>medir(seguro(t));
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = l.pdfMargem;
  const orange = [240,122,20];
  const delta = l.transpose || 0;
  const tomAtual = lvTomAtual(l);

  doc.setTextColor(20,20,22);
  doc.setFont('helvetica','bold');
  doc.setFontSize(l.pdfTamanhoTitulo+2);
  doc.text(l.titulo||'Sem título', marginX, 34);
  doc.setFont('helvetica','normal');
  doc.setFontSize(11);
  doc.setTextColor(140,140,144);
  doc.text(l.artista||'', marginX, 52);

  if(tomAtual){
    const boxW = 66, boxH = 46, boxX = pageW - marginX - boxW, boxY = 16;
    doc.setDrawColor(222,222,226);
    doc.setLineWidth(1);
    doc.roundedRect(boxX, boxY, boxW, boxH, 8, 8, 'S');
    doc.setFont('helvetica','bold');
    doc.setFontSize(7.5);
    doc.setTextColor(150,150,154);
    doc.text('TOM', boxX+boxW/2, boxY+16, { align:'center' });
    doc.setFontSize(17);
    doc.setTextColor(30,30,32);
    doc.text(tomAtual, boxX+boxW/2, boxY+35, { align:'center' });
  }

  doc.setDrawColor(230,230,233);
  doc.setLineWidth(1);
  doc.line(marginX, 70, pageW-marginX, 70);

  /* letra e acordes em Inconsolata (como o modelo do Davi); sem a fonte carregada, Courier */
  let mono = 'courier';
  if(lvPdfFonte){
    try{
      doc.addFileToVFS('Inconsolata-Regular.ttf', lvPdfFonte.r); doc.addFont('Inconsolata-Regular.ttf', 'Inconsolata', 'normal');
      doc.addFileToVFS('Inconsolata-Bold.ttf', lvPdfFonte.b); doc.addFont('Inconsolata-Bold.ttf', 'Inconsolata', 'bold');
      mono = 'Inconsolata';
    }catch(e){ mono = 'courier'; }
  }
  const { items } = lvParseContent(l.conteudo);
  const cols = lvColunasEfetivas(l);
  const colWidth = cols===2 ? (pageW - marginX*2 - 20)/2 : (pageW - marginX*2);
  const colX = [marginX, marginX + colWidth + 20];
  const startY = 96;

  /* desenha tudo com a letra em "fontSize"; desenhar=false só conta quantas páginas precisaria */
  function layout(fontSize, desenhar){
    let colIdx = 0, y = startY, paginas = 1;
    const lineH = fontSize * l.pdfAlturaLinha;
    const nextColumnOrPage = ()=>{
      if(cols===2 && colIdx===0){ colIdx = 1; y = startY; }
      else { paginas++; if(desenhar) doc.addPage(); colIdx = 0; y = startY; }
    };
    const ensureSpace = need=>{ if(y + need > pageH - marginX) nextColumnOrPage(); };
    items.forEach(it=>{
      if(it.type==='colbreak'){ nextColumnOrPage(); return; }
      if(it.type==='divider'){
        ensureSpace(lineH*0.7);
        if(desenhar){ doc.setDrawColor(224,224,228); doc.setLineWidth(0.8); doc.line(colX[colIdx] - 6, y - lineH*0.35, colX[colIdx] + colWidth + 6, y - lineH*0.35); }
        y += lineH*0.5;
        return;
      }
      if(it.type==='blank'){ ensureSpace(lineH*0.6); y += lineH*0.6; return; }
      if(it.type==='slidebreak'){   // "-": linha curta (35%) à esquerda, junto do texto, mais clara que a do "--"
        ensureSpace(lineH*0.8);
        if(desenhar){ doc.setDrawColor(207,207,214); doc.setLineWidth(0.7); doc.line(colX[colIdx], y - lineH*0.4, colX[colIdx] + colWidth*0.35, y - lineH*0.4); }
        y += lineH*0.45;
        return;
      }
      if(it.type==='section'){
        ensureSpace(lineH*3.2);   // a etiqueta não fica sozinha no fim da coluna (cabe ela + a 1ª linha com acordes)
        if(desenhar){
          /* etiqueta pequena e cinza, letras espaçadas (como no modelo) */
          const rv = lvVezesDoRotulo(it.label), label = rv.nome.toUpperCase() + (rv.vezes > 1 ? ' | ' + rv.vezes + 'X' : '');
          doc.setFont('helvetica','bold'); doc.setFontSize(6.6);
          if(doc.setCharSpace) doc.setCharSpace(0.9);
          const textW = doc.getTextWidth(label) + label.length * 0.9;
          const pillW = textW + 22, pillH = 12.5, cx = colX[colIdx] + colWidth/2;
          doc.setFillColor(116,118,128);
          doc.roundedRect(cx - pillW/2, y - 9.5, pillW, pillH, 4, 4, 'F');
          doc.setTextColor(255,255,255);
          doc.text(label, cx - textW/2, y - 0.6);
          if(doc.setCharSpace) doc.setCharSpace(0);
        }
        y += lineH*1.15;
        return;
      }
      if(it.type==='pair'){
        const chordLine = lvTransposeChordLine(it.chordLine||'', delta);
        const lyricLine = it.lyricLine || ' ';
        ensureSpace(lineH*(chordLine.trim() ? 1.85 : 1));
        doc.setFont(mono,'normal'); doc.setFontSize(fontSize);
        if(doc.setCharSpace) doc.setCharSpace(l.pdfEspacamento);
        const largura = Math.max(chordLine.trim() ? doc.getTextWidth(chordLine) : 0, doc.getTextWidth(lyricLine));
        const tamanho = largura > colWidth ? fontSize * Math.max(0.5, colWidth / largura) : fontSize;   // linha comprida encolhe só ela
        if(chordLine.trim()){
          if(desenhar){ doc.setFont(mono,'bold'); doc.setFontSize(tamanho); doc.setTextColor(...orange); doc.text(chordLine, colX[colIdx], y); }
          y += lineH*0.85;
        }
        if(desenhar){ doc.setFont(mono,'normal'); doc.setFontSize(tamanho); doc.setTextColor(32,32,36); doc.text(lyricLine, colX[colIdx], y); }
        y += lineH;
        if(doc.setCharSpace) doc.setCharSpace(0);
      }
    });
    return paginas;
  }
  /* cabe numa folha só? encolhe a letra até 78% (mín. 9pt), como a folha da tela; se nem assim couber, fica no tamanho normal */
  let fs = l.pdfTamanhoTexto;
  if(layout(fs, false) > 1){
    const minimo = Math.max(9, l.pdfTamanhoTexto * 0.78);
    let f = fs;
    while(f - 0.5 >= minimo && layout(f, false) > 1) f -= 0.5;
    if(layout(f, false) === 1) fs = f;
  }
  layout(fs, true);

  const tomRaiz = lvTomAtual(l);
  const nomePartes = [l.artista, l.titulo||'Sem título', tomRaiz].filter(Boolean);
  const nomeArquivo = nomePartes.join(' - ').replace(/[\/\\:*?"<>|]/g,'').trim();
  return { doc, nome: `${nomeArquivo}.pdf` };
}

/* ---------- Slides ---------- */
function ajustarLvSlideTituloTamanho(delta){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.slideTituloTamanho = Math.max(20, Math.min(70, l.slideTituloTamanho + delta));
  persist();
  renderLouvorSlidePreview();
}
function ajustarLvSlideTextoTamanho(delta){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.slideTextoTamanho = Math.max(16, Math.min(56, l.slideTextoTamanho + delta));
  persist();
  renderLouvorSlidePreview();
}
function ajustarLvSlideAlturaLinha(delta){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.slideAlturaLinha = Math.round(Math.max(1.0, Math.min(2.5, l.slideAlturaLinha + delta))*10)/10;
  persist();
  renderLouvorSlidePreview();
}
function ajustarLvSlideEspacamento(delta){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.slideEspacamento = Math.round(Math.max(0, Math.min(3, l.slideEspacamento + delta))*10)/10;
  persist();
  renderLouvorSlidePreview();
}
function renderLouvorSlideConfigPainel(){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  document.getElementById('lvSlideTituloTamanhoLabel').textContent = l.slideTituloTamanho+'pt';
  document.getElementById('lvSlideTextoTamanhoLabel').textContent = l.slideTextoTamanho+'pt';
  document.getElementById('lvSlideAlturaLinhaLabel').textContent = l.slideAlturaLinha.toFixed(1);
  document.getElementById('lvSlideEspacamentoLabel').textContent = l.slideEspacamento.toFixed(1);
}
function renderLouvorSlidePreview(){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  renderLouvorSlideConfigPainel();
  /* slides só com a letra (os acordes ficam no PDF) */
  const { slides } = lvParseContent(l.conteudo);
  const total = slides.length + 1;
  if(lvSlideIndex >= total) lvSlideIndex = total-1;
  if(lvSlideIndex < 0) lvSlideIndex = 0;
  document.getElementById('lvSlideCounter').textContent = `${lvSlideIndex+1} / ${total}`;
  const el = document.getElementById('lvSlidePreview');
  /* prévia na mesma escala do slide de verdade (13,33" = 960pt de largura): N pt = N/960 da largura da prévia */
  const pt = n => `calc(${n} / 960 * 100cqw)`;
  const espacamentoStyle = `letter-spacing:${pt(l.slideEspacamento)}`;
  if(lvSlideIndex === 0){
    el.style.alignItems = 'center';
    el.innerHTML = `<div class="lv-slide-title" style="font-size:${pt(l.slideTituloTamanho)};text-align:center;line-height:${l.slideAlturaLinha};${espacamentoStyle}">${lvEsc(l.titulo||'Sem título')}</div><div class="lv-slide-artist" style="font-size:${pt(LV_SLIDE_ARTISTA_PT)};text-align:center">${lvEsc(l.artista||'')}</div>`;
  }else{
    const s = slides[lvSlideIndex-1];
    const lyricText = s.lines.join('\n');
    el.style.alignItems = 'center';
    el.innerHTML = `<div class="lv-slide-lyric" style="font-size:${pt(l.slideTextoTamanho)};text-align:center;line-height:${l.slideAlturaLinha};${espacamentoStyle}">${lvEsc(lyricText).replace(/\n/g,'<br>')}</div>`;
    if(s.vezes > 1) el.insertAdjacentHTML('beforeend', `<span class="lv-slide-vezes" style="font-size:${pt(LV_SLIDE_VEZES_PT)}">${s.vezes}x</span>`);
  }
}
function lvSlideNav(delta){
  const l = getLouvorAtual(); if(!l) return;
  const slides = lvParseContent(l.conteudo).slides;
  const total = slides.length + 1;
  lvSlideIndex = Math.max(0, Math.min(total-1, lvSlideIndex + delta));
  renderLouvorSlidePreview();
}
/* slide: mesmo visual na prévia e no arquivo .pptx */
const LV_SLIDE_FONTE = 'Arial';
const LV_SLIDE_FUNDO = '#020617';
const LV_SLIDE_ARTISTA_PT = 22;
const LV_SLIDE_VEZES_PT = 26;   // "2x" no canto de cima, à direita
/* gerador de slides (~470 KB) só é baixado quando for usado */
const LV_PPTXGEN = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
async function exportarLouvorSlides(){
  const l = getLouvorAtual(); if(!l) return;
  const r = await lvMontarSlides(l);
  if(r) r.pres.writeFile({ fileName: r.nome });
}
/* monta os slides (.pptx) de um louvor qualquer → { pres, nome } (também usado no envio ao Drive) */
async function lvMontarSlides(l){
  ensureLouvorConfig(l);
  if(!(window.pptxgen || window.PptxGenJS)){
    showToast('Preparando os slides...');
    try{ await lviCarregarScript(LV_PPTXGEN, ()=>!!(window.pptxgen || window.PptxGenJS)); }catch(e){}
  }
  const PptxCtor = window.pptxgen || window.PptxGenJS;
  if(typeof PptxCtor === 'undefined'){
    showToast('Não foi possível carregar o gerador de slides.');
    return null;
  }
  const pres = new PptxCtor();
  pres.defineLayout({ name:'WIDE', width:13.333, height:7.5 });
  pres.layout = 'WIDE';
  /* igual à prévia: mesmo fundo, Arial e exatamente o tamanho configurado (sem reduzir) */
  const fundo = LV_SLIDE_FUNDO.replace('#','');

  const capa = pres.addSlide();
  capa.background = { color: fundo };
  capa.addText(l.titulo||'Sem título', { x:0.6,y:2.4,w:12.1,h:1.6, fontFace:LV_SLIDE_FONTE, fontSize:l.slideTituloTamanho, bold:true, color:'FFFFFF', align:'center', valign:'bottom', lineSpacingMultiple:l.slideAlturaLinha, charSpacing:l.slideEspacamento });
  capa.addText(l.artista||'', { x:0.6,y:4.05,w:12.1,h:0.8, fontFace:LV_SLIDE_FONTE, fontSize:LV_SLIDE_ARTISTA_PT, color:'B3B3B3', align:'center', valign:'top' });

  const { slides } = lvParseContent(l.conteudo);
  slides.forEach(s=>{
    const slide = pres.addSlide();
    slide.background = { color: fundo };
    const lyricText = s.lines.join('\n');
    slide.addText(lyricText, { x:0.6,y:0.6,w:12.1,h:6.3, fontFace:LV_SLIDE_FONTE, fontSize:l.slideTextoTamanho, bold:true, color:'FFFFFF', align:'center', valign:'middle', lineSpacingMultiple:l.slideAlturaLinha, charSpacing:l.slideEspacamento });
    if(s.vezes > 1) slide.addText(s.vezes + 'x', { x:11.55,y:0.3,w:1.45,h:0.7, shape: pres.ShapeType ? pres.ShapeType.roundRect : 'roundRect', rectRadius:0.35, line:{ color:'FFFFFF', width:1.5 }, fontFace:LV_SLIDE_FONTE, fontSize:LV_SLIDE_VEZES_PT, bold:true, color:'FFFFFF', align:'center', valign:'middle', margin:0 });
  });

  const nomePartesSlides = [l.artista, l.titulo||'Sem título'].filter(Boolean);
  const nomeArquivoSlides = nomePartesSlides.join(' - ').replace(/[\/\\:*?"<>|]/g,'').trim();
  return { pres, nome: `${nomeArquivoSlides}.pptx` };
}


/* TEMPORÁRIO (pedido do Davi, até terminar de testar o app): apaga todas as músicas e tira elas dos roteiros do Culto.
   Tem "Desfazer" por alguns segundos; o banco também guarda cópias por hora (app_state_historico). Remover quando ele disser. */
async function lvLimparTudo(){
  const n = (state.louvores || []).length;
  if(!n){ showToast('Não há músicas para apagar'); return; }
  if(!(await iosConfirm(`Apagar as ${n} músicas do Louvor? Elas saem também dos roteiros do Culto. (Opção temporária para testes)`))) return;
  comDesfazer(`${n} músicas apagadas`, ()=>{
    state.louvores = [];
    (state.cultos || []).forEach(c=>{ c.partes.forEach(p=>{ p.musicas = []; }); delete c.ordemWhats; });
    persist();
    renderLouvor();
  }, ()=>renderLouvor());
}
