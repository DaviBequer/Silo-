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
  document.getElementById('pontoMesLabel').textContent = monthLabelLong(mKey);
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
      diasHtml += `<div class="ponto-dia-row ${isWeekend?'weekend':''} ${travado?'travado':''}">
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
  document.getElementById('pontoDiferenca').textContent = (r.diffMin>=0?'+':'')+minToHoursLabel(r.diffMin);
  document.getElementById('pontoImpacto').textContent = (r.impacto>=0?'+':'-')+fmtMoney(Math.abs(r.impacto));

  renderPontoCompare();
  renderPontoMetaDiaria(mKey, r);
  renderPontoSemanasChart(mKey);
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
      return bannerGeo('positivo','ok','Mês fechado · meta batida',
        `Todos os ${uteis} dias úteis concluídos · ${faltamMin===0?'exatamente no padrão':sinal(-faltamMin)+' acima do padrão'}`, 1);
    }
    return bannerGeo('negativo','alerta',`Mês fechado · faltaram ${minToHoursLabel(faltamMin)}`,
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

function renderPontoSemanasChart(mKey){
  const container = document.getElementById('pontoSemanasChart');
  if(!container) return;
  const semanas = pontoSemanasDoMes(mKey);
  if(semanas.length===0){ container.innerHTML = ''; return; }
  const dados = semanas.map((s,i)=>{
    let totalMin=0, padraoMin=0;
    for(let dia=s.inicio; dia<=s.fim; dia++){
      const d = getDia(mKey,dia);
      const dt = keyToDate(mKey); dt.setDate(dia);
      const dow = dt.getDay();
      if(dow>=1 && dow<=4) padraoMin += PADRAO_SEGQUI_HORAS*60;
      else if(dow===5) padraoMin += PADRAO_SEX_HORAS*60;
      totalMin += dayTotalMinutes(d);
    }
    return { label:'S'+(i+1), totalMin, padraoMin };
  });
  const maxMin = Math.max(...dados.map(d=>Math.max(d.totalMin,d.padraoMin)), 60);
  container.innerHTML = dados.map(d=>{
    const pctTotal = Math.min(100, (d.totalMin/maxMin)*100);
    const abaixo = d.totalMin < d.padraoMin;
    return `<div class="ponto-semana-col">
      <div class="ponto-semana-barra-wrap">
        <div class="ponto-semana-barra ${abaixo?'abaixo':'ok'}" style="height:${pctTotal}%"></div>
      </div>
      <div class="ponto-semana-label">${d.label}</div>
      <div class="ponto-semana-valor">${minToHoursLabel(d.totalMin)}</div>
    </div>`;
  }).join('');
}

function renderPontoCompare(){
  const passado = addMonths(pontoBaseKey(), -1);
  const atual = pontoBaseKey();
  const proximo = addMonths(pontoBaseKey(), 1);
  const meses = [passado, atual, proximo];
  const container = document.getElementById('pontoCompareStrip');
  if(!container) return;
  container.innerHTML = meses.map(mKey=>{
    const r = computePontoMes(mKey);
    const isAtual = mKey === atual;
    return `<div class="compare-col ${isAtual?'compare-atual':''}">
      <div class="compare-label">${monthLabel(mKey)}</div>
      <div class="compare-value">${minToHoursLabel(r.totalMin)}</div>
      <div class="compare-sub">${fmtMoney(r.valorReceber)}</div>
    </div>`;
  }).join('');
}

/* ================= PONTO PJ: CONFIGURAÇÃO E EXPORTAÇÃO PDF ================= */
let pontoConfigMes = null;
function renderPontoConfigMes(){
  document.getElementById('pontoConfigMesLabel').textContent = monthLabelLong(pontoConfigMes);
  document.getElementById('pontoConfigMesNota').style.display = pontoConfigMes===pontoBaseKey() ? 'none' : 'block';
}
function pontoConfigNavMes(delta){
  pontoConfigMes = addMonths(pontoConfigMes, delta);
  renderPontoConfigMes();
}
function openPontoConfigModal(){
  document.getElementById('pontoConfigNome').value = state.ponto.nomeUsuario || '';
  pontoConfigMes = pontoBaseKey();
  renderPontoConfigMes();
  document.getElementById('modalPontoConfig').classList.add('active');
}
async function salvarPontoConfig(){
  const nome = document.getElementById('pontoConfigNome').value.trim();
  state.ponto.nomeUsuario = nome;
  persist();
  if(pontoConfigMes && pontoConfigMes !== pontoBaseKey()){
    const ok = await iosConfirm(`Definir ${monthLabel(pontoConfigMes)} como mês do Ponto PJ?`);
    if(!ok) return;
    closeModal('modalPontoConfig');
    definirMesPonto(pontoConfigMes);
    showToast('Mês do Ponto PJ: '+monthLabel(pontoConfigMes));
    return;
  }
  closeModal('modalPontoConfig');
  showToast('Configuração salva');
}

let pontoExportTipo = 'mes';
let pontoExportSemanaIdx = 0;

function openPontoExportModal(){
  pontoExportTipo = 'mes';
  pontoExportSemanaIdx = 0;
  document.querySelectorAll('#pontoExportTipoChips .dif-chip').forEach(el=>{
    el.classList.toggle('active', el.dataset.val==='mes');
  });
  document.getElementById('pontoExportSemanaField').style.display = 'none';
  renderPontoExportSemanaChips();
  document.getElementById('modalPontoExport').classList.add('active');
}
function selecionarPontoExportTipo(val){
  pontoExportTipo = val;
  document.querySelectorAll('#pontoExportTipoChips .dif-chip').forEach(el=>{
    el.classList.toggle('active', el.dataset.val===val);
  });
  document.getElementById('pontoExportSemanaField').style.display = val==='semana' ? 'block' : 'none';
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
  const semanas = pontoSemanasDoMes(mKey);
  let diaIni = 1, diaFim = daysInMonth(mKey);
  let periodoLabel = monthLabelLong(mKey);
  if(pontoExportTipo === 'semana'){
    const s = semanas[pontoExportSemanaIdx] || semanas[0];
    diaIni = s.inicio; diaFim = s.fim;
    periodoLabel = `${monthLabelLong(mKey)} — dias ${String(diaIni).padStart(2,'0')} a ${String(diaFim).padStart(2,'0')}`;
  }

  const linhas = [];
  for(let dia=diaIni; dia<=diaFim; dia++){
    const d = getDia(mKey, dia);
    const dateObj = keyToDate(mKey); dateObj.setDate(dia);
    if(dayTotalMinutes(d)<=0 && !d.entrada) continue;
    linhas.push([
      `${String(dia).padStart(2,'0')} (${DIA_SEMANA[dateObj.getDay()]})`,
      d.entrada || '--:--',
      d.almocoSaida || '--:--',
      d.almocoVolta || '--:--',
      d.saida || '--:--'
    ]);
  }

  if(linhas.length===0){
    showToast('Nenhum dia trabalhado nesse período');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  const nome = state.ponto.nomeUsuario || '';
  const pageW = 595;
  const marginX = 40;

  /* ---- Cabeçalho ---- */
  const graphite = [37,41,46];
  doc.setFillColor(...graphite);
  doc.rect(0,0,pageW,86,'F');
  doc.setFillColor(255,255,255);
  doc.roundedRect(marginX,18,44,44,10,10,'F');
  doc.setDrawColor(...graphite);
  doc.setLineWidth(1.6);
  doc.circle(marginX+22,40,9,'S');
  doc.line(marginX+22,40,marginX+22,35);
  doc.line(marginX+22,40,marginX+26,42);

  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold');
  doc.setFontSize(15);
  doc.text('REGISTRO DE PONTO PJ', marginX+58, 36);
  doc.setFont('helvetica','normal');
  doc.setFontSize(10.5);
  if(nome) doc.text(nome, marginX+58, 53);
  doc.setFontSize(9.5);
  doc.setTextColor(220,220,224);
  doc.text(periodoLabel, marginX+58, nome ? 68 : 53);

  /* ---- Tabela (somente os horários registrados) ---- */
  doc.autoTable({
    startY: 112,
    head: [['Dia','Entrada','Almoço','Volta','Saída']],
    body: linhas,
    theme: 'grid',
    headStyles: { fillColor:graphite, textColor:255, fontStyle:'bold', fontSize:9.5, halign:'center' },
    bodyStyles: { fontSize:10, textColor:[40,40,40], halign:'center', cellPadding:6 },
    columnStyles: { 0:{ halign:'left', fontStyle:'bold' } },
    alternateRowStyles: { fillColor:[247,247,248] },
    styles: { lineColor:[230,230,232], lineWidth:0.5 },
    margin: { left:marginX, right:marginX }
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
  const mesPontoAtual = pontoBaseKey();
  const mesContasAtual = mesFinanceiroAtual();
  const mesPontoProximo = addMonths(mesPontoAtual, 1);
  const mesContasProximo = addMonths(mesContasAtual, 1);

  document.getElementById('concluirMesInfo').innerHTML =
    `<div class="mc-field"><label>Ponto PJ</label>${monthLabel(mesPontoAtual)} → ${monthLabel(mesPontoProximo)}</div>` +
    `<div class="mc-field"><label>Contas (Panorama / Planner)</label>${monthLabel(mesContasAtual)} → ${monthLabel(mesContasProximo)}</div>`;

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
  const mesQueFecha = mesFinanceiroAtual();
  const renda = incomeForMonth('davi', mesQueFecha) + incomeForMonth('cris', mesQueFecha);
  const gastoTotal = expensesForMonth('davi', mesQueFecha) + expensesForMonth('cris', mesQueFecha);
  if(!state.historicoMeses) state.historicoMeses = {};
  state.historicoMeses[mesQueFecha] = { renda, gastoTotal, sobra: renda-gastoTotal, fechadoEm: Date.now() };

  mesAtualRef = addMonths(mesAtualRef, 1);
  state.mesAtual = mesAtualRef;
  mesPontoRef = addMonths(mesPontoRef, 1);
  state.mesPonto = mesPontoRef;
  state.panoOffset = 0;
  state.pontoOffset = 0;
  state.focusMonth = mesFinanceiroAtual();
  persist();
  closeModal('modalConcluirMes');
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

