/* ================= EFEITOS (v14.1, escolhidos pelo Davi no artefato "Efeitos do Siloé": todos os 18) =================
   Quase tudo é CSS (bloco "Efeitos v14.1" no fim do style.css). Aqui ficam os que precisam de código:
   E4 aurora na abertura e no PIN · E16 confete dourado · E17 cartão que inclina · E18 faíscas,
   e os ganchos que disparam confete/faíscas (gravar no Assistente, meta batida, venda que bate a meta,
   música pronta, mês fechado no Ponto). Tudo desliga com "reduzir movimento" (efeitosLigados, app.js). */

/* E4: manchas de cor atrás da abertura e do PIN */
function efAurora(){
  if(!efeitosLigados) return;
  document.querySelectorAll('#splash, #loginTela').forEach(el=>{
    if(el.querySelector(':scope > .ef-aurora')) return;
    el.insertAdjacentHTML('afterbegin', '<div class="ef-aurora" aria-hidden="true"><i></i><i></i><i></i></div>');
  });
}
efAurora();

/* E16: chuva curta (2 s) de confete em latão e grafite, por cima de tudo */
function efConfete(){
  if(!efeitosLigados) return;
  const cv = document.createElement('canvas');
  cv.className = 'ef-confete'; cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.width = innerWidth * dpr, h = cv.height = innerHeight * dpr, ctx = cv.getContext('2d');
  const cores = ['#c9a86a', '#f3e2ad', '#22252a', '#9a7a3e', '#8fb3a0'];
  const ps = Array.from({ length: 120 }, ()=>({ x: w / 2 + (Math.random() - .5) * w * .3, y: h * .55, vx: (Math.random() - .5) * 26 * dpr, vy: (-Math.random() * 24 - 10) * dpr,
    r: (Math.random() * 6 + 5) * dpr, c: cores[Math.random() * cores.length | 0], a: Math.random() * 6, va: (Math.random() - .5) * .4 }));
  const t0 = performance.now();
  (function quadro(t){
    ctx.clearRect(0, 0, w, h);
    ps.forEach(q=>{ q.vy += .75 * dpr; q.vx *= .99; q.x += q.vx; q.y += q.vy; q.a += q.va;
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a); ctx.fillStyle = q.c; ctx.fillRect(-q.r / 2, -q.r / 4, q.r, q.r / 2); ctx.restore(); });
    if(t - t0 < 2000) requestAnimationFrame(quadro); else cv.remove();
  })(t0);
}

/* E18: faíscas douradas saindo de um elemento (uma vez) */
function efFaiscas(el){
  if(!efeitosLigados || !el) return;
  const r = el.getBoundingClientRect(); if(!r.width) return;
  const box = document.createElement('div');
  box.className = 'ef-faiscas'; box.setAttribute('aria-hidden', 'true');
  box.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px`;
  for(let i = 0; i < 16; i++){
    const s = document.createElement('i'), ang = Math.random() * Math.PI * 2, dist = 40 + Math.random() * Math.max(50, r.width * .45);
    s.style.cssText = `--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist - 24}px;animation-delay:${(Math.random() * .35).toFixed(2)}s`;
    box.appendChild(s);
  }
  document.body.appendChild(box);
  setTimeout(()=>box.remove(), 1600);
}

/* E17: cartões dos bancos e frente do cartão de crédito inclinam e o reflexo segue o dedo/mouse */
const EF_INCLINA = '.cc, .ct-face';
document.addEventListener('pointermove', e=>{
  if(!efeitosLigados) return;
  const c = e.target.closest && e.target.closest(EF_INCLINA); if(!c) return;
  const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  c.classList.add('ef-inclina');
  c.style.setProperty('--efx', (x * 100).toFixed(1) + '%'); c.style.setProperty('--efy', (y * 100).toFixed(1) + '%');
  c.style.transform = `perspective(600px) rotateY(${((x - .5) * 16).toFixed(2)}deg) rotateX(${((.5 - y) * 16).toFixed(2)}deg)`;
}, { passive: true });
['pointerleave', 'pointerup', 'pointercancel'].forEach(ev=>document.addEventListener(ev, e=>{
  const c = e.target.closest && e.target.closest(EF_INCLINA); if(!c) return;
  c.style.transform = ''; c.classList.remove('ef-inclina');
}, true));

/* ganchos: as funções do app continuam as mesmas; aqui só se soma o efeito depois que elas rodam */
function efDepois(nome, depois){
  const orig = window[nome]; if(typeof orig !== 'function') return;
  window[nome] = function(...a){
    const antes = depois.antes ? depois.antes(...a) : undefined;
    const r = orig.apply(this, a);
    if(r && typeof r.then === 'function') r.then(v=>{ try{ depois(antes, v); }catch(e){} });
    else { try{ depois(antes, r); }catch(e){} }
    return r;
  };
}
/* Assistente: gravou → confete */
efDepois('atzGravar', Object.assign((antes)=>{ if(atzItens.filter(atzGravavel).length < antes) efConfete(); }, { antes: ()=>atzItens.filter(atzGravavel).length }));
/* meta de economia batida → confete + faíscas */
efDepois('metaMexerOk', Object.assign((antes)=>{
  if(!antes) return;
  const m = metasEconomia().find(x=>x.id === antes.id);
  if(m && m.alvo && antes.g < m.alvo && (Number(m.guardado) || 0) >= m.alvo){ efConfete(); efFaiscas(document.getElementById('modalReserva')?.querySelector('.modal')); }
}, { antes: ()=>{ const mm = metaMexendo; const m = mm && metasEconomia().find(x=>x.id === mm.id); return m ? { id: m.id, g: Number(m.guardado) || 0 } : null; } }));
/* venda que bate a meta do mês → confete + faíscas na meta */
efDepois('salvarVenda', Object.assign((antes)=>{
  const v = typeof calcularAvisosVendas === 'function' ? calcularAvisosVendas() : null;
  if(antes > 0.005 && v && !(v.falta > 0.005)){ efConfete(); setTimeout(()=>efFaiscas(document.querySelector('#vendasConteudo .vd-meta-linha') || document.getElementById('vendasConteudo')), 300); }
}, { antes: ()=>{ const v = typeof calcularAvisosVendas === 'function' ? calcularAvisosVendas() : null; return v ? v.falta : 0; } }));
/* música marcada como Pronta → faíscas no botão */
efDepois('toggleLouvorStatus', ()=>{ const l = getLouvorAtual(); if(l && l.status === 'finalizada') efFaiscas(document.getElementById('lvStatusBtn')); });
/* Ponto: mês fechado → confete */
efDepois('concluirMesAtual', ()=>{ setTimeout(()=>{ if(!document.querySelector('.modal-overlay.active')) efConfete(); }, 200); });
