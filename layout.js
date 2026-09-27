/* ================= EDITOR DE LAYOUT (Dashboard + Planner) =================
   Ativado pelo botão no header. Desktop: arrastar, redimensionar e travar cards
   num grid de 12 colunas. Mobile: só arrastar pra reordenar (sem redimensionar). */

const ICON_LAY_DRAG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
const ICON_LAY_LOCK_OPEN = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
const ICON_LAY_LOCK_CLOSED = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

const LAYOUT_GROUPS = {
  panoResumo: { selector:'#panoPanelResumo', defaultSpan:4 },
  panoContas: { selector:'#panoPanelContas', defaultSpan:12 },
  planner:    { selector:'#aba-planner',     defaultSpan:4, masonry:true }
};

/* Masonry fino por linhas (efeito Pinterest sem espaço sobrando): cada bloco
   ganha um grid-row-end calculado pela sua própria altura, numa unidade de
   linha bem pequena, e um ResizeObserver mantém isso atualizado sozinho
   sempre que o bloco muda de altura (seção que colapsa, conteúdo que muda,
   redimensionamento manual etc.), sem precisar recalcular em cada tela. */
const MASONRY_ROW = 8;
const masonryObserved = new WeakSet();
function masonryUpdateSpan(el, container){
  const cs = getComputedStyle(container);
  const rowGap = parseFloat(cs.rowGap)||0;
  const h = el.getBoundingClientRect().height;
  if(!h) return;
  const span = Math.max(1, Math.ceil((h+rowGap)/(MASONRY_ROW+rowGap)));
  el.style.gridRowEnd = 'span '+span;
}
function masonryObserve(el, container){
  if(masonryObserved.has(el)) return;
  masonryObserved.add(el);
  new ResizeObserver(()=>masonryUpdateSpan(el, container)).observe(el);
}
function applyMasonryRows(groupKey, container, bp){
  if(!LAYOUT_GROUPS[groupKey].masonry) return;
  Array.from(container.children).forEach(el=>{
    if(el.nodeType!==1) return;
    if(bp==='desktop'){ masonryUpdateSpan(el, container); masonryObserve(el, container); }
    else { el.style.gridRowEnd=''; }
  });
}

let layoutEditActive = false;

function currentBp(){
  return (window.matchMedia && window.matchMedia('(min-width:1024px)').matches) ? 'desktop' : 'mobile';
}
function ensureLayoutPrefs(groupKey, bp){
  if(!state.layoutPrefs) state.layoutPrefs = {};
  if(!state.layoutPrefs[groupKey]) state.layoutPrefs[groupKey] = {};
  if(!state.layoutPrefs[groupKey][bp]) state.layoutPrefs[groupKey][bp] = { order:[], w:{}, h:{}, locked:{} };
  const p = state.layoutPrefs[groupKey][bp];
  if(!p.order) p.order=[]; if(!p.w) p.w={}; if(!p.h) p.h={}; if(!p.locked) p.locked={};
  return p;
}
function isLayoutFixedEl(el){
  return el.classList.contains('user-tabs') || el.classList.contains('plan-faixa') || el.dataset.layoutFixed==='1';
}
function getLayoutItems(groupKey){
  const cfg = LAYOUT_GROUPS[groupKey];
  const container = document.querySelector(cfg.selector);
  if(!container) return { container:null, items:[] };
  const items = Array.from(container.children).filter(el=>el.nodeType===1 && !isLayoutFixedEl(el));
  items.forEach((el,i)=>{ if(!el.dataset.lid) el.dataset.lid = el.id ? ('id-'+el.id) : (groupKey+'-i'+i); });
  return { container, items };
}
function parseGridSpan(v){
  const m = /span\s+(\d+)/.exec(v||'');
  return m ? parseInt(m[1]) : null;
}

function applyLayout(groupKey){
  const cfg = LAYOUT_GROUPS[groupKey];
  const { container, items } = getLayoutItems(groupKey);
  if(!container) return;
  const bp = currentBp();
  const prefs = ensureLayoutPrefs(groupKey, bp);
  if(prefs.order.length){
    const byId = {}; items.forEach(el=>byId[el.dataset.lid]=el);
    const ordenados = prefs.order.map(id=>byId[id]).filter(Boolean);
    const resto = items.filter(el=>!prefs.order.includes(el.dataset.lid));
    ordenados.concat(resto).forEach(el=>container.appendChild(el));
  }
  items.forEach(el=>{
    const lid = el.dataset.lid;
    const locked = !!prefs.locked[lid];
    el.dataset.locked = locked ? '1' : '0';
    el.classList.toggle('lay-locked', locked);
    if(bp==='desktop'){
      const span = prefs.w[lid] || cfg.defaultSpan;
      el.style.gridColumn = 'span '+span;
      if(prefs.h[lid]){ el.style.height = prefs.h[lid]; el.style.overflow = 'auto'; }
      else { el.style.height=''; el.style.overflow=''; }
    } else {
      el.style.gridColumn=''; el.style.height=''; el.style.overflow='';
    }
  });
  applyMasonryRows(groupKey, container, bp);
}
function applyAllLayouts(){ Object.keys(LAYOUT_GROUPS).forEach(applyLayout); }

function saveOrder(groupKey, container){
  const bp = currentBp();
  const prefs = ensureLayoutPrefs(groupKey, bp);
  prefs.order = Array.from(container.children).filter(c=>c.dataset && c.dataset.lid).map(c=>c.dataset.lid);
  persist();
}

function flipReorder(container, mutate){
  const items = Array.from(container.children).filter(c=>c.dataset && c.dataset.lid);
  const antes = new Map(items.map(it=>[it, it.getBoundingClientRect()]));
  mutate();
  Array.from(container.children).filter(c=>c.dataset && c.dataset.lid).forEach(it=>{
    const f = antes.get(it);
    if(!f) return;
    const l = it.getBoundingClientRect();
    const dx = f.left-l.left, dy = f.top-l.top;
    if(dx || dy){
      it.style.transition = 'none';
      it.style.transform = `translate(${dx}px,${dy}px)`;
      requestAnimationFrame(()=>{
        it.style.transition = 'transform .22s var(--ease)';
        it.style.transform = '';
      });
    }
  });
}

function startLayoutDrag(e, groupKey, el, container){
  if(el.dataset.locked==='1') return;
  e.preventDefault();
  try{ e.target.setPointerCapture(e.pointerId); }catch(err){}
  el.classList.add('lay-dragging');
  document.body.classList.add('lay-dragging-active');
  let lastAlvo = null;
  function onMove(ev){
    el.style.pointerEvents='none';
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    el.style.pointerEvents='';
    const alvo = under && under.closest ? under.closest('[data-lid]') : null;
    if(alvo && alvo!==el && alvo.parentElement===container && alvo.dataset.locked!=='1' && alvo!==lastAlvo){
      lastAlvo = alvo;
      flipReorder(container, ()=>{
        const depois = !!(el.compareDocumentPosition(alvo) & Node.DOCUMENT_POSITION_FOLLOWING);
        if(depois) container.insertBefore(el, alvo.nextSibling);
        else container.insertBefore(el, alvo);
      });
    }
  }
  function onUp(){
    el.classList.remove('lay-dragging');
    document.body.classList.remove('lay-dragging-active');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    saveOrder(groupKey, container);
  }
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function startLayoutResize(e, groupKey, el, container){
  if(el.dataset.locked==='1') return;
  e.preventDefault(); e.stopPropagation();
  try{ e.target.setPointerCapture(e.pointerId); }catch(err){}
  const startX=e.clientX, startY=e.clientY;
  const cs = getComputedStyle(container);
  const gap = parseFloat(cs.columnGap)||0;
  const colW = (container.clientWidth - gap*11)/12;
  const startSpan = parseGridSpan(el.style.gridColumn) || LAYOUT_GROUPS[groupKey].defaultSpan;
  const startH = el.offsetHeight;
  function onMove(ev){
    const dx = ev.clientX-startX, dy = ev.clientY-startY;
    let span = Math.round(startSpan + dx/(colW+gap));
    span = Math.max(3, Math.min(12, span));
    el.style.gridColumn = 'span '+span;
    el.style.height = Math.max(90, startH+dy)+'px';
    el.style.overflow = 'auto';
  }
  function onUp(){
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    const bp = currentBp();
    const prefs = ensureLayoutPrefs(groupKey, bp);
    prefs.w[el.dataset.lid] = parseGridSpan(el.style.gridColumn);
    prefs.h[el.dataset.lid] = el.style.height;
    persist();
  }
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function toggleLayoutLock(groupKey, el, btn){
  const bp = currentBp();
  const prefs = ensureLayoutPrefs(groupKey, bp);
  const locked = !prefs.locked[el.dataset.lid];
  prefs.locked[el.dataset.lid] = locked;
  el.dataset.locked = locked ? '1':'0';
  el.classList.toggle('lay-locked', locked);
  persist();
  btn.classList.toggle('active', locked);
  btn.title = locked ? 'Destravar' : 'Travar';
  btn.innerHTML = locked ? ICON_LAY_LOCK_CLOSED : ICON_LAY_LOCK_OPEN;
}

function injectLayoutToolbar(groupKey, el, container){
  if(el.querySelector(':scope > .lay-toolbar')) return;
  const locked = el.dataset.locked==='1';
  const bar = document.createElement('div');
  bar.className = 'lay-toolbar';
  bar.innerHTML = `<button type="button" class="lay-btn lay-drag" title="Arrastar">${ICON_LAY_DRAG}</button>
    <button type="button" class="lay-btn lay-lock ${locked?'active':''}" title="${locked?'Destravar':'Travar'}">${locked?ICON_LAY_LOCK_CLOSED:ICON_LAY_LOCK_OPEN}</button>`;
  el.appendChild(bar);
  bar.querySelector('.lay-drag').addEventListener('pointerdown', e=>startLayoutDrag(e, groupKey, el, container));
  bar.querySelector('.lay-lock').addEventListener('click', e=>{ e.stopPropagation(); toggleLayoutLock(groupKey, el, e.currentTarget); });
  if(currentBp()==='desktop'){
    const rz = document.createElement('div');
    rz.className = 'lay-resize';
    rz.title = 'Redimensionar';
    el.appendChild(rz);
    rz.addEventListener('pointerdown', e=>startLayoutResize(e, groupKey, el, container));
  }
}
function removeLayoutToolbars(){
  document.querySelectorAll('.lay-toolbar, .lay-resize').forEach(n=>n.remove());
}

function toggleLayoutEditMode(){
  layoutEditActive = !layoutEditActive;
  document.body.classList.toggle('lay-editing', layoutEditActive);
  const btn = document.getElementById('btnLayoutEdit');
  if(btn){
    btn.classList.toggle('active', layoutEditActive);
    btn.title = layoutEditActive ? 'Concluir edição de layout' : 'Editar layout';
  }
  if(layoutEditActive){
    Object.keys(LAYOUT_GROUPS).forEach(groupKey=>{
      const { container, items } = getLayoutItems(groupKey);
      if(!container) return;
      items.forEach(el=>injectLayoutToolbar(groupKey, el, container));
    });
  } else {
    removeLayoutToolbars();
  }
}

function updateLayoutBtnVisibility(aba){
  const btn = document.getElementById('btnLayoutEdit');
  if(!btn) return;
  const mostrar = (aba==='panorama' || aba==='planner');
  btn.style.display = mostrar ? '' : 'none';
  if(!mostrar && layoutEditActive) toggleLayoutEditMode();
}

let layResizeTimer = null;
window.addEventListener('resize', ()=>{
  clearTimeout(layResizeTimer);
  layResizeTimer = setTimeout(()=>{
    applyAllLayouts();
    if(layoutEditActive){
      removeLayoutToolbars();
      Object.keys(LAYOUT_GROUPS).forEach(groupKey=>{
        const { container, items } = getLayoutItems(groupKey);
        if(!container) return;
        items.forEach(el=>injectLayoutToolbar(groupKey, el, container));
      });
    }
  }, 200);
});
