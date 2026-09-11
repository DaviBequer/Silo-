/* ================= PONTO PJ ================= */
function pontoMonthKeyAtual(){ return addMonths(todayKey(), state.pontoOffset); }
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

function renderPonto(){
  const mKey = pontoMonthKeyAtual();
  ensurePontoMonth(mKey);
  document.getElementById('pontoMesLabel').textContent = monthLabelLong(mKey);
  document.getElementById('pontoValorHora').value = state.ponto.valorHora ? state.ponto.valorHora.toFixed(2).replace('.',',') : '';

  const totalDias = daysInMonth(mKey);
  const lista = document.getElementById('pontoDiasLista');
  const hoje = new Date();
  const nowMin = hoje.getHours()*60 + hoje.getMinutes();
  let rows = '';
  for(let dia=1; dia<=totalDias; dia++){
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
    rows += `<div class="ponto-dia-row ${isWeekend?'weekend':''} ${travado?'travado':''}">
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
  }
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
}

function renderPontoCompare(){
  const passado = addMonths(todayKey(), -1);
  const atual = todayKey();
  const proximo = addMonths(todayKey(), 1);
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
function openPontoConfigModal(){
  document.getElementById('pontoConfigNome').value = state.ponto.nomeUsuario || '';
  document.getElementById('modalPontoConfig').classList.add('active');
}
function salvarPontoConfig(){
  const nome = document.getElementById('pontoConfigNome').value.trim();
  state.ponto.nomeUsuario = nome;
  persist();
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

  const valorHora = state.ponto.valorHora || 0;
  const linhas = [];
  let totalMinPeriodo = 0;
  for(let dia=diaIni; dia<=diaFim; dia++){
    const d = getDia(mKey, dia);
    const dateObj = keyToDate(mKey); dateObj.setDate(dia);
    const totalMin = dayTotalMinutes(d);
    if(totalMin<=0 && !d.entrada) continue;
    totalMinPeriodo += totalMin;
    const horas = Math.floor(totalMin/60), minutos = totalMin%60;
    const valorDia = (totalMin/60) * valorHora;
    linhas.push([
      `${String(dia).padStart(2,'0')} (${DIA_SEMANA[dateObj.getDay()]})`,
      d.entrada || '--:--',
      d.almocoSaida || '--:--',
      d.almocoVolta || '--:--',
      d.saida || '--:--',
      `${String(horas).padStart(2,'0')}h${String(minutos).padStart(2,'0')}m`,
      fmtMoney(valorDia)
    ]);
  }

  if(linhas.length===0){
    showToast('Nenhum dia trabalhado nesse período');
    return;
  }

  const valorTotalPeriodo = (totalMinPeriodo/60) * valorHora;
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

  /* ---- Cards de resumo ---- */
  const cardsY = 106;
  const cardH = 56;
  const gap = 12;
  const cardW = (pageW - marginX*2 - gap*2) / 3;
  const totalHorasLabel = minToHoursLabel(totalMinPeriodo);
  const cards = [
    { label:'TOTAL DE HORAS', value: totalHorasLabel, accent:graphite },
    { label:'VALOR TOTAL', value: fmtMoney(valorTotalPeriodo), accent:[28,157,91] },
    { label:'VALOR POR HORA', value: fmtMoney(valorHora), accent:[59,110,165] },
  ];
  cards.forEach((c,i)=>{
    const x = marginX + i*(cardW+gap);
    doc.setDrawColor(225,225,228);
    doc.setLineWidth(1);
    doc.roundedRect(x,cardsY,cardW,cardH,8,8,'S');
    doc.setFillColor(...c.accent);
    doc.roundedRect(x+12,cardsY+12,6,6,2,2,'F');
    doc.setTextColor(120,120,124);
    doc.setFont('helvetica','bold');
    doc.setFontSize(7.5);
    doc.text(c.label, x+24, cardsY+16);
    doc.setTextColor(30,30,32);
    doc.setFontSize(15);
    doc.text(c.value, x+12, cardsY+38);
  });

  /* ---- Tabela ---- */
  doc.autoTable({
    startY: cardsY + cardH + 24,
    head: [['Dia','Entrada','Almoço','Volta','Saída','Horas','Valor']],
    body: linhas,
    theme: 'grid',
    headStyles: { fillColor:graphite, textColor:255, fontStyle:'bold', fontSize:9 },
    bodyStyles: { fontSize:9, textColor:[40,40,40] },
    alternateRowStyles: { fillColor:[247,247,248] },
    styles: { lineColor:[230,230,232], lineWidth:0.5 },
    margin: { left:marginX, right:marginX }
  });

  /* ---- Rodapé ---- */
  const finalY = doc.lastAutoTable.finalY + 20;
  doc.setTextColor(140,140,144);
  doc.setFont('helvetica','normal');
  doc.setFontSize(8);
  doc.text(`Cálculo das horas considerando intervalo de almoço. Valor da hora: ${fmtMoney(valorHora)}.`, marginX, finalY);

  const fileName = `Ponto_${nome ? nome.replace(/\s+/g,'_')+'_' : ''}${mKey}${pontoExportTipo==='semana' ? '_semana'+(pontoExportSemanaIdx+1) : ''}.pdf`;

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
  const mesPontoAtual = todayKey();
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
    avisoEl.innerHTML = `${ICON_ALERT}Ainda há ${abertas} conta${abertas>1?'s':''} em aberto em ${monthLabel(mesContasAtual)}. Você pode concluir mesmo assim.`;
  } else {
    avisoEl.style.display = 'none';
  }
  document.getElementById('modalConcluirMes').classList.add('active');
}
function confirmarConcluirMes(){
  mesAtualRef = addMonths(mesAtualRef, 1);
  localStorage.setItem(MES_ATUAL_KEY, mesAtualRef);
  state.panoOffset = 0;
  state.pontoOffset = 0;
  state.focusMonth = mesFinanceiroAtual();
  closeModal('modalConcluirMes');
  renderAll();
  showToast('Mês concluído — avançou para ' + monthLabel(mesFinanceiroAtual()));
}

/* ================= MODAIS (fechar) ================= */
function closeModal(id){ document.getElementById(id).classList.remove('active'); }
document.querySelectorAll('.modal-overlay').forEach(ov=>{
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('active'); });
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

