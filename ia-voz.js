/* ========== IA-VOZ — assistente por voz inteligente (botão flutuante em todas as abas) ==========
   Ouve com pausa longa (3s de silêncio), manda para a função "ia-voz" no Supabase (Gemini) e executa as ações. */

const IAV_SILENCIO_MS = 3000;
let iavRec = null, iavTexto = '', iavAtual = '', iavTimer = null, iavFecha = null, iavAtivo = false, iavRefs = {};

function iavCriarUI(){
  if(document.getElementById('iavBtn')) return;
  const b = document.createElement('button');
  b.id = 'iavBtn'; b.type = 'button'; b.setAttribute('aria-label','Assistente de voz');
  b.innerHTML = VOZ_MIC_SVG.replace(/width="16" height="16"/,'width="24" height="24"');
  b.onclick = iavAlternar;
  const p = document.createElement('div');
  p.id = 'iavPainel';
  document.body.appendChild(p); document.body.appendChild(b);
  const st = document.createElement('style');
  st.textContent = `
  #iavBtn{position:fixed;right:16px;bottom:calc(84px + env(safe-area-inset-bottom,0px));width:54px;height:54px;border-radius:50%;border:none;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(0,0,0,.35);z-index:300;cursor:pointer}
  #iavBtn.ouvindo{background:var(--danger);animation:micPulse 1s ease-in-out infinite}
  #iavBtn.pensando{opacity:.6;pointer-events:none}
  #iavPainel{position:fixed;left:12px;right:82px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:300;display:none;background:var(--card,#fff);color:var(--text,#111);border:1px solid var(--line,#ddd);border-radius:20px;padding:12px 14px 14px;box-shadow:0 10px 30px rgba(0,0,0,.18);max-height:50vh;overflow:auto;font-size:14px;line-height:1.4}
  #iavPainel.show{display:block;animation:iavSobe .22s ease-out}
  @keyframes iavSobe{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  .iav-topo{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint,#999);margin-bottom:10px}
  .iav-ponto{width:8px;height:8px;border-radius:50%;background:var(--gold,#b8963e)}
  .iav-ponto.on{animation:micPulse 1s ease-in-out infinite}
  .iav-x{margin-left:auto;background:none;border:none;color:var(--text-faint,#999);font-size:18px;line-height:1;cursor:pointer;padding:0 2px}
  .iav-eu{margin-left:auto;max-width:92%;width:fit-content;background:var(--primary);color:#fff;border-radius:16px 16px 4px 16px;padding:9px 12px;font-size:15px;word-break:break-word}
  .iav-ia{margin-top:10px;background:var(--card-2,#f4f1ea);border-radius:16px 16px 16px 4px;padding:10px 12px}
  .iav-pens{font-style:italic;color:var(--text-faint,#8a8478);font-size:13px;margin-bottom:6px}
  .iav-chip{display:flex;gap:8px;align-items:flex-start;padding:6px 0;font-weight:600;font-size:13.5px;animation:iavSobe .25s ease-out both}
  .iav-chip i{font-style:normal;color:#fff;background:var(--success,#2e8b57);width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;margin-top:1px}
  .iav-fala{margin-top:6px}
  .iav-pontos{display:inline-flex;gap:4px;vertical-align:middle;margin-left:4px}
  .iav-pontos span{width:6px;height:6px;border-radius:50%;background:var(--gold,#b8963e);animation:iavPula 1s infinite ease-in-out}
  .iav-pontos span:nth-child(2){animation-delay:.15s}.iav-pontos span:nth-child(3){animation-delay:.3s}
  @keyframes iavPula{0%,80%,100%{opacity:.3;transform:scale(.8)}40%{opacity:1;transform:scale(1.1)}}`;
  document.head.appendChild(st);
}
function iavEsc(t){ return String(t||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
/* fase: 'ouvindo' | 'pensando' | 'pronto' */
function iavPainel(o){
  const el = document.getElementById('iavPainel');
  clearTimeout(iavFecha);
  if(!o){ el.classList.remove('show'); return; }
  const rotulo = o.fase==='ouvindo' ? 'Ouvindo' : o.fase==='pensando' ? 'Pensando' : 'Siloé IA';
  let h = `<div class="iav-topo"><span class="iav-ponto${o.fase!=='pronto'?' on':''}"></span>${rotulo}<button class="iav-x" onclick="iavPainel(null)" aria-label="Fechar">&times;</button></div>`;
  if(o.texto) h += `<div class="iav-eu">${iavEsc(o.texto)}</div>`;
  else if(o.fase==='ouvindo') h += `<div class="iav-pens">Pode falar… toque no microfone para enviar</div>`;
  if(o.fase==='pensando') h += `<div class="iav-ia"><div class="iav-pens">Entendendo o que você pediu<span class="iav-pontos"><span></span><span></span><span></span></span></div></div>`;
  if(o.fase==='pronto'){
    h += `<div class="iav-ia">`;
    if(o.pensamento) h += `<div class="iav-pens">${iavEsc(o.pensamento)}</div>`;
    (o.feitos||[]).forEach((f,i)=>{ h += `<div class="iav-chip" style="animation-delay:${i*0.12}s"><i>✓</i><span>${iavEsc(f)}</span></div>`; });
    if(o.fala) h += `<div class="iav-fala">${iavEsc(o.fala)}</div>`;
    h += `</div>`;
  }
  el.innerHTML = h; el.classList.add('show');
  if(o.fase==='pronto') iavFecha = setTimeout(()=>iavPainel(null), 9000);
}

function iavJunta(a,b){ return [a,b].filter(Boolean).join(' ').trim(); }

function iavAlternar(){
  if(iavAtivo){ iavEnviar(); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ showToast('Voz não disponível neste navegador'); return; }
  if(!(window.SUPABASE_URL)){ showToast('Supabase não configurado'); return; }
  iavTexto = ''; iavAtual = ''; iavAtivo = true;
  document.getElementById('iavBtn').classList.add('ouvindo');
  iavPainel({fase:'ouvindo'});
  iavTimer = setTimeout(()=>{ if(iavAtivo && !iavJunta(iavTexto,iavAtual)){ iavParar(); iavPainel(null); } }, 15000); // ninguém falou
  iavIniciarRec(SR);
}
/* Escuta em "rodadas" curtas (sem continuous): evita o bug do Android que repete as palavras */
function iavIniciarRec(SR){
  const rec = new SR();
  iavRec = rec;
  rec.lang = 'pt-BR'; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 1;
  rec.onresult = (ev)=>{
    let t = '';
    for(let i=0;i<ev.results.length;i++) t += ev.results[i][0].transcript;
    iavAtual = t.trim();
    iavPainel({fase:'ouvindo', texto:iavJunta(iavTexto, iavAtual)});
    clearTimeout(iavTimer);
    iavTimer = setTimeout(iavEnviar, IAV_SILENCIO_MS);
  };
  rec.onerror = (e)=>{
    if(e.error==='no-speech' || e.error==='aborted') return;
    showToast('Não consegui ouvir. Verifique o microfone'); iavParar(); iavPainel(null);
  };
  rec.onend = ()=>{
    if(!iavAtivo) return;
    if(iavAtual){ iavTexto = iavJunta(iavTexto, iavAtual); iavAtual = ''; }
    try{ iavIniciarRec(SR); }catch(e){ iavParar(); }
  };
  try{ rec.start(); }catch(e){ iavParar(); }
}
function iavParar(){
  iavAtivo = false; clearTimeout(iavTimer);
  const r = iavRec; iavRec = null;
  if(r){ r.onend = null; r.onresult = null; try{ r.stop(); }catch(e){} }
  document.getElementById('iavBtn').classList.remove('ouvindo');
}

/* ---------- contexto enviado à IA (só o necessário) ---------- */
function iavContexto(){
  iavRefs = {};
  const mKey = state.focusMonth;
  const mAnt = addMonths(mKey,-1);
  const contas = [];
  let n = 0;
  [mAnt, mKey].forEach(m=>{
    getContasDoMes(m).forEach(it=>{
      const pk = m+'_'+it.user+'_'+it.cat+'_'+it.id;
      if(m===mAnt && state.paid[pk]) return; // do mês anterior só as que ficaram abertas
      n++; const ref = 'c'+n;
      iavRefs[ref] = { pk, user:it.user, cat:it.cat, id:it.id, mKey:m };
      contas.push({ ref, nome:it.desc, valor:it.valor, dia:it.dia, mes:m, pago:!!state.paid[pk], categoria:it.cat });
    });
  });
  return {
    usuario: state.currentUser,
    saldoAtual: state.users[state.currentUser].saldoAtual||0,
    mesFoco: mKey, hoje: todayKey(),
    contas
  };
}

async function iavEnviar(){
  clearTimeout(iavTimer);
  const texto = iavJunta(iavTexto, iavAtual);
  iavParar();
  iavTexto = ''; iavAtual = '';
  if(!texto){ iavPainel(null); return; }
  const btn = document.getElementById('iavBtn');
  btn.classList.add('pensando'); iavPainel({fase:'pensando', texto});
  try{
    const r = await fetch(window.SUPABASE_URL+'/functions/v1/smart-handler', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'apikey':window.SUPABASE_ANON_KEY, 'Authorization':'Bearer '+window.SUPABASE_ANON_KEY },
      body: JSON.stringify({ texto, contexto: iavContexto() })
    });
    const j = await r.json();
    const feitos = [];
    for(const a of (j.acoes||[])){ const m = await iavExecutar(a); if(m) feitos.push(m); }
    iavPainel({fase:'pronto', texto, pensamento:j.pensamento, feitos, fala:j.fala});
  }catch(e){
    console.error(e);
    iavPainel({fase:'pronto', texto, fala:'Não consegui falar com a IA. Verifique a função no Supabase.'});
  }
  btn.classList.remove('pensando');
}

/* ---------- executar ações (lista fechada) ---------- */
function iavNum(v){ const n = Number(v); return isFinite(n) ? n : null; }
async function iavExecutar(a){
  const u = state.currentUser;
  switch(a && a.acao){
    case 'atualizar_saldo': {
      const v = iavNum(a.valor); if(v===null) return null;
      state.users[u].saldoAtual = v;
      renderPlanner(); renderPanorama(); persist();
      return 'Saldo atual: '+fmtMoney(v);
    }
    case 'marcar_pago': {
      let c = 0;
      (a.refs||[]).forEach(ref=>{
        const r = iavRefs[ref]; if(!r) return;
        state.paid[r.pk] = !!a.pago;
        if(a.pago && state.pagamentosParciais) delete state.pagamentosParciais[r.pk];
        c++;
      });
      if(!c) return null;
      persist(); renderPanorama(); renderPlanner();
      return c+(c===1?' conta':' contas')+(a.pago?' marcada(s) como paga(s)':' desmarcada(s)');
    }
    case 'adicionar_gasto': {
      const cat = ['fixo','assinatura','moradia'].includes(a.categoria) ? a.categoria : 'fixo';
      const v = iavNum(a.valor); const desc = String(a.desc||'').trim();
      if(!desc || v===null) return null;
      state.users[u].expenses[cat].push({ id:'g'+Date.now()+Math.floor(Math.random()*1000), desc, descricao:'', valor:v, dia:Math.min(31,Math.max(1,parseInt(a.dia)||1)), mesInicio:null, tipo:'fixa', essencial:true });
      renderPlanner(); renderPanorama(); persist();
      return 'Adicionado: '+desc+' '+fmtMoney(v);
    }
    case 'alterar_valor': {
      const r = iavRefs[a.ref]; const v = iavNum(a.valor);
      if(!r || v===null || r.cat==='futuro') return null;
      const item = getGastoItemRef(r.user, r.cat, r.id); if(!item) return null;
      if(Number(item.valor)>0 && Number(item.valor)!==v) item.historico = (item.historico||[]).concat([{ mKey:mesFinanceiroAtual(), valor:item.valor }]).slice(-6);
      item.valor = v;
      renderPlanner(); renderPanorama(); persist();
      return item.desc+' agora é '+fmtMoney(v);
    }
    case 'excluir': {
      const r = iavRefs[a.ref]; if(!r || r.user!==u) return null;
      const item = getGastoItemRef(r.user, r.cat, r.id); if(!item) return null;
      const ok = await iosConfirm('Excluir "'+item.desc+'"?');
      if(!ok) return null;
      deleteGasto(r.cat, r.id);
      return 'Excluído: '+item.desc;
    }
    case 'abrir_resumo': abrirResumoGeral(); return 'Resumo aberto';
  }
  return null;
}

window.addEventListener('load', iavCriarUI);
