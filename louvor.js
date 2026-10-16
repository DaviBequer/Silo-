
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
  renderLvRoteiro();
  renderLouvorLista();
}

/* ---------- Roteiro: checklist dos louvores a criar ----------
   Marcar um item: se já existe louvor com esse nome, abre ele; senão abre "Novo louvor" preenchido
   e o item só fica marcado quando o louvor for criado. */
let lvRoteiroAberto = (()=>{ try{ return localStorage.getItem('siloe-lv-roteiro')==='1'; }catch(e){ return false; } })();
let lvRoteiroPendenteId = null;
function lvRoteiroLista(){ if(!state.louvorRoteiro) state.louvorRoteiro = []; return state.louvorRoteiro; }
function lvMesmoNome(a, b){ return String(a||'').trim().toLowerCase() === String(b||'').trim().toLowerCase(); }
/* cabeçalho abre/fecha (sem argumento alterna) */
function toggleLvRoteiro(v){
  lvRoteiroAberto = v === undefined ? !lvRoteiroAberto : !!v;
  try{ localStorage.setItem('siloe-lv-roteiro', lvRoteiroAberto?'1':'0'); }catch(e){}
  renderLvRoteiro();
}
function renderLvRoteiro(){
  const el = document.getElementById('lvRoteiro'), corpo = document.getElementById('lvRotCorpo');
  if(!el || !corpo) return;
  const aFazer = lvRoteiroLista().filter(i=>!i.feito).length;
  document.getElementById('lvRotConta').textContent = aFazer ? `${aFazer} a criar` : '';
  el.classList.toggle('aberto', lvRoteiroAberto);
  document.getElementById('lvRotHead')?.setAttribute('aria-expanded', lvRoteiroAberto ? 'true' : 'false');
  if(!lvRoteiroAberto){ corpo.innerHTML = ''; return; }
  const itens = lvRoteiroLista().slice().sort((a,b)=> (a.feito?1:0)-(b.feito?1:0) || (a.criadoEm||0)-(b.criadoEm||0));
  const linhas = itens.map(it=>{
    const lv = it.louvorId && state.louvores.find(l=>l.id===it.louvorId);
    const st = it.feito ? (lv ? (lv.status==='finalizada'?'Finalizado':'Em produção') : 'Criado') : '';
    return `<div class="lv-rot-item${it.feito?' feito':''}">
      <button type="button" class="lv-rot-check" onclick="marcarLvRoteiro('${it.id}')" aria-label="${it.feito?'Desmarcar':'Marcar e criar'}">${it.feito?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>':''}</button>
      <div class="lv-rot-info" ${lv?`onclick="abrirLouvorDetalhe('${lv.id}')"`:''}>
        <div class="lv-rot-titulo">${lvEsc(it.titulo)}</div>
        <div class="lv-rot-meta">${lvEsc(it.artista||'Sem cantor')}${st?' · '+st:''}</div>
      </div>
      <button type="button" class="btn-icon-sm" onclick="excluirLvRoteiro('${it.id}')" title="Remover" aria-label="Remover"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
    </div>`;
  }).join('');
  corpo.innerHTML = `${linhas || '<div class="lv-rot-vazio">Nenhum louvor no roteiro ainda</div>'}
    <form class="lv-rot-novo" onsubmit="event.preventDefault();adicionarLvRoteiro()">
      <input type="text" id="lvRotTitulo" placeholder="Música" autocomplete="off">
      <input type="text" id="lvRotArtista" placeholder="Cantor" autocomplete="off">
      <button type="submit" class="lv-rot-add" aria-label="Adicionar ao roteiro"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg></button>
    </form>`;
}
function adicionarLvRoteiro(){
  const t = document.getElementById('lvRotTitulo'), a = document.getElementById('lvRotArtista');
  const titulo = t.value.trim();
  if(!titulo){ t.focus(); return; }
  lvRoteiroLista().push({ id:'rot_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), titulo, artista:a.value.trim(), feito:false, louvorId:'', criadoEm:Date.now() });
  persist();
  renderLvRoteiro();
  document.getElementById('lvRotTitulo')?.focus();
}
function excluirLvRoteiro(id){
  state.louvorRoteiro = lvRoteiroLista().filter(i=>i.id!==id);
  persist();
  renderLvRoteiro();
}
function marcarLvRoteiro(id){
  const it = lvRoteiroLista().find(i=>i.id===id);
  if(!it) return;
  if(it.feito){ it.feito = false; it.louvorId = ''; persist(); renderLvRoteiro(); return; }
  const existente = state.louvores.find(l=>lvMesmoNome(l.titulo, it.titulo));
  if(existente){
    it.feito = true; it.louvorId = existente.id;
    persist(); renderLvRoteiro();
    abrirLouvorDetalhe(existente.id);
    return;
  }
  openLouvorForm();
  document.getElementById('lvNovoTitulo').value = it.titulo;
  document.getElementById('lvNovoArtista').value = it.artista || '';
  lvRoteiroPendenteId = it.id;
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
    el.innerHTML = `<div class="empty-state"><div class="title">Nenhum louvor encontrado</div><div class="desc">Toque no + para adicionar</div></div>`;
    return;
  }
  el.innerHTML = items.map(l=>{
    ensureLouvorConfig(l);
    const tomAtual = lvTomAtual(l);
    let badges = '';
    if(louvorFiltroAtivo === 'Atual'){
      const finalizada = l.status === 'finalizada';
      badges = `<div class="lv-card-badges">
        ${l.dataAgendamento ? `<span class="lv-card-data">${l.dataAgendamento.split('-').reverse().join('/')}</span>` : ''}
        <span class="lv-card-status${finalizada?' finalizada':''}">${finalizada?'Finalizado':'Em Produção'}</span>
      </div>`;
    }
    return `<div class="lv-card" onclick="abrirLouvorDetalhe('${l.id}')">
      <div class="lv-card-info">
        <div class="lv-card-titulo">${l.titulo||'Sem título'}</div>
        <div class="lv-card-meta">${l.medley ? `Medley · ${l.medley.musicas.length} música${l.medley.musicas.length===1?'':'s'}` : (l.artista||'Artista desconhecido')} · ${l.categoria||'Louvor'}</div>
        ${badges}
      </div>
      ${tomAtual?`<div class="lv-card-tom">${tomAtual}</div>`:''}
    </div>`;
  }).join('');
}

/* ---------- Novo louvor ---------- */
function openLouvorForm(){
  lvRoteiroPendenteId = null;
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
  /* veio do Roteiro: marca o item como criado */
  const rot = lvRoteiroPendenteId && lvRoteiroLista().find(i=>i.id===lvRoteiroPendenteId);
  if(rot){ rot.feito = true; rot.louvorId = id; }
  lvRoteiroPendenteId = null;
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
  if(typeof lvAoAbrirDetalhe==='function') lvAoAbrirDetalhe(l);
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
  lvAtualizarEditor();
  if(typeof lvAtualizarBtnOrganizar==='function') lvAtualizarBtnOrganizar();
  window.scrollTo(0,0);
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
function salvarLouvorCampo(){
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
  if(tab==='edicao'){ document.getElementById('lvPanelEdicao').classList.add('active'); lvAtualizarEditor(); }
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
function lvNotasEquivalentes(a,b){
  if(!a || !b) return false;
  const ia = lvPc(a), ib = lvPc(b);
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
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return tokens.every(t=>LV_CHORD_RE.test(t));
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
  const semVezes = t=>String(t||'').trim().toLowerCase().replace(/\s*\(?\d+\s*x\)?$/,'');   // "Refrão 2x" = "Refrão"
  slides.forEach(s=>{
    if(/^♪/.test(s.label||'')){ originais = []; return; }   // medley: começou outra música, o "Repete" vale só dentro dela
    const rep = /^repete\b\s*[-–:]?\s*(.*)$/i.exec(s.label||'');
    if(rep && !s.lines.length){
      const alvo = semVezes(rep[1]);
      expandidos.push(...originais.filter(o=>semVezes(o.label)===alvo).map(o=>({ label:o.label, lines:o.lines.slice() })));
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
      const musica = /^♪\s*(.+?)(?:\s+—\s+Tom\s+(\S+))?$/.exec(it.label);   // medley: começo de cada música
      /* a primeira parte de cada música fica no mesmo bloco do nome dela (não se separam entre colunas) */
      if(musica || !(aberta && /^<div class="lv-sheet-musica"/.test(blocoHtml) && !/lv-sheet-section/.test(blocoHtml))) fecha();
      abre(); nSecoes++;
      if(musica){ blocoHtml += `<div class="lv-sheet-musica" data-si="${it.idx}"><b>${lvEsc(musica[1])}</b>${musica[2]?`<span>Tom ${lvEsc(musica[2])}</span>`:''}</div>`; return; }
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
  document.body.style.overflow = ligar ? 'hidden' : '';
  try{
    if(ligar && wrap.requestFullscreen && !document.fullscreenElement) wrap.requestFullscreen().catch(()=>{});
    if(!ligar && document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  }catch(e){}
  if(ligar) wrap.scrollTop = 0;
  lvAjustarZoomFolha();
}
/* saiu da tela cheia do navegador (Esc, gesto de voltar): sai do modo também */
document.addEventListener('fullscreenchange', ()=>{
  if(!document.fullscreenElement && document.getElementById('lvPdfWrap')?.classList.contains('lv-tela-cheia')) lvTelaCheia(false);
});
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape' && document.getElementById('lvPdfWrap')?.classList.contains('lv-tela-cheia')) lvTelaCheia(false);
});
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

  const tomRaiz = lvTomAtual(l);
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
  });

  const nomePartesSlides = [l.artista, l.titulo||'Sem título'].filter(Boolean);
  const nomeArquivoSlides = nomePartesSlides.join(' - ').replace(/[\/\\:*?"<>|]/g,'').trim();
  pres.writeFile({ fileName: `${nomeArquivoSlides}.pptx` });
}

