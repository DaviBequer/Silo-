/* ================= LAYOUT DOS CARTÕES (aba Finanças) =================
   No computador, os cartões ficam num grid de 12 colunas (largura de cada um vem de data-span no HTML)
   e se encaixam como um mural, sem buraco entre eles. No celular, um embaixo do outro. */

const LAYOUT_GROUPS = {
  planner: { selector:'#aba-planner', defaultSpan:4, masonry:true }
};

/* Masonry fino por linhas: cada bloco ganha um grid-row-end calculado pela própria altura
   (linhas de 1px) e um ResizeObserver mantém isso atualizado sozinho quando o bloco muda de altura. */
const masonryObserved = new WeakSet();
function masonryUpdateSpan(el, container){
  /* row-gap 0: cada bloco ocupa a própria altura + o espaço entre colunas, então a distância fica igual em todo lado */
  const gap = parseFloat(getComputedStyle(container).columnGap)||0;
  const h = el.getBoundingClientRect().height;
  if(!h) return;
  el.style.gridRowEnd = 'span '+Math.max(1, Math.ceil(h+gap));
}
function masonryObserve(el, container){
  if(masonryObserved.has(el)) return;
  masonryObserved.add(el);
  new ResizeObserver(()=>masonryUpdateSpan(el, container)).observe(el);
}
function currentBp(){
  return (window.matchMedia && window.matchMedia('(min-width:1024px)').matches) ? 'desktop' : 'mobile';
}
function isLayoutFixedEl(el){
  return el.classList.contains('user-tabs') || el.classList.contains('dash-tabs') || el.dataset.layoutFixed==='1';
}
function applyLayout(groupKey){
  const cfg = LAYOUT_GROUPS[groupKey];
  const container = document.querySelector(cfg.selector);
  if(!container) return;
  const desktop = currentBp()==='desktop';
  Array.from(container.children).forEach(el=>{
    if(el.nodeType!==1) return;
    /* fixos (abas, versículo) ocupam a linha toda: só precisam da altura certa para não ficar por cima do resto */
    if(isLayoutFixedEl(el)){
      if(cfg.masonry){
        if(desktop){ masonryUpdateSpan(el, container); masonryObserve(el, container); }
        else el.style.gridRowEnd = '';
      }
      return;
    }
    el.style.gridColumn = desktop ? 'span '+(parseInt(el.dataset.span) || cfg.defaultSpan) : '';
    if(cfg.masonry){
      if(desktop){ masonryUpdateSpan(el, container); masonryObserve(el, container); }
      else el.style.gridRowEnd = '';
    }
  });
}
function applyAllLayouts(){ Object.keys(LAYOUT_GROUPS).forEach(applyLayout); }

let layResizeTimer = null;
window.addEventListener('resize', ()=>{
  clearTimeout(layResizeTimer);
  layResizeTimer = setTimeout(applyAllLayouts, 200);
});
