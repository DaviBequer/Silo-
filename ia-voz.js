/* ========== IA-VOZ — assistente por voz inteligente (botão flutuante em todas as abas) ==========
   Ouve com pausa longa (3s de silêncio), manda para a função "ia-voz" no Supabase (Gemini) e executa as ações. */

const IAV_SILENCIO_MS = 3000;
let iavRec = null, iavTexto = '', iavTimer = null, iavAtivo = false, iavRefs = {};

function iavCriarUI(){
  if(document.getElementById('iavBtn')) return;
  const b = document.createElement('button');
  b.id = 'iavBtn'; b.type = 'button'; b.setAttribute('aria-label','Assistente de voz');
  b.innerHTML = VOZ_MIC_SVG.replace(/width="16" height="16"/,'width="24" height="24"');
  b.onclick = iavAlternar;
  const bolha = document.createElement('div');
  bolha.id = 'iavBolha';
  document.body.appendChild(bolha); document.body.appendChild(b);
  const st = document.createElement('style');
  st.textContent = `
  #iavBtn{position:fixed;right:16px;bottom:calc(84px + env(safe-area-inset-bottom,0px));width:54px;height:54px;border-radius:50%;border:none;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(0,0,0,.35);z-index:300;cursor:pointer}
  #iavBtn.ouvindo{background:var(--danger);animation:micPulse 1s ease-in-out infinite}
  #iavBtn.pensando{opacity:.6;pointer-events:none}
  #iavBolha{position:fixed;left:12px;right:82px;bottom:calc(88px + env(safe-area-inset-bottom,0px));background:var(--card,#1c1c1e);color:var(--text,#fff);border:1px solid var(--line,#333);border-radius:14px;padding:10px 12px;font-size:13px;line-height:1.35;z-index:300;display:none;max-height:35vh;overflow:auto}
  #iavBolha.show{display:block}`;
  document.head.appendChild(st);
}
function iavBolha(txt){
  const el = document.getElementById('iavBolha');
  if(!txt){ el.classList.remove('show'); return; }
  el.textContent = txt; el.classList.add('show');
}

function iavAlternar(){
  if(iavAtivo){ iavEnviar(); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ showToast('Voz não disponível neste navegador'); return; }
  if(!(window.SUPABASE_URL)){ showToast('Supabase não configurado'); return; }
  iavTexto = ''; iavAtivo = true;
  document.getElementById('iavBtn').classList.add('ouvindo');
  iavBolha('Pode falar… (toque de novo para enviar)');
  iavIniciarRec(SR);
}
function iavIniciarRec(SR){
  const rec = new SR();
  iavRec = rec;
  rec.lang = 'pt-BR'; rec.continuous = true; rec.interimResults = true;
  rec.onresult = (ev)=>{
    let final = '', parcial = '';
    for(let i=0;i<ev.results.length;i++){
      const t = ev.results[i][0].transcript;
      if(ev.results[i].isFinal) final += t+' '; else parcial += t;
    }
    iavTexto = final;
    iavBolha((final+parcial).trim() || 'Ouvindo…');
    clearTimeout(iavTimer);
    iavTimer = setTimeout(iavEnviar, IAV_SILENCIO_MS);
  };
  rec.onerror = (e)=>{
    if(e.error==='no-speech' || e.error==='aborted') return;
    showToast('Não consegui ouvir. Verifique o microfone'); iavParar();
  };
  rec.onend = ()=>{ if(iavAtivo){ try{ iavIniciarRec(SR); }catch(e){ iavParar(); } } }; // Android corta sozinho: religa
  try{ rec.start(); }catch(e){ iavParar(); }
}
function iavParar(){
  iavAtivo = false; clearTimeout(iavTimer);
  const r = iavRec; iavRec = null;
  if(r){ r.onend = null; try{ r.stop(); }catch(e){} }
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
  const texto = (iavTexto||'').trim();
  iavParar();
  if(!texto){ iavBolha(''); return; }
  const btn = document.getElementById('iavBtn');
  btn.classList.add('pensando'); iavBolha('“'+texto+'”\nPensando…');
  try{
    const r = await fetch(window.SUPABASE_URL+'/functions/v1/ia-voz', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'apikey':window.SUPABASE_ANON_KEY, 'Authorization':'Bearer '+window.SUPABASE_ANON_KEY },
      body: JSON.stringify({ texto, contexto: iavContexto() })
    });
    const j = await r.json();
    const feitos = [];
    for(const a of (j.acoes||[])){ const m = await iavExecutar(a); if(m) feitos.push(m); }
    iavBolha([...(feitos.length?feitos.map(f=>'✓ '+f):[]), j.fala||''].filter(Boolean).join('\n'));
    setTimeout(()=>iavBolha(''), 6000);
  }catch(e){
    console.error(e); iavBolha('Não consegui falar com a IA. Verifique a função no Supabase.');
    setTimeout(()=>iavBolha(''), 5000);
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
