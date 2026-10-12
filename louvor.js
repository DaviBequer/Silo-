function lvContextoAtivo(){
  const abaLouvorAtiva = document.getElementById('aba-louvor')?.classList.contains('active');
  const detalheAtivo = document.getElementById('pageLouvorDetalhe')?.classList.contains('active');
  const formAtivo = document.getElementById('pageLouvorForm')?.classList.contains('active');
  return abaLouvorAtiva || detalheAtivo || formAtivo;
}
function atualizarLvNavBar(){
  const bar = document.getElementById('lvNavBar');
  if(!bar) return;
  const ativo = lvContextoAtivo();
  bar.classList.toggle('show', ativo);
  document.body.classList.toggle('lv-nav-active', ativo);
  const naBiblioteca = document.getElementById('aba-louvor')?.classList.contains('active');
  document.getElementById('lvNavBiblioteca')?.classList.toggle('active', !!naBiblioteca);
  document.getElementById('lvNavEstudio')?.classList.toggle('active', !naBiblioteca && ativo);
}

/* ================= LOUVOR ================= */
const LOUVOR_CATEGORIAS = ['Louvor','Harpa Cristã','Corinhos'];
let louvorFiltroAtivo = 'Atual';
let louvorSearchTerm = '';
let louvorAtualId = null;
let lvSlideIndex = 0;
let louvorFiltrosVisiveis = true;

function getLouvorAtual(){ return state.louvores.find(l=>l.id===louvorAtualId); }

function lvEstaAtual(l){
  if(l.status !== 'finalizada') return true;
  if(!l.dataAgendamento) return false;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const data = new Date(l.dataAgendamento+'T00:00:00');
  return data >= hoje;
}

function renderLouvor(){
  renderLouvorFilterChips();
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
  items.sort((a,b)=> (a.titulo||'').localeCompare(b.titulo||''));
  if(items.length===0){
    el.innerHTML = `<div class="empty-state"><div class="title">Nenhum louvor encontrado</div><div class="desc">Toque no + para adicionar</div></div>`;
    return;
  }
  el.innerHTML = items.map(l=>{
    ensureLouvorConfig(l);
    const tomAtual = lvTomAtual(l);
    return `<div class="lv-card" onclick="abrirLouvorDetalhe('${l.id}')">
      <div class="lv-card-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
      <div class="lv-card-info">
        <div class="lv-card-titulo">${l.titulo||'Sem título'}</div>
        <div class="lv-card-meta">${l.artista||'Artista desconhecido'} · ${l.categoria||'Louvor'}</div>
      </div>
      ${tomAtual?`<div class="lv-card-tom">${tomAtual}</div>`:''}
    </div>`;
  }).join('');
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
  const st = document.getElementById('lvNovoImportStatus'); if(st){ st.textContent = ''; st.classList.remove('erro'); }
  renderLvNovoCategoriaChips();
  atualizarLvNovoTomBox();
  document.getElementById('pageLouvorForm').classList.add('active');
  window.scrollTo(0,0);
  atualizarLvNavBar();
}
function closeLouvorForm(){
  document.getElementById('pageLouvorForm').classList.remove('active');
  document.body.style.overflow = '';
  atualizarLvNavBar();
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
  ensureLouvorConfig(l);
  document.getElementById('louvorDetalheHeaderTitle').textContent = l.titulo || 'Sem título';
  document.getElementById('lvTitulo').value = l.titulo || '';
  document.getElementById('lvArtista').value = l.artista || '';
  document.getElementById('lvConteudo').value = l.conteudo || '';
  document.getElementById('lvDataAgendamento').value = l.dataAgendamento || '';
  renderLvCategoriaChips();
  atualizarLvTomBox();
  renderLvStatusBtn();
  switchLouvorSubtab('edicao');
  document.getElementById('pageLouvorDetalhe').classList.add('active');
  window.scrollTo(0,0);
  atualizarLvNavBar();
}
function renderLvStatusBtn(){
  const l = getLouvorAtual(); if(!l) return;
  const btn = document.getElementById('lvStatusBtn');
  const finalizada = l.status === 'finalizada';
  btn.textContent = finalizada ? 'Finalizado' : 'Em Produção';
  btn.classList.toggle('finalizada', finalizada);
}
function toggleLouvorStatus(){
  const l = getLouvorAtual(); if(!l) return;
  l.status = l.status === 'finalizada' ? 'producao' : 'finalizada';
  persist();
  renderLvStatusBtn();
}
function closeLouvorDetalhe(){
  document.getElementById('pageLouvorDetalhe').classList.remove('active');
  louvorAtualId = null;
  renderLouvor();
  atualizarLvNavBar();
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
function salvarLouvorCampo(){
  const l = getLouvorAtual(); if(!l) return;
  l.titulo = document.getElementById('lvTitulo').value;
  l.artista = document.getElementById('lvArtista').value;
  l.conteudo = document.getElementById('lvConteudo').value;
  document.getElementById('louvorDetalheHeaderTitle').textContent = l.titulo || 'Sem título';
  renderLouvorLista();
  persist();
}
function salvarLouvorData(v){
  const l = getLouvorAtual(); if(!l) return;
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

function switchLouvorSubtab(tab){
  document.querySelectorAll('.lv-subtab').forEach(el=>el.classList.toggle('active', el.dataset.tab===tab));
  document.querySelectorAll('.lv-panel').forEach(el=>el.classList.remove('active'));
  const conteudo = document.getElementById('louvorDetalheConteudo');
  if(conteudo) conteudo.scrollTop = 0;
  if(tab==='edicao') document.getElementById('lvPanelEdicao').classList.add('active');
  if(tab==='pdf'){
    document.getElementById('lvPanelPdf').classList.add('active');
    renderLouvorPdfPreview();
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
function lvTomAtual(l){
  if(!l.tomOriginal) return '';
  const rootAtual = lvShiftNote(l.tomOriginal, l.transpose||0) || l.tomOriginal;
  if(l.tomModoMenor){
    const idx = LV_CHROMATIC.indexOf(rootAtual);
    const relIdx = idx===-1 ? null : (idx+9)%12;
    return (relIdx!==null ? LV_CHROMATIC[relIdx] : rootAtual) + 'm';
  }
  return rootAtual;
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
function renderLvHarmonicBar(l){
  const el = document.getElementById('lvHarmonicBar');
  if(!el) return;
  const rootAtual = l.tomOriginal ? (lvShiftNote(l.tomOriginal, l.transpose||0) || l.tomOriginal) : '';
  if(!rootAtual){ el.innerHTML = ''; return; }
  const rootIdx = LV_CHROMATIC.indexOf(rootAtual);
  if(rootIdx===-1){ el.innerHTML = ''; return; }
  el.innerHTML = LV_GRAUS_MAIOR.map(g=>{
    const notaIdx = (rootIdx+g.semitom)%12;
    const nota = LV_CHROMATIC[notaIdx];
    const acorde = nota + g.qualidade;
    const notaAlt = LV_CHROMATIC[(notaIdx+7)%12];
    const alt = notaAlt + '7';
    return `<div class="lv-grau-col">
      <div class="lv-grau-chip"><div class="lv-grau-num">${g.grau}</div><div class="lv-grau-chord">${acorde}</div></div>
      <div class="lv-grau-alt">${alt}</div>
    </div>`;
  }).join('');
}

/* ---------- Seletor de Tom (grid cromático + relativo menor no duplo toque) ---------- */
const LV_TOM_GRID = ['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B'];
function lvNotasEquivalentes(a,b){
  if(!a || !b) return false;
  let ia = LV_CHROMATIC.indexOf(a); if(ia===-1) ia = LV_FLAT.indexOf(a);
  let ib = LV_CHROMATIC.indexOf(b); if(ib===-1) ib = LV_FLAT.indexOf(b);
  return ia!==-1 && ia===ib;
}
let lvTomPickerModo = 'edit';
function abrirLvTomPicker(modo){
  lvTomPickerModo = modo || 'edit';
  renderLvTomGrid();
  document.getElementById('modalLvTom').classList.add('active');
}
function lvNovoTomAtual(){
  if(!window.lvNovoTomOriginal) return '';
  if(window.lvNovoTomModoMenor){
    const idx = LV_CHROMATIC.indexOf(window.lvNovoTomOriginal);
    const relIdx = idx===-1 ? null : (idx+9)%12;
    return (relIdx!==null ? LV_CHROMATIC[relIdx] : window.lvNovoTomOriginal) + 'm';
  }
  return window.lvNovoTomOriginal;
}
function atualizarLvNovoTomBox(){
  const el = document.getElementById('lvNovoTomBoxValor');
  if(el) el.textContent = lvNovoTomAtual() || 'Selecione';
}
function renderLvTomGrid(){
  let atualBase;
  if(lvTomPickerModo==='novo'){
    atualBase = lvNovoTomAtual().replace(/m$/,'');
  }else{
    const l = getLouvorAtual(); if(!l) return;
    atualBase = lvTomAtual(l).replace(/m$/,'');
  }
  document.getElementById('lvTomGrid').innerHTML = LV_TOM_GRID.map(nota=>{
    const isActive = lvNotasEquivalentes(nota, atualBase);
    return `<button type="button" class="lv-tom-grid-btn${isActive?' active':''}" onclick="lvTomGridClick('${nota}')">${nota}</button>`;
  }).join('');
}
let lvTomClickTimer = null;
function lvTomGridClick(nota){
  if(lvTomClickTimer){
    clearTimeout(lvTomClickTimer);
    lvTomClickTimer = null;
    lvTomGridEscolher(nota, true);
  }else{
    lvTomClickTimer = setTimeout(()=>{
      lvTomClickTimer = null;
      lvTomGridEscolher(nota, false);
    }, 280);
  }
}
function lvTransposeConteudoTexto(conteudo, delta){
  if(!delta) return conteudo;
  return (conteudo||'').split('\n').map(line=>{
    const trimmed = line.trim();
    if(isChordLine(trimmed)) return lvTransposeChordLine(line, delta);
    return line;
  }).join('\n');
}
function lvTomGridEscolher(nota, modoMenor){
  if(lvTomPickerModo==='novo'){
    window.lvNovoTomOriginal = nota;
    window.lvNovoTomModoMenor = modoMenor;
    atualizarLvNovoTomBox();
    closeModal('modalLvTom');
    return;
  }
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  let idxNota = LV_CHROMATIC.indexOf(nota); if(idxNota===-1) idxNota = LV_FLAT.indexOf(nota);
  let idxOriginal = LV_CHROMATIC.indexOf(l.tomOriginal); if(idxOriginal===-1) idxOriginal = LV_FLAT.indexOf(l.tomOriginal);
  if(idxOriginal===-1){
    l.tomOriginal = nota;
    l.transpose = 0;
  }else{
    const delta = ((idxNota - idxOriginal)%12+12)%12;
    if(delta){
      l.conteudo = lvTransposeConteudoTexto(l.conteudo, delta);
      const conteudoEl = document.getElementById('lvConteudo');
      if(conteudoEl) conteudoEl.value = l.conteudo;
    }
    l.tomOriginal = nota;
    l.transpose = 0;
  }
  l.tomModoMenor = modoMenor;
  persist();
  atualizarLvTomBox();
  renderLouvorPdfPreview();
  closeModal('modalLvTom');
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
  'm7','m9','m6','m11','m13','m4','7M','9M','2','4','5','6','7','9','11','13','m','M'];
const LV_CHORD_SUFFIX_RE = LV_CHORD_SUFFIXES.sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
/* aceita também extensões entre parênteses, ex.: E(9), A7(4) */
const LV_CHORD_RE = new RegExp(`^[A-G](#|b)?(${LV_CHORD_SUFFIX_RE})?(\\([^)]*\\))?(\\/[A-G](#|b)?)?$`);
function isChordLine(line){
  const trimmed = line.trim();
  if(!trimmed) return false;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return tokens.every(t=>LV_CHORD_RE.test(t));
}
const LV_CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const LV_FLAT = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
function lvShiftNote(note, delta){
  let idx = LV_CHROMATIC.indexOf(note);
  if(idx===-1) idx = LV_FLAT.indexOf(note);
  if(idx===-1) return null;
  return LV_CHROMATIC[((idx+delta)%12+12)%12];
}
function lvTransposeChord(chord, delta){
  if(!chord || !delta) return chord;
  const m = chord.match(/^([A-G])(#|b)?/);
  if(!m) return chord;
  const rootFull = m[1] + (m[2]||'');
  let rest = chord.slice(rootFull.length);
  const newRoot = lvShiftNote(rootFull, delta);
  if(!newRoot) return chord;
  const slashIdx = rest.indexOf('/');
  if(slashIdx !== -1){
    const bassPart = rest.slice(slashIdx+1);
    const bm = bassPart.match(/^([A-G])(#|b)?/);
    if(bm){
      const bassFull = bm[1] + (bm[2]||'');
      const newBass = lvShiftNote(bassFull, delta) || bassFull;
      const bassRest = bassPart.slice(bassFull.length);
      return newRoot + rest.slice(0,slashIdx) + '/' + newBass + bassRest;
    }
  }
  return newRoot + rest;
}
function lvTransposeChordLine(line, delta){
  if(!delta) return line;
  return line.replace(/\S+/g, tok => lvTransposeChord(tok, delta));
}

/* Faz uma única passada pelo texto bruto e devolve:
   items -> sequência pra montar o PDF (seções, pares cifra+letra, divisores, quebras de coluna, espaços em branco)
   slides -> lista de slides (cada um só com as linhas de letra, sem cifra), quebrados por seção e por "-" */
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
    if(trimmed === '-'){ flushPendingChord(); startNewSlide(); return; }
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
  const expandidos = [], originais = [];
  slides.forEach(s=>{
    const rep = /^repete\b\s*[-–:]?\s*(.*)$/i.exec(s.label||'');
    if(rep && !s.lines.length){
      const alvo = rep[1].trim().toLowerCase();
      expandidos.push(...originais.filter(o=>(o.label||'').trim().toLowerCase()===alvo).map(o=>({ label:o.label, lines:o.lines.slice() })));
      return;
    }
    originais.push(s);
    expandidos.push(s);
  });
  return { items, slides: expandidos.filter(s=>s.lines.length>0) };
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
function lvPairHtml(it, delta){
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
  return `<div class="lv-linha${acordes.length?'':' sem-acorde'}" data-ci="${it.chordIdx??''}" data-li="${it.lyricIdx??''}">${html}</div>`;
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
  const { items } = lvParseContent(l.conteudo);
  let bodyHtml = '', nSecoes = 0, aberta = false, blocoHtml = '', blocoLinhas = 0;
  /* cada bloco (pílula + linhas) fica junto e separado do próximo por uma linha fina;
     bloco muito comprido (ex.: música sem seções) pode quebrar entre colunas */
  const fecha = ()=>{ if(aberta){ bodyHtml += `<div class="lv-bloco${blocoLinhas>14?' longo':''}">${blocoHtml}</div>`; aberta = false; blocoHtml = ''; blocoLinhas = 0; } };
  const abre = ()=>{ if(!aberta){ aberta = true; blocoHtml = ''; blocoLinhas = 0; } };
  items.forEach(it=>{
    if(it.type==='section'){
      fecha(); abre(); nSecoes++;
      const rep = /^repete\b/i.test(it.label);
      blocoHtml += `<div class="lv-sheet-section-wrap${rep?' rep':''}"><span class="lv-sheet-section" data-si="${it.idx}">${lvEsc(it.label)}</span></div>`;
    }else if(it.type==='divider'){
      abre(); blocoHtml += `<div class="lv-sheet-divider"></div>`;
    }else if(it.type==='colbreak'){
      fecha(); bodyHtml += `<div class="lv-colbreak"></div>`;
    }else if(it.type==='blank'){
      if(aberta) blocoHtml += `<div class="lv-sheet-blank"></div>`;
    }else if(it.type==='pair'){
      abre(); blocoHtml += lvPairHtml(it, delta); blocoLinhas++;
    }
  });
  fecha();
  const tomAtual = lvTomAtual(l);
  const previewEl = document.getElementById('lvPdfPreview');
  const paisagem = l.pdfOrientacao==='paisagem';
  previewEl.style.zoom = 1;   // mede no tamanho real; o zoom de tela é aplicado no fim
  previewEl.classList.toggle('paisagem', paisagem);
  previewEl.classList.toggle('sans', l.pdfFonte==='sans');
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
  lvAjustarZoomFolha();
}
/* a folha tem o tamanho real do A4; em tela pequena ela só é mostrada menor (zoom), sem mudar o desenho */
function lvAjustarZoomFolha(){
  const el = document.getElementById('lvPdfPreview');
  if(!el || !el.parentElement) return;
  el.style.zoom = 1;
  const disp = el.parentElement.clientWidth;
  const w = el.offsetWidth;
  if(w && disp && w > disp) el.style.zoom = (disp / w).toFixed(3);
}
window.addEventListener('resize', ()=>{ if(document.getElementById('lvPanelPdf')?.classList.contains('active')) lvAjustarZoomFolha(); });
function exportarLouvorPdf(){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  if(typeof window.jspdf === 'undefined'){
    showToast('Não foi possível carregar o gerador de PDF.');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4', orientation: l.pdfOrientacao==='paisagem' ? 'landscape' : 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = l.pdfMargem;
  const orange = [219,139,24];
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

  const { items } = lvParseContent(l.conteudo);
  const cols = lvColunasEfetivas(l);
  const colWidth = cols===2 ? (pageW - marginX*2 - 20)/2 : (pageW - marginX*2);
  const colX = [marginX, marginX + colWidth + 20];
  const startY = 96;
  let colIdx = 0, y = startY;
  const fontSize = l.pdfTamanhoTexto;
  const lineH = fontSize * l.pdfAlturaLinha;
  doc.setFont('courier','normal');
  doc.setFontSize(fontSize);
  if(doc.setCharSpace) doc.setCharSpace(l.pdfEspacamento);

  function nextColumnOrPage(){
    if(cols===2 && colIdx===0){ colIdx = 1; y = startY; }
    else { doc.addPage(); colIdx = 0; y = startY; }
  }
  function ensureSpace(need){
    if(y + need > pageH - marginX) nextColumnOrPage();
  }

  items.forEach(it=>{
    if(it.type==='colbreak'){ nextColumnOrPage(); return; }
    if(it.type==='divider'){
      ensureSpace(lineH);
      doc.setDrawColor(210,210,214);
      doc.line(colX[colIdx], y-4, colX[colIdx]+colWidth, y-4);
      y += lineH*0.7;
      return;
    }
    if(it.type==='blank'){ ensureSpace(lineH*0.7); y += lineH*0.7; return; }
    if(it.type==='section'){
      ensureSpace(lineH*1.6);
      if(doc.setCharSpace) doc.setCharSpace(0);
      doc.setFillColor(118,124,133);
      const label = it.label.toUpperCase();
      doc.setFont('helvetica','bold');
      doc.setFontSize(fontSize-2);
      const textW = doc.getTextWidth(label);
      const pillW = textW + 20, pillH = fontSize+6, pillX = colX[colIdx]+colWidth/2-pillW/2;
      doc.roundedRect(pillX, y-fontSize+2, pillW, pillH, pillH/2, pillH/2, 'F');
      doc.setTextColor(255,255,255);
      doc.text(label, colX[colIdx]+colWidth/2, y+2, { align:'center' });
      y += lineH*1.3;
      doc.setFont('courier','normal');
      doc.setFontSize(fontSize);
      if(doc.setCharSpace) doc.setCharSpace(l.pdfEspacamento);
      return;
    }
    if(it.type==='pair'){
      const chordLine = lvTransposeChordLine(it.chordLine||'', delta);
      const lyricLine = it.lyricLine || ' ';
      ensureSpace(lineH*2);
      doc.setFontSize(fontSize);
      const chordW = chordLine.trim() ? doc.getTextWidth(chordLine) : 0;
      const lyricW = doc.getTextWidth(lyricLine);
      const maiorLargura = Math.max(chordW, lyricW);
      const escala = maiorLargura > colWidth ? Math.max(0.5, colWidth / maiorLargura) : 1;
      const tamanhoDesenho = fontSize * escala;
      if(chordLine.trim()){
        doc.setFontSize(tamanhoDesenho);
        doc.setTextColor(...orange);
        doc.text(chordLine, colX[colIdx], y);
        y += lineH*0.85;
      }
      doc.setFontSize(tamanhoDesenho);
      doc.setTextColor(40,40,40);
      doc.text(lyricLine, colX[colIdx], y);
      doc.setFontSize(fontSize);
      y += lineH;
    }
  });

  const tomRaiz = lvShiftNote(l.tomOriginal, l.transpose||0) || l.tomOriginal || '';
  const nomePartes = [l.artista, l.titulo||'Sem título', tomRaiz].filter(Boolean);
  const nomeArquivo = nomePartes.join(' - ').replace(/[\/\\:*?"<>|]/g,'').trim();
  doc.save(`${nomeArquivo}.pdf`);
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
  const comAcordes = !!l.slidesComAcordes;
  const chk = document.getElementById('lvSlidesComAcordes'); if(chk) chk.checked = comAcordes;
  const { slides } = comAcordes ? { slides: lvSlidesComAcordesDados(l) } : lvParseContent(l.conteudo);
  const total = slides.length + 1;
  if(lvSlideIndex >= total) lvSlideIndex = total-1;
  if(lvSlideIndex < 0) lvSlideIndex = 0;
  document.getElementById('lvSlideCounter').textContent = `${lvSlideIndex+1} / ${total}`;
  const el = document.getElementById('lvSlidePreview');
  el.classList.toggle('com-acordes', comAcordes);
  if(comAcordes){
    if(lvSlideIndex === 0){
      el.innerHTML = `<div class="lv-slide-title">${lvEsc(l.titulo||'Sem título')}</div><div class="lv-slide-artist">${lvEsc([l.artista, lvTomAtual(l)?'Tom: '+lvTomAtual(l):''].filter(Boolean).join('  ·  '))}</div>`;
    } else {
      const s = slides[lvSlideIndex-1];
      el.innerHTML = `${s.label?`<div class="lv-slide-label">${lvEsc(s.label)}</div>`:''}<div class="lv-slide-cifra">${s.pares.map(p=>(p.acordes.trim()?`<div class="c">${lvEsc(p.acordes)}</div>`:'')+(p.letra.trim()?`<div class="t">${lvEsc(p.letra)}</div>`:'')).join('')}</div>`;
    }
    return;
  }
  const espacamentoStyle = `letter-spacing:${l.slideEspacamento}px`;
  if(lvSlideIndex === 0){
    el.style.alignItems = 'center';
    el.innerHTML = `<div class="lv-slide-title" style="font-size:${l.slideTituloTamanho/10}vw;text-align:center;line-height:${l.slideAlturaLinha};${espacamentoStyle}">${l.titulo||'Sem título'}</div><div class="lv-slide-artist" style="text-align:center">${l.artista||''}</div>`;
  }else{
    const s = slides[lvSlideIndex-1];
    const lyricText = s.lines.join('\n');
    el.style.alignItems = 'center';
    el.innerHTML = `<div class="lv-slide-lyric" style="font-size:${l.slideTextoTamanho/10}vw;text-align:center;line-height:${l.slideAlturaLinha};${espacamentoStyle}">${lyricText.replace(/\n/g,'<br>')}</div>`;
  }
}
function lvSlideNav(delta){
  const l = getLouvorAtual(); if(!l) return;
  const slides = l.slidesComAcordes ? lvSlidesComAcordesDados(l) : lvParseContent(l.conteudo).slides;
  const total = slides.length + 1;
  lvSlideIndex = Math.max(0, Math.min(total-1, lvSlideIndex + delta));
  renderLouvorSlidePreview();
}
/* gerador de slides (~470 KB) só é baixado quando for usado */
const LV_PPTXGEN = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
async function exportarLouvorSlides(){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  if(!(window.pptxgen || window.PptxGenJS)){
    showToast('Preparando os slides...');
    try{ await lviCarregarScript(LV_PPTXGEN, ()=>!!(window.pptxgen || window.PptxGenJS)); }catch(e){}
  }
  const PptxCtor = window.pptxgen || window.PptxGenJS;
  if(typeof PptxCtor === 'undefined'){
    showToast('Não foi possível carregar o gerador de slides.');
    return;
  }
  if(l.slidesComAcordes) return lvExportarSlidesComAcordes(l, PptxCtor);
  const pres = new PptxCtor();
  pres.defineLayout({ name:'WIDE', width:13.333, height:7.5 });
  pres.layout = 'WIDE';
  const graphiteHex = '25292E';

  const capa = pres.addSlide();
  capa.background = { color: graphiteHex };
  capa.addText(l.titulo||'Sem título', { x:0.5,y:2.6,w:12.3,h:1.4, fontSize:l.slideTituloTamanho*0.85, bold:true, color:'FFFFFF', align:'center', lineSpacingMultiple:l.slideAlturaLinha, charSpacing:l.slideEspacamento });
  capa.addText(l.artista||'', { x:0.5,y:4.0,w:12.3,h:0.8, fontSize:22, color:'CCCCCC', align:'center' });

  const { slides } = lvParseContent(l.conteudo);
  slides.forEach(s=>{
    const slide = pres.addSlide();
    slide.background = { color: graphiteHex };
    const lyricText = s.lines.join('\n');
    slide.addText(lyricText, { x:0.6,y:0.6,w:12.1,h:6.3, fontSize:l.slideTextoTamanho*0.85, bold:true, color:'FFFFFF', align:'center', valign:'middle', lineSpacingMultiple:l.slideAlturaLinha, charSpacing:l.slideEspacamento });
  });

  const nomePartesSlides = [l.artista, l.titulo||'Sem título'].filter(Boolean);
  const nomeArquivoSlides = nomePartesSlides.join(' - ').replace(/[\/\\:*?"<>|]/g,'').trim();
  pres.writeFile({ fileName: `${nomeArquivoSlides}.pptx` });
}

