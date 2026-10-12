/* ================= PONTO PJ ================= */
function pontoMonthKeyAtual(){ return addMonths(pontoBaseKey(), state.pontoOffset); }
function ensurePontoMonth(mKey){
  if(!state.ponto.days[mKey]) state.ponto.days[mKey] = {};
}
function pontoNavMes(delta){
  state.pontoOffset += delta;
  renderPonto();
  persist();
}
function onValorHoraInput(el){
  state.ponto.valorHora = parseMoney(el.value);
  renderPontoSummary();
  persist();
}
function timeToMin(t){ if(!t) return null; const [h,m]=t.split(':').map(Number); return h*60+m; }
function minToTime(min){ if(min===null||min===undefined) return '--:--'; min=((min%1440)+1440)%1440; const h=Math.floor(min/60), m=min%60; return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'); }
function minToHoursLabel(min){ const sign = min<0?'-':''; min=Math.abs(Math.round(min)); const h=Math.floor(min/60), m=min%60; return sign+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'); }

function getDia(mKey, dia){
  ensurePontoMonth(mKey);
  if(!state.ponto.days[mKey][dia]){
    const d = keyToDate(mKey); d.setDate(dia);
    const dow = d.getDay();
    const isWeekend = dow===0 || dow===6;
    state.ponto.days[mKey][dia] = isWeekend
      ? { entrada:null, almocoSaida:null, almocoVolta:null, saida:null, extra:0, confirmado:{} }
      : { entrada:'07:00', almocoSaida:'12:00', almocoVolta:'13:00', saida:tempoPadraoSaida(mKey,dia), extra:0, confirmado:{} };
  }
  if(!state.ponto.days[mKey][dia].confirmado) state.ponto.days[mKey][dia].confirmado = {};
  return state.ponto.days[mKey][dia];
}
const TEMPO_PADRAO = { entrada:'07:00', almocoSaida:'12:00', almocoVolta:'13:00', saida:'17:00' };
function tempoPadraoSaida(mKey, dia){
  const d = keyToDate(mKey); d.setDate(dia);
  return d.getDay()===5 ? '16:00' : '17:00';
}
function toggleDiaConcluido(dia){
  const mKey = pontoMonthKeyAtual();
  const d = getDia(mKey, dia);
  d.concluido = !d.concluido;
  renderPonto();
  persist();
  if(navigator.vibrate) navigator.vibrate(10);
}
function ajustarTempo(dia, campo, isRight){
  const mKey = pontoMonthKeyAtual();
  const d = getDia(mKey, dia);
  if(d.concluido) return;
  if(!d[campo]){
    d[campo] = campo==='saida' ? tempoPadraoSaida(mKey, dia) : TEMPO_PADRAO[campo];
  } else {
    let min = timeToMin(d[campo]) + (isRight ? 1 : -1);
    min = ((min % 1440) + 1440) % 1440;
    d[campo] = minToTime(min);
  }
  d.confirmado[campo] = true;
  renderPonto();
  persist();
  if(navigator.vibrate) navigator.vibrate(6);
}
let tempoPressTimer = null;
function tempoTapStart(e, dia, campo){
  if(e.cancelable) e.preventDefault();
  if(tempoPressTimer) clearTimeout(tempoPressTimer);
  tempoPressTimer = setTimeout(()=>{
    tempoPressTimer = null;
    const mKey = pontoMonthKeyAtual();
    const d = getDia(mKey, dia);
    if(d.concluido) return;
    d[campo] = null;
    d.confirmado[campo] = false;
    renderPonto();
    persist();
    if(navigator.vibrate) navigator.vibrate(20);
  }, 550);
}
function tempoTapEnd(e, dia, campo){
  if(e.cancelable) e.preventDefault();
  if(tempoPressTimer){
    clearTimeout(tempoPressTimer);
    tempoPressTimer = null;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const clientX = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX);
    const isRight = (clientX - rect.left) > rect.width/2;
    ajustarTempo(dia, campo, isRight);
  }
}
function tempoTapCancel(){
  if(tempoPressTimer){ clearTimeout(tempoPressTimer); tempoPressTimer = null; }
}
function setExtra(dia, valStr){
  const mKey = pontoMonthKeyAtual();
  const d = getDia(mKey, dia);
  if(!valStr){ d.extra = 0; }
  else{
    const partes = valStr.split(':');
    const h = parseInt(partes[0])||0;
    const m = parseInt(partes[1])||0;
    d.extra = Math.max(0, h*60+m);
  }
  renderPonto();
  persist();
}
function zerarDia(dia){
  const mKey = pontoMonthKeyAtual();
  state.ponto.days[mKey][dia] = { entrada:null, almocoSaida:null, almocoVolta:null, saida:null, extra:0, confirmado:{} };
  renderPonto();
  persist();
}
function dayTotalMinutes(d){
  const { entrada, almocoSaida, almocoVolta, saida } = d;
  let periodo = 0;
  if(entrada && almocoSaida && almocoVolta && saida){
    const manha = timeToMin(almocoSaida) - timeToMin(entrada);
    const tarde = timeToMin(saida) - timeToMin(almocoVolta);
    periodo = Math.max(0, manha) + Math.max(0, tarde);
  }else if(entrada && saida && !almocoSaida && !almocoVolta){
    periodo = Math.max(0, timeToMin(saida) - timeToMin(entrada));
  }else if(entrada && almocoSaida && !almocoVolta && !saida){
    periodo = Math.max(0, timeToMin(almocoSaida) - timeToMin(entrada));
  }else if(almocoVolta && saida && !entrada && !almocoSaida){
    periodo = Math.max(0, timeToMin(saida) - timeToMin(almocoVolta));
  }
  return periodo + (d.extra||0);
}

let pontoSemanaColapsada = {}; // chave mKey+'-w'+índice -> true/false (em memória, não precisa persistir)
function toggleSemanaPonto(chave){
  pontoSemanaColapsada[chave] = !pontoSemanaColapsada[chave];
  renderPonto();
}

function renderPonto(){
  const mKey = pontoMonthKeyAtual();
  ensurePontoMonth(mKey);
  const fechado = pontoMesFechado(mKey);
  document.getElementById('pontoMesLabel').innerHTML = monthLabelLong(mKey) + (fechado ? ' <span class="ponto-fechado-ico" title="Mês fechado">✓</span>' : '');
  document.querySelector('#aba-ponto .ponto-mes-nav')?.classList.toggle('fechado', fechado);
  document.getElementById('pontoValorHora').value = state.ponto.valorHora ? state.ponto.valorHora.toFixed(2).replace('.',',') : '';

  const totalDias = daysInMonth(mKey);
  const lista = document.getElementById('pontoDiasLista');
  const hoje = new Date();
  const nowMin = hoje.getHours()*60 + hoje.getMinutes();

  // Agrupa os dias em semanas (semana começa no domingo)
  const semanas = [];
  for(let dia=1; dia<=totalDias; dia++){
    const dateObj = keyToDate(mKey); dateObj.setDate(dia);
    if(dateObj.getDay()===0 || dia===1) semanas.push([]);
    semanas[semanas.length-1].push(dia);
  }

  let rows = '';
  semanas.forEach((diasDaSemana, wIdx)=>{
    const chave = mKey+'-w'+wIdx;
    const semanaTemHoje = diasDaSemana.some(dia=>{
      const dt = keyToDate(mKey); dt.setDate(dia);
      return dt.getFullYear()===hoje.getFullYear() && dt.getMonth()===hoje.getMonth() && dt.getDate()===hoje.getDate();
    });
    const ultimoDiaSemana = keyToDate(mKey); ultimoDiaSemana.setDate(diasDaSemana[diasDaSemana.length-1]);
    const semanaPassou = ultimoDiaSemana < hoje && !semanaTemHoje;
    if(!(chave in pontoSemanaColapsada)) pontoSemanaColapsada[chave] = semanaPassou;
    const colapsada = pontoSemanaColapsada[chave];
    const primeiroDia = diasDaSemana[0], ultimoDia = diasDaSemana[diasDaSemana.length-1];

    let diasHtml = '';
    diasDaSemana.forEach(dia=>{
      const d = getDia(mKey, dia);
      const dateObj = keyToDate(mKey); dateObj.setDate(dia);
      const isWeekend = dateObj.getDay()===0 || dateObj.getDay()===6;
      const isHoje = dateObj.getFullYear()===hoje.getFullYear() && dateObj.getMonth()===hoje.getMonth() && dateObj.getDate()===hoje.getDate();
      const total = dayTotalMinutes(d);
      const extraVal = d.extra ? String(Math.floor(d.extra/60)).padStart(2,'0')+':'+String(d.extra%60).padStart(2,'0') : '';
      const travado = !!d.concluido;
      const tapAttrs = (campo)=> travado ? '' : `onpointerdown="tempoTapStart(event,${dia},'${campo}')" onpointerup="tempoTapEnd(event,${dia},'${campo}')" onpointercancel="tempoTapCancel()" onpointerleave="tempoTapCancel()" oncontextmenu="return false"`;
      const statusClasse = (campo)=>{
        if(d.confirmado && d.confirmado[campo]) return 'ph-confirmado';
        if(isHoje && d[campo] && nowMin > timeToMin(d[campo])) return 'ph-atrasado';
        return '';
      };
      diasHtml += `<div class="ponto-dia-row ${isWeekend?'weekend':''} ${travado?'travado':''}" id="pontoDia-${dia}">
        <div class="pd-head">
          <div class="pd-data">${String(dia).padStart(2,'0')} <small>${DIA_SEMANA[dateObj.getDay()]}</small></div>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="pd-total ${total===0?'zero':''}">${minToHoursLabel(total)}</div>
            <button class="btn-icon-sm ${travado?'concluido-ativo':''}" onclick="toggleDiaConcluido(${dia})" title="${travado?'Reabrir dia':'Marcar como concluído'}">${travado?ICON_CHECK:ICON_UNLOCK}</button>
            <button class="btn-icon-sm" onclick="zerarDia(${dia})" title="Não trabalhei" ${travado?'disabled':''}>${ICON_BAN}</button>
          </div>
        </div>
        <div class="ponto-horarios-grid">
          <div class="ph-item"><div class="ph-lbl">Entrada</div><div class="ph-tempo-tap ${statusClasse('entrada')}" ${tapAttrs('entrada')}>${d.entrada||'--:--'}</div></div>
          <div class="ph-item"><div class="ph-lbl">Almoço</div><div class="ph-tempo-tap ${statusClasse('almocoSaida')}" ${tapAttrs('almocoSaida')}>${d.almocoSaida||'--:--'}</div></div>
          <div class="ph-item"><div class="ph-lbl">Volta</div><div class="ph-tempo-tap ${statusClasse('almocoVolta')}" ${tapAttrs('almocoVolta')}>${d.almocoVolta||'--:--'}</div></div>
          <div class="ph-item"><div class="ph-lbl">Saída</div><div class="ph-tempo-tap ${statusClasse('saida')}" ${tapAttrs('saida')}>${d.saida||'--:--'}</div></div>
        </div>
        <div class="ponto-extra-row">
          <div class="ph-item"><div class="ph-lbl">Hora extra</div><input type="text" value="${extraVal}" placeholder="00:00" onchange="setExtra(${dia}, this.value)" ${travado?'disabled':''}></div>
        </div>
      </div>`;
    });

    rows += `<div class="ponto-semana-grupo ${colapsada?'colapsada':''}">
      <div class="ponto-semana-head" onclick="toggleSemanaPonto('${chave}')">
        <span>Semana ${wIdx+1} <small>${String(primeiroDia).padStart(2,'0')}–${String(ultimoDia).padStart(2,'0')}</small></span>
        <button type="button" class="section-toggle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
      </div>
      <div class="ponto-semana-dias">${diasHtml}</div>
    </div>`;
  });
  lista.innerHTML = rows;
  renderPontoSummary();
  renderPontoFechar();
}

function computePontoMes(mKey){
  ensurePontoMonth(mKey);
  const totalDias = daysInMonth(mKey);
  let totalMin = 0, padraoMin = 0;
  for(let dia=1; dia<=totalDias; dia++){
    const d = getDia(mKey,dia);
    const dateObj = keyToDate(mKey); dateObj.setDate(dia);
    const dow = dateObj.getDay();
    if(dow>=1 && dow<=4) padraoMin += PADRAO_SEGQUI_HORAS * 60;
    else if(dow===5) padraoMin += PADRAO_SEX_HORAS * 60;
    totalMin += dayTotalMinutes(d);
  }
  const valorHora = state.ponto.valorHora || 0;
  const diffMin = totalMin - padraoMin;
  const valorReceber = (totalMin/60) * valorHora;
  const impacto = (diffMin/60) * valorHora;
  return { totalMin, padraoMin, diffMin, valorReceber, impacto };
}

function renderPontoSummary(){
  const mKey = pontoMonthKeyAtual();
  const r = computePontoMes(mKey);

  document.getElementById('pontoTotalHoras').textContent = minToHoursLabel(r.totalMin);
  document.getElementById('pontoValorReceber').textContent = fmtMoney(r.valorReceber);
  document.getElementById('pontoPadrao').textContent = minToHoursLabel(r.padraoMin);
  const elDif = document.getElementById('pontoDiferenca');
  elDif.textContent = (r.diffMin>=0?'+':'')+minToHoursLabel(r.diffMin);
  elDif.className = 'resumo-stat-val ' + (r.diffMin>=0 ? 'pos' : 'neg');
  const elImp = document.getElementById('pontoImpacto');
  elImp.textContent = (r.impacto>=0?'+':'-')+fmtMoney(Math.abs(r.impacto));
  elImp.className = 'resumo-stat-val ' + (r.impacto>=0 ? 'pos' : 'neg');

  renderPontoMetaDiaria(mKey, r);
}

/* situação do mês pelos dias trancados (cadeado) */
function pontoStatusMes(mKey){
  const r = computePontoMes(mKey);
  const totalDias = daysInMonth(mKey);
  let uteis = 0, uteisConcluidos = 0, feitoMin = 0;
  for(let dia=1; dia<=totalDias; dia++){
    const d = getDia(mKey, dia);
    const dow = keyToDate(mKey); dow.setDate(dia);
    const util = dow.getDay()>=1 && dow.getDay()<=5;
    if(util) uteis++;
    if(d.concluido){
      feitoMin += dayTotalMinutes(d);
      if(util) uteisConcluidos++;
    }
  }
  const restantes = uteis - uteisConcluidos;
  const faltamMin = r.padraoMin - feitoMin;
  return { r, uteis, uteisConcluidos, restantes, feitoMin, faltamMin, prog: uteis>0 ? uteisConcluidos/uteis : 0,
           metaDia: restantes>0 ? Math.round(faltamMin/restantes) : 0 };
}
function pontoBannerHtml(mKey){
  const st = pontoStatusMes(mKey);
  const { r, uteis, uteisConcluidos, restantes, feitoMin, faltamMin, prog, metaDia } = st;
  const sinal = (m)=> (m>=0?'+':'-')+minToHoursLabel(Math.abs(m));
  if(restantes<=0){
    if(faltamMin<=0){
      return bannerGeo('positivo','ok','Dias concluídos · meta batida',
        `Todos os ${uteis} dias úteis concluídos · ${faltamMin===0?'exatamente no padrão':sinal(-faltamMin)+' acima do padrão'}`, 1);
    }
    return bannerGeo('negativo','alerta',`Dias concluídos · faltaram ${minToHoursLabel(faltamMin)}`,
      `Todos os ${uteis} dias úteis concluídos · padrão ${minToHoursLabel(r.padraoMin)}, registrado ${minToHoursLabel(feitoMin)}`, 1);
  }
  if(faltamMin<=0){
    return bannerGeo('positivo','ok','Meta do mês já batida',
      `${uteisConcluidos} de ${uteis} dias úteis concluídos · ${sinal(-faltamMin)} acima do padrão`, prog);
  }
  return bannerGeo(metaDia>540?'negativo':'positivo', metaDia>540?'alerta':'alvo',
    `Faltam ${minToHoursLabel(faltamMin)} para fechar o mês`,
    `${uteisConcluidos} de ${uteis} dias úteis concluídos · ${restantes} ${restantes>1?'restantes':'restante'} · cerca de <b>${minToHoursLabel(metaDia)}/dia</b>`, prog);
}
function renderPontoMetaDiaria(mKey, r){
  const el = document.getElementById('pontoMetaDiaria');
  if(!el) return;
  el.innerHTML = pontoBannerHtml(mKey);
}

/* ================= PONTO PJ: CONFIGURAÇÃO E EXPORTAÇÃO PDF ================= */
function openPontoConfigModal(){
  document.getElementById('pontoConfigNome').value = state.ponto.nomeUsuario || '';
  document.getElementById('modalPontoConfig').classList.add('active');
}
function salvarPontoConfig(){
  state.ponto.nomeUsuario = document.getElementById('pontoConfigNome').value.trim();
  persist();
  closeModal('modalPontoConfig');
  showToast('Configuração salva');
}

/* ================= PONTO PJ: FECHAR MÊS ================= */
function pontoMesFechado(mKey){ return !!(state.pontoFechado && state.pontoFechado[mKey]); }
/* dias úteis (seg–sex) que ainda não estão trancados */
function pontoDiasUteisPendentes(mKey){
  const out = [];
  for(let dia=1; dia<=daysInMonth(mKey); dia++){
    const dt = keyToDate(mKey); dt.setDate(dia);
    if(dt.getDay()<1 || dt.getDay()>5) continue;
    if(!getDia(mKey, dia).concluido) out.push(dia);
  }
  return out;
}
function renderPontoFechar(){
  const box = document.getElementById('pontoFecharBox');
  if(!box) return;
  const mKey = pontoMonthKeyAtual();
  const base = pontoBaseKey();
  if(pontoMesFechado(mKey)){
    const reg = state.pontoFechado[mKey];
    box.innerHTML = `<div class="ponto-fechar fechado">
      <div class="pf-info"><b>✓ Mês fechado</b><small>${minToHoursLabel(reg.totalMin||0)} · ${fmtMoney(reg.valor||0)}</small></div>
      <button type="button" class="fat-btn" onclick="reabrirMesPonto()">Reabrir</button>
    </div>`;
    return;
  }
  if(mKey > base){
    box.innerHTML = `<div class="ponto-fechar futuro"><div class="pf-info"><small>Mês à frente: só para visualizar. Feche o mês vigente primeiro.</small></div></div>`;
    return;
  }
  const pend = pontoDiasUteisPendentes(mKey);
  box.innerHTML = `<div class="ponto-fechar${pend.length?'':' pronto'}">
    <div class="pf-info"><b>Fechar mês</b><small>${pend.length ? pend.length+(pend.length>1?' dias úteis ainda sem trancar':' dia útil ainda sem trancar') : 'Todos os dias úteis trancados'}</small></div>
    <button type="button" class="fat-btn pagar" onclick="fecharMesPonto()">Fechar mês</button>
  </div>`;
}
function fecharMesPonto(){
  const mKey = pontoMonthKeyAtual();
  if(pontoDiasUteisPendentes(mKey).length){ renderPontoPendentes(); document.getElementById('modalPontoPendentes').classList.add('active'); return; }
  confirmarFecharMesPonto();
}
function renderPontoPendentes(){
  const mKey = pontoMonthKeyAtual();
  const pend = pontoDiasUteisPendentes(mKey);
  if(!pend.length){ closeModal('modalPontoPendentes'); confirmarFecharMesPonto(); return; }
  document.getElementById('pontoPendentesTitulo').textContent = pend.length+(pend.length>1?' dias úteis sem trancar':' dia útil sem trancar');
  document.getElementById('pontoPendentesLista').innerHTML = pend.map(dia=>{
    const d = getDia(mKey, dia);
    const dt = keyToDate(mKey); dt.setDate(dia);
    const horas = (d.entrada||'--:--')+'–'+(d.almocoSaida||'--:--')+' · '+(d.almocoVolta||'--:--')+'–'+(d.saida||'--:--');
    return `<div class="pp-row">
      <div class="pp-info"><b>${String(dia).padStart(2,'0')} <small>${DIA_SEMANA[dt.getDay()]}</small></b><span>${horas} · ${minToHoursLabel(dayTotalMinutes(d))}</span></div>
      <div class="pp-acoes">
        <button type="button" class="fat-btn pagar" onclick="pontoPendenteTrancar(${dia})">Trancar</button>
        <button type="button" class="fat-btn" onclick="pontoPendenteNaoTrabalhei(${dia})">Não trabalhei</button>
        <button type="button" class="fat-btn" onclick="pontoPendenteEditar(${dia})">Editar</button>
      </div>
    </div>`;
  }).join('');
}
function pontoPendenteTrancar(dia){
  getDia(pontoMonthKeyAtual(), dia).concluido = true;
  persist(); renderPonto(); renderPontoPendentes();
}
function pontoPendenteNaoTrabalhei(dia){
  const mKey = pontoMonthKeyAtual();
  zerarDia(dia);
  getDia(mKey, dia).concluido = true;
  persist(); renderPonto(); renderPontoPendentes();
}
function pontoPendenteEditar(dia){
  const mKey = pontoMonthKeyAtual();
  closeModal('modalPontoPendentes');
  let w = 0;
  for(let d=2; d<=dia; d++){ const dt = keyToDate(mKey); dt.setDate(d); if(dt.getDay()===0) w++; }
  pontoSemanaColapsada[mKey+'-w'+w] = false;
  renderPonto();
  setTimeout(()=>{ document.getElementById('pontoDia-'+dia)?.scrollIntoView({ behavior:'smooth', block:'center' }); }, 80);
}
async function confirmarFecharMesPonto(){
  const mKey = pontoMonthKeyAtual();
  const r = computePontoMes(mKey);
  const ok = await iosConfirm(`Fechar ${monthLabelLong(mKey)}? Total ${minToHoursLabel(r.totalMin)} · a receber ${fmtMoney(r.valorReceber)}. O Ponto avança para o mês seguinte.`);
  if(!ok) return;
  if(!state.pontoFechado) state.pontoFechado = {};
  state.pontoFechado[mKey] = { em: Date.now(), totalMin: r.totalMin, valor: r.valorReceber };
  if(mKey === pontoBaseKey()){
    definirMesPonto(addMonths(mKey, 1));   // avança, salva e redesenha tudo
  } else {
    persist(); renderPonto();
  }
  showToast(monthLabel(mKey)+' fechado');
}
async function reabrirMesPonto(){
  const mKey = pontoMonthKeyAtual();
  const ok = await iosConfirm('Reabrir '+monthLabelLong(mKey)+'? Os dias continuam trancados; você só tira a marca de fechado.');
  if(!ok) return;
  delete state.pontoFechado[mKey];
  if(mKey < pontoBaseKey()) definirMesPonto(mKey);
  else { persist(); renderPonto(); }
}

let pontoExportTipo = 'mes';
let pontoExportSemanaIdx = 0;

let pontoExportDiasSel = new Set();   // modo Personalizado: dias trancados escolhidos

function openPontoExportModal(){
  pontoExportTipo = 'mes';
  pontoExportSemanaIdx = 0;
  pontoExportDiasSel = new Set();
  selecionarPontoExportTipo('mes');
  renderPontoExportSemanaChips();
  renderPontoExportDiasChips();
  document.getElementById('modalPontoExport').classList.add('active');
}
function selecionarPontoExportTipo(val){
  pontoExportTipo = val;
  document.querySelectorAll('#pontoExportTipoChips .dif-chip').forEach(el=>{
    el.classList.toggle('active', el.dataset.val===val);
  });
  document.getElementById('pontoExportSemanaField').style.display = val==='semana' ? 'block' : 'none';
  document.getElementById('pontoExportDiasField').style.display = val==='personalizado' ? 'block' : 'none';
}
/* Personalizado: só aparecem os dias já trancados (cadeado) */
function pontoDiasTrancados(mKey){
  const out = [];
  for(let dia=1; dia<=daysInMonth(mKey); dia++) if(getDia(mKey, dia).concluido) out.push(dia);
  return out;
}
function renderPontoExportDiasChips(){
  const mKey = pontoMonthKeyAtual();
  const dias = pontoDiasTrancados(mKey);
  const el = document.getElementById('pontoExportDiasChips');
  if(!dias.length){ el.innerHTML = '<div class="caption">Nenhum dia trancado neste mês ainda.</div>'; return; }
  el.innerHTML = dias.map(dia=>{
    const dt = keyToDate(mKey); dt.setDate(dia);
    return `<button type="button" class="dif-chip ponto-dia-chip${pontoExportDiasSel.has(dia)?' active':''}" onclick="togglePontoExportDia(${dia})">${String(dia).padStart(2,'0')}<small>${DIA_SEMANA[dt.getDay()]}</small></button>`;
  }).join('');
  document.getElementById('pontoExportDiasTodos').textContent = pontoExportDiasSel.size===dias.length ? 'Limpar seleção' : 'Selecionar todos';
}
function togglePontoExportDia(dia){
  if(pontoExportDiasSel.has(dia)) pontoExportDiasSel.delete(dia); else pontoExportDiasSel.add(dia);
  renderPontoExportDiasChips();
}
function togglePontoExportTodosDias(){
  const dias = pontoDiasTrancados(pontoMonthKeyAtual());
  pontoExportDiasSel = pontoExportDiasSel.size===dias.length ? new Set() : new Set(dias);
  renderPontoExportDiasChips();
}
/* dias que entram no PDF / na cópia, conforme o período escolhido */
function pontoExportDias(){
  const mKey = pontoMonthKeyAtual();
  if(pontoExportTipo === 'personalizado') return [...pontoExportDiasSel].sort((a,b)=>a-b);
  let ini = 1, fim = daysInMonth(mKey);
  if(pontoExportTipo === 'semana'){
    const semanas = pontoSemanasDoMes(mKey);
    const s = semanas[pontoExportSemanaIdx] || semanas[0];
    ini = s.inicio; fim = s.fim;
  }
  const out = [];
  for(let dia=ini; dia<=fim; dia++){
    const d = getDia(mKey, dia);
    if(dayTotalMinutes(d)>0 || d.entrada) out.push(dia);
  }
  return out;
}

function pontoSemanasDoMes(mKey){
  const totalDias = daysInMonth(mKey);
  const semanas = [];
  let atual = null;
  for(let dia=1; dia<=totalDias; dia++){
    const d = keyToDate(mKey); d.setDate(dia);
    const dow = d.getDay();
    if(dow===0 || dow===6){
      atual = null;
      continue;
    }
    if(dow===1 || !atual){
      atual = { inicio:dia, fim:dia };
      semanas.push(atual);
    }else{
      atual.fim = dia;
    }
  }
  return semanas;
}
function renderPontoExportSemanaChips(){
  const mKey = pontoMonthKeyAtual();
  const semanas = pontoSemanasDoMes(mKey);
  const el = document.getElementById('pontoExportSemanaChips');
  el.innerHTML = semanas.map((s,i)=>
    `<button type="button" class="dif-chip${i===0?' active':''}" onclick="selecionarPontoExportSemana(${i})">${String(s.inicio).padStart(2,'0')}–${String(s.fim).padStart(2,'0')}</button>`
  ).join('');
}
function selecionarPontoExportSemana(idx){
  pontoExportSemanaIdx = idx;
  document.querySelectorAll('#pontoExportSemanaChips .dif-chip').forEach((el,i)=>{
    el.classList.toggle('active', i===idx);
  });
}

function gerarPdfPonto(){
  if(typeof window.jspdf === 'undefined'){
    showToast('Não foi possível carregar o gerador de PDF. Verifique sua conexão.');
    return;
  }
  const mKey = pontoMonthKeyAtual();
  const dias = pontoExportDias();
  if(pontoExportTipo==='personalizado' && !dias.length){ showToast('Selecione pelo menos um dia'); return; }
  let periodoLabel = monthLabelLong(mKey);
  if(pontoExportTipo === 'semana' && dias.length){
    periodoLabel = `${monthLabelLong(mKey)} · dias ${String(dias[0]).padStart(2,'0')} a ${String(dias[dias.length-1]).padStart(2,'0')}`;
  } else if(pontoExportTipo === 'personalizado'){
    periodoLabel = `${monthLabelLong(mKey)} · ${dias.length} dia${dias.length>1?'s':''} selecionado${dias.length>1?'s':''}`;
  }

  /* só horários e horas trabalhadas — nenhum valor em dinheiro */
  let totalMin = 0;
  const linhas = dias.map(dia=>{
    const d = getDia(mKey, dia);
    const dateObj = keyToDate(mKey); dateObj.setDate(dia);
    const min = dayTotalMinutes(d);
    totalMin += min;
    return [
      `${String(dia).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}  ${DIA_SEMANA[dateObj.getDay()]}`,
      d.entrada || '—', d.almocoSaida || '—', d.almocoVolta || '—', d.saida || '—',
      minToHoursLabel(min)
    ];
  });

  if(linhas.length===0){
    showToast('Nenhum dia trabalhado nesse período');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  const nome = state.ponto.nomeUsuario || '';
  const pageW = 595;
  const marginX = 48;
  const tinta = [17,24,39], suave = [107,114,128], linha = [229,231,235];

  /* ---- Cabeçalho minimalista: texto e uma linha fina ---- */
  doc.setTextColor(...suave);
  doc.setFont('helvetica','normal');
  doc.setFontSize(9);
  doc.text('REGISTRO DE PONTO', marginX, 56);
  doc.setTextColor(...tinta);
  doc.setFont('helvetica','bold');
  doc.setFontSize(18);
  doc.text(nome || 'Registro de ponto', marginX, 78);
  doc.setFont('helvetica','normal');
  doc.setFontSize(10);
  doc.setTextColor(...suave);
  doc.text(periodoLabel, marginX, 96);
  doc.setDrawColor(...linha);
  doc.setLineWidth(0.8);
  doc.line(marginX, 112, pageW-marginX, 112);

  /* ---- Planilha ---- */
  doc.autoTable({
    startY: 128,
    head: [['Dia','Entrada','Almoço','Volta','Saída','Horas']],
    body: linhas,
    foot: [['Total','','','','', minToHoursLabel(totalMin)]],
    theme: 'plain',
    headStyles: { textColor:suave, fontStyle:'normal', fontSize:8.5, halign:'center', cellPadding:{top:4,bottom:8,left:6,right:6} },
    bodyStyles: { fontSize:10, textColor:tinta, halign:'center', cellPadding:{top:7,bottom:7,left:6,right:6} },
    footStyles: { fontSize:10, textColor:tinta, fontStyle:'bold', halign:'center', cellPadding:{top:10,bottom:6,left:6,right:6} },
    columnStyles: { 0:{ halign:'left' }, 5:{ fontStyle:'bold' } },
    margin: { left:marginX, right:marginX },
    didDrawCell: (data)=>{
      if(data.section==='body' || (data.section==='head')){
        doc.setDrawColor(...linha); doc.setLineWidth(0.5);
        doc.line(data.cell.x, data.cell.y+data.cell.height, data.cell.x+data.cell.width, data.cell.y+data.cell.height);
      }
    },
    didParseCell: (data)=>{ if(data.section==='head' && data.column.index===0) data.cell.styles.halign='left'; if(data.section==='foot' && data.column.index===0) data.cell.styles.halign='left'; }
  });

  /* ---- Bloco CSV para colar na planilha: uma linha por dia, Entrada;Almoço;Volta;Saída ----
     Texto puro, cada linha uma linha de texto do PDF: quem recebe seleciona, copia e cola. */
  const csv = dias.map(dia=>{
    const d = getDia(mKey, dia);
    return [d.entrada||'', d.almocoSaida||'', d.almocoVolta||'', d.saida||''].join(';');
  });
  const alturaLinha = 14;
  let y = doc.lastAutoTable.finalY + 36;
  if(y + 46 + csv.length*alturaLinha > 800){ doc.addPage(); y = 56; }
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...suave);
  doc.text('PARA COLAR NA PLANILHA', marginX, y);
  doc.setFontSize(8.5);
  doc.text('Selecione as linhas abaixo, copie e cole na célula da Entrada do primeiro dia. Separador: ponto e vírgula (;).', marginX, y+13);
  y += 32;
  doc.setFont('courier','normal'); doc.setFontSize(10); doc.setTextColor(...tinta);
  csv.forEach(l=>{
    if(y > 800){ doc.addPage(); y = 56; doc.setFont('courier','normal'); doc.setFontSize(10); doc.setTextColor(...tinta); }
    doc.text(l, marginX, y);
    y += alturaLinha;
  });

  const dataExporto = monthLabel(mKey);
  const fileName = `Ponto PJ - ${nome || 'Davi Bequer'} - ${dataExporto}.pdf`;

  const blob = doc.output('blob');
  const file = new File([blob], fileName, { type:'application/pdf' });
  if(navigator.canShare && navigator.canShare({ files:[file] })){
    navigator.share({ files:[file], title:'Registro de Ponto PJ', text:periodoLabel }).catch(()=>{
      doc.save(fileName);
    });
  }else{
    doc.save(fileName);
  }
  closeModal('modalPontoExport');
}

/* ================= CONCLUIR MÊS ================= */
function openConcluirMesModal(){
  const mesContasAtual = mesFinanceiroAtual();
  const mesContasProximo = addMonths(mesContasAtual, 1);

  document.getElementById('concluirMesInfo').innerHTML =
    `<div class="mc-field"><label>Contas (Dashboard)</label>${monthLabel(mesContasAtual)} → ${monthLabel(mesContasProximo)}</div>`;

  const abertas = contasEmAbertoNoMes(mesContasAtual);
  const avisoEl = document.getElementById('concluirMesAviso');
  if(abertas > 0){
    avisoEl.style.display = 'block';
    avisoEl.innerHTML = bannerGeo('negativo','alerta',`${abertas} conta${abertas>1?'s':''} em aberto`,`Em ${monthLabel(mesContasAtual)}. Você pode concluir mesmo assim.`);
  } else {
    avisoEl.style.display = 'none';
  }
  document.getElementById('modalConcluirMes').classList.add('active');
}
function confirmarConcluirMes(){
  closeModal('modalConcluirMes');
  concluirMesAtual();
}
/* fecha o mês atual do Dashboard (guarda o resumo no histórico) e avança para o próximo */
function concluirMesAtual(){
  const mesQueFecha = mesFinanceiroAtual();
  const renda = incomeForMonth('davi', mesQueFecha) + incomeForMonth('cris', mesQueFecha);
  const gastoTotal = expensesForMonth('davi', mesQueFecha) + expensesForMonth('cris', mesQueFecha);
  if(!state.historicoMeses) state.historicoMeses = {};
  state.historicoMeses[mesQueFecha] = { renda, gastoTotal, sobra: renda-gastoTotal, fechadoEm: Date.now() };

  mesAtualRef = addMonths(mesAtualRef, 1);
  state.mesAtual = mesAtualRef;
  state.panoOffset = 0;
  state.focusMonth = mesFinanceiroAtual();
  persist();
  renderAll();
  showToast('Mês concluído — avançou para ' + monthLabel(mesFinanceiroAtual()));
}

/* ================= MODAIS (fechar por clique fora) ================= */
document.querySelectorAll('.modal-overlay').forEach(ov=>{
  ov.addEventListener('click', e=>{ if(e.target===ov) closeModal(ov.id); });
});

/* ================= TOAST ================= */
let toastTimer;
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove('show'), 2200);
}

