/* ================= LOUVOR ================= */
const LOUVOR_CATEGORIAS = ['Louvor','Harpa Cristã','Corinhos'];
let louvorFiltroAtivo = 'Todas';
let louvorSearchTerm = '';
let louvorAtualId = null;
let lvSlideIndex = 0;

function getLouvorAtual(){ return state.louvores.find(l=>l.id===louvorAtualId); }

function renderLouvor(){
  renderLouvorFilterChips();
  renderLouvorLista();
}
function renderLouvorFilterChips(){
  const el = document.getElementById('louvorFilterChips');
  const chips = ['Todas', ...LOUVOR_CATEGORIAS];
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
  if(louvorFiltroAtivo !== 'Todas') items = items.filter(l=>l.categoria===louvorFiltroAtivo);
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
  window.lvNovoCategoriaSelecionada = 'Louvor';
  renderLvNovoCategoriaChips();
  document.getElementById('pageLouvorForm').classList.add('active');
}
function closeLouvorForm(){
  document.getElementById('pageLouvorForm').classList.remove('active');
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
  if(!titulo){ document.getElementById('lvNovoTitulo').focus(); return; }
  const id = 'lv_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  const novo = {
    id,
    titulo,
    artista: document.getElementById('lvNovoArtista').value.trim(),
    categoria: window.lvNovoCategoriaSelecionada || 'Louvor',
    tom: '',
    transpose: 0,
    colunas: 2,
    conteudo: '',
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
  renderLvCategoriaChips();
  atualizarLvTomBox();
  renderLvStatusBtn();
  switchLouvorSubtab('edicao');
  document.getElementById('pageLouvorDetalhe').classList.add('active');
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
  if(l.slideTituloAlinhamento === undefined) l.slideTituloAlinhamento = 'center';
  if(l.slideTextoTamanho === undefined) l.slideTextoTamanho = 32;
  if(l.slideTextoAlinhamento === undefined) l.slideTextoAlinhamento = 'center';
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
    const nota = LV_CHROMATIC[(rootIdx+g.semitom)%12];
    const acorde = nota + g.qualidade;
    const alt = nota + '7';
    return `<div class="lv-grau-chip"><div class="lv-grau-num">${g.grau}</div><div class="lv-grau-chord">${acorde}</div><div class="lv-grau-alt">${alt}</div></div>`;
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
function abrirLvTomPicker(){
  renderLvTomGrid();
  document.getElementById('modalLvTom').classList.add('active');
}
function renderLvTomGrid(){
  const l = getLouvorAtual(); if(!l) return;
  const atualBase = lvTomAtual(l).replace(/m$/,'');
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
function lvTomGridEscolher(nota, modoMenor){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  let idxNota = LV_CHROMATIC.indexOf(nota); if(idxNota===-1) idxNota = LV_FLAT.indexOf(nota);
  let idxOriginal = LV_CHROMATIC.indexOf(l.tomOriginal); if(idxOriginal===-1) idxOriginal = LV_FLAT.indexOf(l.tomOriginal);
  if(idxOriginal===-1){
    l.tomOriginal = nota;
    l.transpose = 0;
  }else{
    l.transpose = ((idxNota - idxOriginal)%12+12)%12;
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
const LV_CHORD_SUFFIXES = ['maj7','majsus4','madd9','madd11','msus2','msus4','mdim7','m7b5','m7M','maj9','maj','min','dim7','dim','aug','sus2','sus4','add9','add11','add2',
  'm7','m9','m6','m11','m13','7M','9M','6','7','9','11','13','m','M'];
const LV_CHORD_SUFFIX_RE = LV_CHORD_SUFFIXES.sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
const LV_CHORD_RE = new RegExp(`^[A-G](#|b)?(${LV_CHORD_SUFFIX_RE})?(\\/[A-G](#|b)?)?$`);
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
  let pendingChord = null;
  let currentLabel = '';
  const slides = [];
  let currentSlideLines = null;

  function flushPendingChord(){
    if(pendingChord !== null){
      items.push({ type:'pair', chordLine: pendingChord, lyricLine: '' });
      pendingChord = null;
    }
  }
  function startNewSlide(){
    currentSlideLines = [];
    slides.push({ label: currentLabel, lines: currentSlideLines });
  }

  rawLines.forEach(raw=>{
    const trimmed = raw.trim();
    if(trimmed === '---'){ flushPendingChord(); items.push({type:'colbreak'}); return; }
    if(trimmed === '--'){ flushPendingChord(); items.push({type:'divider'}); return; }
    if(trimmed === '-'){ flushPendingChord(); startNewSlide(); return; }
    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if(sectionMatch){
      flushPendingChord();
      currentLabel = sectionMatch[1];
      items.push({ type:'section', label: currentLabel });
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
      pendingChord = raw;
      return;
    }
    items.push({ type:'pair', chordLine: pendingChord||'', lyricLine: raw });
    pendingChord = null;
    if(currentSlideLines === null) startNewSlide();
    currentSlideLines.push(raw);
  });
  flushPendingChord();
  return { items, slides: slides.filter(s=>s.lines.length>0) };
}

/* ---------- PDF ---------- */
function setLouvorColunas(n){
  const l = getLouvorAtual(); if(!l) return;
  l.colunas = n;
  persist();
  renderLouvorPdfPreview();
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

  const delta = l.transpose || 0;
  const { items } = lvParseContent(l.conteudo);
  const lineStyle = `line-height:${l.pdfAlturaLinha};letter-spacing:${l.pdfEspacamento}px`;
  let bodyHtml = '';
  items.forEach(it=>{
    if(it.type==='section'){
      bodyHtml += `<div class="lv-sheet-section-wrap"><span class="lv-sheet-section">${it.label}</span></div>`;
    }else if(it.type==='divider'){
      bodyHtml += `<div class="lv-sheet-divider"></div>`;
    }else if(it.type==='colbreak'){
      bodyHtml += `<div class="lv-colbreak"></div>`;
    }else if(it.type==='blank'){
      bodyHtml += `<div class="lv-sheet-blank"></div>`;
    }else if(it.type==='pair'){
      const chordLine = lvTransposeChordLine(it.chordLine||'', delta);
      bodyHtml += chordLine.trim() ? `<div class="lv-sheet-chordline" style="font-size:${l.pdfTamanhoTexto}px;${lineStyle}">${chordLine}</div>` : '';
      bodyHtml += `<div class="lv-sheet-lyricline" style="font-size:${l.pdfTamanhoTexto}px;${lineStyle}">${it.lyricLine || ' '}</div>`;
    }
  });
  const tomAtual = lvTomAtual(l);
  const previewEl = document.getElementById('lvPdfPreview');
  previewEl.classList.toggle('paisagem', l.pdfOrientacao==='paisagem');
  previewEl.style.padding = l.pdfMargem+'px';
  previewEl.innerHTML = `
    <div class="lv-sheet-header">
      <div class="lv-sheet-header-text">
        <div class="lv-sheet-title" style="font-size:${l.pdfTamanhoTitulo}px">${l.titulo||'Sem título'}</div>
        <div class="lv-sheet-artist">${l.artista||''}</div>
      </div>
      ${tomAtual?`<div class="lv-sheet-tom-box"><span>TOM</span><b>${tomAtual}</b></div>`:''}
    </div>
    <div class="lv-sheet-cols" style="column-count:${l.colunas}">${bodyHtml || '<p class="empty-hint">Sem conteúdo ainda.</p>'}</div>
  `;
}
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
  const cols = l.colunas || 2;
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
function setLvSlideTituloAlinhamento(v){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.slideTituloAlinhamento = v;
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
function setLvSlideTextoAlinhamento(v){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.slideTextoAlinhamento = v;
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
function lvAlinhamentoChips(grupo, valorAtual){
  const opcoes = [['left','Esquerda'],['center','Centro'],['right','Direita'],['justify','Justificado']];
  return opcoes.map(([v,label])=>
    `<button type="button" class="dif-chip${valorAtual===v?' active':''}" onclick="${grupo}('${v}')">${label}</button>`
  ).join('');
}
function renderLouvorSlideConfigPainel(){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  document.getElementById('lvSlideTituloTamanhoLabel').textContent = l.slideTituloTamanho+'pt';
  document.getElementById('lvSlideTextoTamanhoLabel').textContent = l.slideTextoTamanho+'pt';
  document.getElementById('lvSlideTituloAlinhamentoChips').innerHTML = lvAlinhamentoChips('setLvSlideTituloAlinhamento', l.slideTituloAlinhamento);
  document.getElementById('lvSlideTextoAlinhamentoChips').innerHTML = lvAlinhamentoChips('setLvSlideTextoAlinhamento', l.slideTextoAlinhamento);
  document.getElementById('lvSlideAlturaLinhaLabel').textContent = l.slideAlturaLinha.toFixed(1);
  document.getElementById('lvSlideEspacamentoLabel').textContent = l.slideEspacamento.toFixed(1);
}
function renderLouvorSlidePreview(){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  renderLouvorSlideConfigPainel();
  const { slides } = lvParseContent(l.conteudo);
  const total = slides.length + 1;
  if(lvSlideIndex >= total) lvSlideIndex = total-1;
  if(lvSlideIndex < 0) lvSlideIndex = 0;
  document.getElementById('lvSlideCounter').textContent = `${lvSlideIndex+1} / ${total}`;
  const el = document.getElementById('lvSlidePreview');
  const alinhaFlex = { left:'flex-start', center:'center', right:'flex-end', justify:'center' };
  const espacamentoStyle = `letter-spacing:${l.slideEspacamento}px`;
  if(lvSlideIndex === 0){
    el.style.alignItems = alinhaFlex[l.slideTituloAlinhamento] || 'center';
    el.innerHTML = `<div class="lv-slide-title" style="font-size:${l.slideTituloTamanho/10}vw;text-align:${l.slideTituloAlinhamento};line-height:${l.slideAlturaLinha};${espacamentoStyle}">${l.titulo||'Sem título'}</div><div class="lv-slide-artist">${l.artista||''}</div>`;
  }else{
    const s = slides[lvSlideIndex-1];
    const lyricText = s.lines.join('\n');
    el.style.alignItems = alinhaFlex[l.slideTextoAlinhamento] || 'center';
    el.innerHTML = `<div class="lv-slide-lyric" style="font-size:${l.slideTextoTamanho/10}vw;text-align:${l.slideTextoAlinhamento};line-height:${l.slideAlturaLinha};${espacamentoStyle}">${lyricText.replace(/\n/g,'<br>')}</div>`;
  }
}
function lvSlideNav(delta){
  const l = getLouvorAtual(); if(!l) return;
  const { slides } = lvParseContent(l.conteudo);
  const total = slides.length + 1;
  lvSlideIndex = Math.max(0, Math.min(total-1, lvSlideIndex + delta));
  renderLouvorSlidePreview();
}
function exportarLouvorSlides(){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  const PptxCtor = window.pptxgen || window.PptxGenJS;
  if(typeof PptxCtor === 'undefined'){
    showToast('Não foi possível carregar o gerador de slides.');
    return;
  }
  const pres = new PptxCtor();
  pres.defineLayout({ name:'WIDE', width:13.333, height:7.5 });
  pres.layout = 'WIDE';
  const graphiteHex = '25292E';
  const alinhaPptx = { left:'left', center:'center', right:'right', justify:'justify' };

  const capa = pres.addSlide();
  capa.background = { color: graphiteHex };
  capa.addText(l.titulo||'Sem título', { x:0.5,y:2.6,w:12.3,h:1.4, fontSize:l.slideTituloTamanho*0.85, bold:true, color:'FFFFFF', align:alinhaPptx[l.slideTituloAlinhamento]||'center', lineSpacingMultiple:l.slideAlturaLinha, charSpacing:l.slideEspacamento });
  capa.addText(l.artista||'', { x:0.5,y:4.0,w:12.3,h:0.8, fontSize:22, color:'CCCCCC', align:alinhaPptx[l.slideTituloAlinhamento]||'center' });

  const { slides } = lvParseContent(l.conteudo);
  slides.forEach(s=>{
    const slide = pres.addSlide();
    slide.background = { color: graphiteHex };
    const lyricText = s.lines.join('\n');
    slide.addText(lyricText, { x:0.6,y:0.6,w:12.1,h:6.3, fontSize:l.slideTextoTamanho*0.85, bold:true, color:'FFFFFF', align:alinhaPptx[l.slideTextoAlinhamento]||'center', valign:'middle', lineSpacingMultiple:l.slideAlturaLinha, charSpacing:l.slideEspacamento });
  });

  const nomePartesSlides = [l.artista, l.titulo||'Sem título'].filter(Boolean);
  const nomeArquivoSlides = nomePartesSlides.join(' - ').replace(/[\/\\:*?"<>|]/g,'').trim();
  pres.writeFile({ fileName: `${nomeArquivoSlides}.pptx` });
}

