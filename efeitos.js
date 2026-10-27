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

/* ================= Efeitos v14.2 (rodada 2: F1–F20; CSS no bloco "Efeitos v14.2" do style.css) ================= */
/* F1: pílula grafite que escorrega até a aba aberta (barra de baixo no celular, lateral no computador) */
function efPilula(){
  const nav = document.querySelector('.bottom-nav'), at = nav && nav.querySelector('.nav-item.active');
  if(!nav || !at) return;
  let p = nav.querySelector('.nav-pilula');
  if(!p){ p = document.createElement('i'); p.className = 'nav-pilula'; p.setAttribute('aria-hidden', 'true'); nav.prepend(p); nav.classList.add('com-pilula'); }
  const rn = nav.getBoundingClientRect(), ra = at.getBoundingClientRect();
  Object.assign(p.style, { left: (ra.left - rn.left) + 'px', top: (ra.top - rn.top) + 'px', width: ra.width + 'px', height: ra.height + 'px' });
}
if(efeitosLigados){ requestAnimationFrame(efPilula); addEventListener('resize', ()=>requestAnimationFrame(efPilula)); }

/* F4: topo de vidro depois de rolar um pouco */
addEventListener('scroll', ()=>document.body.classList.toggle('ef-rolou', scrollY > 6), { passive: true });

/* F5: puxar para atualizar (só toque, só no topo da tela, sem tela cheia ou janela aberta) */
(function(){
  if(!efeitosLigados || !('ontouchstart' in window)) return;
  const ind = document.createElement('div'); ind.className = 'ef-puxar'; ind.innerHTML = '<i></i>'; ind.setAttribute('aria-hidden', 'true');
  document.body.appendChild(ind);
  let y0 = null, dy = 0;
  const livre = ()=>!document.querySelector('.fullpage.active, .modal-overlay.active, .lv-fab-menu.aberto') && scrollY <= 0;
  addEventListener('touchstart', e=>{ y0 = livre() && !e.target.closest('input, textarea, select, .fluxo-wrap') ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  addEventListener('touchmove', e=>{
    if(y0 === null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    if(dy < 8){ ind.style.opacity = 0; return; }
    const p = Math.min(1, dy / 110);
    ind.style.opacity = p; ind.style.transform = `translateY(${Math.min(70, dy * .55) - 40}px)`;
    ind.firstChild.style.setProperty('--efg', Math.round(p * 100) + '%');
  }, { passive: true });
  addEventListener('touchend', async ()=>{
    if(y0 === null) return; y0 = null;
    if(dy < 110){ ind.style.opacity = 0; ind.style.transform = ''; return; }
    ind.classList.add('solto');
    try{ if(typeof salvarPendente !== 'undefined' && (salvarPendente || persistTimer)) await persistAgora(); }catch(e){}
    setTimeout(()=>location.reload(), 500);
  });
})();

/* F15: dígitos girando como painel de aeroporto (o texto volta igual no fim) */
function efPainel(el){
  if(!efeitosLigados || !el || el.querySelector('.ef-painel')) return;
  const txt = el.textContent; if(!/\d/.test(txt)) return;
  let n = 0;
  el.innerHTML = `<span class="ef-painel">${[...txt].map(c=>/\d/.test(c) ? `<b><i style="animation-delay:${(n++ * .06).toFixed(2)}s">${c}</i></b>` : lvEsc(c)).join('')}</span>`;
  setTimeout(()=>{ if(el.querySelector('.ef-painel')) el.textContent = txt; }, 1300 + n * 60);
}

/* F14: anel das horas trabalhadas hoje (de 8 h), dentro da placa do Ponto */
const EF_DIA_MIN = 480;
function efAnelHoje(){
  const placa = document.querySelector('#aba-ponto .ponto-placa'); if(!placa || typeof dayTotalMinutes !== 'function') return;
  const hoje = new Date(), mKey = monthKey(hoje);
  const d = state.ponto && state.ponto.days && (state.ponto.days[mKey] || {})[String(hoje.getDate())];
  const min = d ? dayTotalMinutes(d) : 0, p = Math.min(1, min / EF_DIA_MIN), C = 2 * Math.PI * 28;
  const h = Math.floor(min / 60), m = String(Math.round(min % 60)).padStart(2, '0');
  let el = placa.querySelector('.ef-anel-hoje');
  if(!el){
    el = document.createElement('div'); el.className = 'ef-anel-hoje'; el.setAttribute('aria-label', 'Horas de hoje');
    el.innerHTML = `<svg viewBox="0 0 68 68" width="68" height="68"><circle cx="34" cy="34" r="28" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="6"/><circle class="f" cx="34" cy="34" r="28" fill="none" stroke="#c9a86a" stroke-width="6" stroke-linecap="round" transform="rotate(-90 34 34)" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}"/><text x="34" y="35" text-anchor="middle" font-size="13" font-weight="400" fill="#f1efe9"></text><text x="34" y="48" text-anchor="middle" font-size="7.5" letter-spacing=".8" fill="rgba(241,239,233,.6)">HOJE</text></svg>`;
    placa.appendChild(el);
  }
  el.querySelector('text').textContent = `${h}h${m}`;
  requestAnimationFrame(()=>el.querySelector('circle.f').setAttribute('stroke-dashoffset', (C * (1 - p)).toFixed(1)));
}

/* F12: no Assistente, arrastar um item para a esquerda tira ele da lista */
(function(){
  let at = null, x0 = 0, y0 = 0, dx = 0, dec = '';
  document.addEventListener('pointerdown', e=>{
    const it = e.target.closest('.atz-it'); if(!it || e.target.closest('button, select, input, label')) return;
    at = it; x0 = e.clientX; y0 = e.clientY; dx = 0; dec = '';
  });
  document.addEventListener('pointermove', e=>{
    if(!at) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if(!dec){ if(Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.5) dec = 'x'; else if(Math.abs(my) > 10) { at = null; return; } else return; }
    dx = Math.min(0, mx); at.classList.add('ef-arrasta'); at.style.transform = `translateX(${dx}px)`;
  });
  const soltar = ()=>{
    if(!at) return; const it = at; at = null;
    it.classList.remove('ef-arrasta');
    const bt = it.querySelector('.atz-tirar'), k = bt && /atzTirarItem\((\d+)\)/.exec(bt.getAttribute('onclick') || '');
    if(dx < -110 && k){ it.classList.add('ef-sai'); it.style.transform = 'translateX(-110%)'; setTimeout(()=>atzTirarItem(+k[1]), 230); }
    else it.style.transform = '';
  };
  document.addEventListener('pointerup', soltar); document.addEventListener('pointercancel', soltar);
})();

/* ganchos da rodada 2 */
efDepois('switchAba', ()=>requestAnimationFrame(efPilula));
/* ao abrir uma aba: cartões em leque, curva se desenhando, calendários virando, painel nas Vendas, anel no Ponto */
efDepois('efeitoAoTrocarAba', (_, __)=>{
  if(!efeitosLigados) return;
  const marcar = (el, cls, ms)=>{ if(!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(()=>el.classList.remove(cls), ms); };
  marcar(document.getElementById('resumoCarteira'), 'ef-leque', 1200);
  marcar(document.getElementById('resumoProximos'), 'ef-desenha', 2200);
  document.querySelectorAll('.aba.active').forEach(a=>marcar(a, 'ef-vira', 1000));
  if(document.getElementById('aba-vendas')?.classList.contains('active')) setTimeout(()=>document.querySelectorAll('#aba-vendas .resumo-stat-val').forEach(efPainel), 30);
  if(document.getElementById('aba-ponto')?.classList.contains('active')) efAnelHoje();
});
efDepois('renderPontoSummary', ()=>efAnelHoje());
/* música aberta: a folha entra girando */
efDepois('abrirLouvorDetalhe', ()=>{ const w = document.getElementById('lvPdfWrap'); if(!w || !efeitosLigados) return; w.classList.remove('ef-abre'); void w.offsetWidth; w.classList.add('ef-abre'); setTimeout(()=>w.classList.remove('ef-abre'), 1000); });
/* tom trocado: a letra do tom gira */
efDepois('lvTomGridEscolher', ()=>{ const t = document.getElementById('lvTomBoxValor'); if(!t || !efeitosLigados) return; t.classList.remove('ef-gira'); void t.offsetWidth; t.classList.add('ef-gira'); });
