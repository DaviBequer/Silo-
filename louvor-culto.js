/* ================= CULTO: roteiro por data (partes do culto) + WhatsApp + histórico de músicas =================
   state.cultos = [{ id, data:'AAAA-MM-DD', partes:[{ id, nome, quem, musicas:[louvorId] }], criadoEm }]
   Ao abrir uma data nova, o roteiro nasce com as partes padrão e as músicas agendadas para essa data entram em "Hinos".
   O histórico conta cada música uma vez por data: as que estão em cultos que já passaram + as agendadas (data) que já passaram. */
const CULTO_PARTES_PADRAO = ['Abertura', 'Hinos', 'Harpa', 'Boas-vindas', 'Hino', 'Pregação', 'Final'];
let cultoData = '', cultoAba = 'roteiro', cultoEscolherParte = null;

function cultosLista(){ if(!state.cultos) state.cultos = []; return state.cultos; }
function cultoId(p){ return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function cultoHojeISO(){ return calISO(new Date()); }
function cultoDataTexto(iso, longo){
  const d = calParse(iso); if(!d) return '';
  const dia = d.toLocaleDateString('pt-BR', { weekday:'long' });
  const dm = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  return longo ? dia.charAt(0).toUpperCase() + dia.slice(1) + ', ' + dm : dm + '/' + String(d.getFullYear()).slice(2);
}
/* próxima data com culto/música agendada a partir de hoje; senão o próximo domingo */
function cultoProximaData(){
  const hoje = cultoHojeISO();
  const datas = [...cultosLista().map(c=>c.data), ...(state.louvores||[]).map(l=>l.dataAgendamento)].filter(d=>d && d >= hoje).sort();
  if(datas.length) return datas[0];
  const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return calISO(d);
}
function cultoDaData(data){ return cultosLista().find(c=>c.data === data) || null; }
/* rascunho de um culto que ainda não existe (só vira registro quando você mexe) */
function cultoNovo(data){
  const agendadas = (state.louvores||[]).filter(l=>l.dataAgendamento === data).map(l=>l.id);
  return { id: cultoId('cu'), data, criadoEm: Date.now(), partes: CULTO_PARTES_PADRAO.map(nome=>({ id: cultoId('cp'), nome, quem:'', musicas: nome === 'Hinos' ? agendadas.slice() : [] })) };
}
let cultoRascunho = null;
function cultoAtual(){
  const c = cultoDaData(cultoData);
  if(c) return c;
  if(!cultoRascunho || cultoRascunho.data !== cultoData) cultoRascunho = cultoNovo(cultoData);
  return cultoRascunho;
}
/* qualquer mudança: se ainda é rascunho, passa a existir */
function cultoGravar(){
  const c = cultoAtual();
  if(!cultoDaData(c.data)){ cultosLista().push(c); cultoRascunho = null; }
  persist();
}

function abrirCulto(){
  cultoData = cultoData || cultoProximaData();
  cultoAba = 'roteiro';
  cultoLimparPartesVazias();
  document.getElementById('pageCulto').classList.add('active');
  document.getElementById('cultoConteudo').scrollTop = 0;
  renderCulto();
  if(typeof atualizarStatusDrive === 'function'){ atualizarStatusDrive(); drivePreparar(); }
}
/* partes sem nome, sem "quem" e sem música (sobras de toques em "Adicionar parte") saem ao abrir */
function cultoLimparPartesVazias(){
  let mudou = false;
  cultosLista().forEach(c=>{
    const antes = c.partes.length;
    c.partes = c.partes.filter(p=>(p.nome||'').trim() || (p.quem||'').trim() || (p.musicas||[]).length);
    if(c.partes.length !== antes) mudou = true;
  });
  if(mudou) persist();
}
function fecharCulto(){ document.getElementById('pageCulto').classList.remove('active'); cultoRascunho = null; }
function cultoTrocarAba(a){ cultoAba = a; renderCulto(); }
function cultoMudarData(v){ if(!v) return; cultoData = v; cultoRascunho = null; renderCulto(); }
function cultoPularData(dias){ const d = calParse(cultoData) || new Date(); d.setDate(d.getDate() + dias); cultoMudarData(calISO(d)); }
function cultoEscolherData(){ document.querySelector('#cultoRoteiro .cu-data .data-btn')?.click(); }

const CU_ICO = {
  sobe:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
  desce:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  x:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
};
function renderCulto(){
  document.querySelectorAll('#cultoAbas .dash-tab').forEach(b=>b.classList.toggle('active', b.dataset.aba === cultoAba));
  document.getElementById('cultoRoteiro').style.display = cultoAba === 'roteiro' ? '' : 'none';
  document.getElementById('cultoHistorico').style.display = cultoAba === 'historico' ? '' : 'none';
  document.getElementById('cultoRodape').style.display = cultoAba === 'roteiro' ? '' : 'none';
  if(cultoAba === 'historico'){ renderCultoHistorico(); return; }
  const inp = document.getElementById('cultoDataInput');
  if(inp.value !== cultoData) inp.value = cultoData;
  const hoje = cultoHojeISO();
  document.getElementById('cultoDataNome').textContent = cultoDataTexto(cultoData, true);
  document.getElementById('cultoDataSub').textContent = cultoData === hoje ? 'hoje' : cultoData < hoje ? 'já passou' : '';
  const c = cultoAtual(), salvo = !!cultoDaData(cultoData);
  document.getElementById('cultoEstado').textContent = salvo ? '' : 'Roteiro novo · as músicas agendadas para esse dia já entraram em Hinos';
  document.getElementById('cultoPartesConta').textContent = c.partes.length ? `${c.partes.length} parte${c.partes.length === 1 ? '' : 's'}` : '';
  document.getElementById('cultoPartes').innerHTML = c.partes.map((p, i)=>{
    const musicas = p.musicas.map(id=>(state.louvores||[]).find(l=>l.id === id)).filter(Boolean);
    return `<div class="cu-parte">
      <span class="cu-parte-num">${i + 1}</span>
      <div class="cu-parte-corpo">
        <div class="cu-parte-topo">
          <input type="text" class="cu-parte-nome" value="${lvEsc(p.nome)}" placeholder="Nome da parte" onchange="cultoParteCampo('${p.id}','nome',this.value)">
          <span class="cu-parte-acoes">
            <button type="button" class="btn-icon-sm" aria-label="Subir" ${i === 0 ? 'disabled' : ''} onclick="cultoMoverParte('${p.id}',-1)">${CU_ICO.sobe}</button>
            <button type="button" class="btn-icon-sm" aria-label="Descer" ${i === c.partes.length - 1 ? 'disabled' : ''} onclick="cultoMoverParte('${p.id}',1)">${CU_ICO.desce}</button>
            <button type="button" class="btn-icon-sm" aria-label="Tirar a parte" onclick="cultoTirarParte('${p.id}')">${CU_ICO.x}</button>
          </span>
        </div>
        <input type="text" class="cu-parte-quem" value="${lvEsc(p.quem || '')}" placeholder="Quem? (opcional)" onchange="cultoParteCampo('${p.id}','quem',this.value)">
        ${musicas.length ? `<div class="cu-musicas">${musicas.map(l=>`
          <div class="cu-musica">
            <button type="button" class="cu-musica-nome" onclick="abrirLouvorDetalhe('${l.id}')">${lvEsc(l.titulo || 'Sem título')}</button>
            ${lvTomAtual(l) ? `<span class="cu-tom">${lvEsc(lvTomAtual(l))}</span>` : ''}
            <button type="button" class="btn-icon-sm" aria-label="Tirar a música" onclick="cultoTirarMusica('${p.id}','${l.id}')">${CU_ICO.x}</button>
          </div>`).join('')}</div>` : ''}
        <button type="button" class="cu-add-musica" onclick="cultoAbrirEscolher('${p.id}')">+ música</button>
      </div>
    </div>`;
  }).join('') || `<div class="gm-vazio">Nenhuma parte. Toque em "Adicionar parte".</div>`;
  /* ordem dos louvores no texto do WhatsApp (não mexe nas partes) */
  const ordem = cultoMusicasOrdem(c).map(id=>(state.louvores||[]).find(l=>l.id === id)).filter(Boolean);
  document.getElementById('cultoOrdem').innerHTML = ordem.length ? `
    <div class="lm-sec-titulo"><span>Ordem no WhatsApp</span><small>só muda o texto do grupo</small></div>
    <div class="cu-ordem">${ordem.map((l, i)=>`
      <div class="cu-ordem-item">
        <span class="cu-ordem-num">${i + 1}</span>
        <span class="cu-ordem-nome">${lvEsc(l.titulo || 'Sem título')}${lvTomAtual(l) ? ` <small>Tom ${lvEsc(lvTomAtual(l))}</small>` : ''}</span>
        <button type="button" class="btn-icon-sm" aria-label="Subir" ${i === 0 ? 'disabled' : ''} onclick="cultoMoverWhats('${l.id}',-1)">${CU_ICO.sobe}</button>
        <button type="button" class="btn-icon-sm" aria-label="Descer" ${i === ordem.length - 1 ? 'disabled' : ''} onclick="cultoMoverWhats('${l.id}',1)">${CU_ICO.desce}</button>
      </div>`).join('')}
    </div>` : '';
  document.getElementById('cultoTextoPrevia').textContent = cultoTexto(c);
}
/* músicas do culto (sem repetir), na ordem escolhida para o WhatsApp; as novas entram no fim */
function cultoMusicasOrdem(c){
  const base = [...new Set(c.partes.flatMap(p=>p.musicas))];
  const ordem = (c.ordemWhats || []).filter(id=>base.includes(id));
  return ordem.concat(base.filter(id=>!ordem.includes(id)));
}
function cultoMoverWhats(id, d){
  const c = cultoAtual(), lista = cultoMusicasOrdem(c), i = lista.indexOf(id), j = i + d;
  if(i < 0 || j < 0 || j >= lista.length) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  c.ordemWhats = lista;
  cultoGravar(); renderCulto();
}
function cultoParte(id){ return cultoAtual().partes.find(p=>p.id === id); }
function cultoParteCampo(id, campo, v){ const p = cultoParte(id); if(!p) return; p[campo] = String(v || '').trim(); cultoGravar(); document.getElementById('cultoTextoPrevia').textContent = cultoTexto(cultoAtual()); }
function cultoMoverParte(id, d){
  const ps = cultoAtual().partes, i = ps.findIndex(p=>p.id === id), j = i + d;
  if(i < 0 || j < 0 || j >= ps.length) return;
  [ps[i], ps[j]] = [ps[j], ps[i]];
  cultoGravar(); renderCulto();
}
function cultoTirarParte(id){
  comDesfazer('Parte removida', ()=>{ const c = cultoAtual(); c.partes = c.partes.filter(p=>p.id !== id); cultoGravar(); renderCulto(); },
    ()=>{ if(document.getElementById('pageCulto').classList.contains('active')) renderCulto(); });
}
function cultoNovaParte(){
  cultoAtual().partes.push({ id: cultoId('cp'), nome:'', quem:'', musicas:[] });
  cultoGravar(); renderCulto();
  const nomes = document.querySelectorAll('.cu-parte-nome'); if(nomes.length){ nomes[nomes.length - 1].focus(); nomes[nomes.length - 1].scrollIntoView({ block:'center', behavior:'smooth' }); }
}
function cultoTirarMusica(parteId, louvorId){ const p = cultoParte(parteId); if(!p) return; p.musicas = p.musicas.filter(id=>id !== louvorId); cultoGravar(); renderCulto(); }
async function cultoApagar(){
  const c = cultoDaData(cultoData);
  if(!c){ cultoRascunho = null; renderCulto(); return; }
  if(!(await iosConfirm('Apagar o roteiro de ' + cultoDataTexto(cultoData, true) + '?'))) return;
  state.cultos = cultosLista().filter(x=>x.id !== c.id);
  persist(); renderCulto();
}
/* ---------- escolher música ---------- */
function cultoAbrirEscolher(parteId){
  cultoEscolherParte = parteId;
  const p = cultoParte(parteId);
  document.getElementById('cultoEscolherTitulo').textContent = 'Música · ' + (p && p.nome || 'parte');
  document.getElementById('cultoEscolherBusca').value = '';
  cultoRenderEscolher();
  document.getElementById('modalCultoEscolher').classList.add('active');
}
function cultoRenderEscolher(){
  const termo = vozSemAcento(document.getElementById('cultoEscolherBusca').value.trim());
  const p = cultoParte(cultoEscolherParte), ja = new Set(p ? p.musicas : []);
  const harpa = p && /harpa/i.test(p.nome);
  let lista = (state.louvores||[]).filter(l=>!termo || vozSemAcento((l.titulo||'') + ' ' + (l.artista||'')).includes(termo));
  /* na parte "Harpa" as músicas da Harpa vêm primeiro; o resto por nome */
  lista.sort((a, b)=>(harpa ? ((b.categoria === 'Harpa Cristã') - (a.categoria === 'Harpa Cristã')) : 0) || (a.titulo||'').localeCompare(b.titulo||''));
  document.getElementById('cultoEscolherLista').innerHTML = lista.length ? lista.slice(0, 80).map(l=>`
    <button type="button" class="cu-escolher-item${ja.has(l.id) ? ' ja' : ''}" onclick="cultoEscolher('${l.id}')">
      <span class="cu-escolher-nome">${lvEsc(l.titulo || 'Sem título')}<small>${lvEsc((l.artista && l.categoria && l.artista.includes(l.categoria) ? [l.artista] : [l.categoria, l.artista]).filter(Boolean).join(' · '))}</small></span>
      <span class="cu-escolher-tom">${ja.has(l.id) ? '✓' : lvEsc(lvTomAtual(l) || '')}</span>
    </button>`).join('') : `<div class="gm-vazio">Nenhuma música com esse nome.</div>`;
}
function cultoEscolher(louvorId){
  const p = cultoParte(cultoEscolherParte); if(!p) return;
  if(p.musicas.includes(louvorId)) p.musicas = p.musicas.filter(id=>id !== louvorId);
  else p.musicas.push(louvorId);
  cultoGravar();
  closeModal('modalCultoEscolher');
  renderCulto();
}

/* ---------- texto para o grupo (só texto; os PDFs vão para o Drive) ---------- */
function cultoTexto(c){
  const musicas = cultoMusicasOrdem(c).map(id=>(state.louvores||[]).find(l=>l.id === id)).filter(Boolean);
  const linhas = ['*Culto · ' + cultoDataTexto(c.data, true) + '*', ''];
  musicas.forEach((l, i)=>linhas.push(`${i + 1}. ${l.titulo || 'Sem título'}${lvTomAtual(l) ? ' (Tom ' + lvTomAtual(l) + ')' : ''}`));
  if(!musicas.length) linhas.push('(sem músicas ainda)');
  return linhas.join('\n').trim();
}async function cultoMandarWhatsApp(){
  const texto = cultoTexto(cultoAtual());
  cultoGravar();
  if(navigator.share){
    try{ await navigator.share({ text: texto }); return; }
    catch(e){ if(e && e.name === 'AbortError') return; }
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
}
async function cultoCopiar(){
  try{ await navigator.clipboard.writeText(cultoTexto(cultoAtual())); showToast('Texto copiado'); }
  catch(e){ showToast('Não consegui copiar'); }
}

/* ---------- histórico: músicas mais tocadas ---------- */
function cultoHistoricoDados(){
  const hoje = cultoHojeISO(), vezes = {};   // louvorId → Set(datas)
  const marca = (id, data)=>{ if(!id || !data || data > hoje) return; (vezes[id] = vezes[id] || new Set()).add(data); };
  cultosLista().forEach(c=>c.partes.forEach(p=>p.musicas.forEach(id=>marca(id, c.data))));
  (state.louvores||[]).forEach(l=>{ marca(l.id, l.dataAgendamento); (l.tocadaEm||[]).forEach(d=>marca(l.id, d)); });
  return Object.entries(vezes).map(([id, datas])=>{
    const l = (state.louvores||[]).find(x=>x.id === id);
    const ds = [...datas].sort();
    return l ? { l, n: ds.length, ultima: ds[ds.length - 1] } : null;
  }).filter(Boolean).sort((a, b)=>b.n - a.n || b.ultima.localeCompare(a.ultima));
}
function renderCultoHistorico(){
  const dados = cultoHistoricoDados(), el = document.getElementById('cultoHistorico');
  if(!dados.length){ el.innerHTML = `<div class="gm-vazio">Ainda não há músicas tocadas. Elas aparecem aqui depois da data do culto.</div>`; return; }
  const maior = dados[0].n;
  /* as que estão há mais tempo sem tocar (pelo menos 2 meses) */
  const limite = calParse(cultoHojeISO()); limite.setMonth(limite.getMonth() - 2);
  const esquecidas = dados.filter(d=>d.ultima < calISO(limite)).sort((a, b)=>a.ultima.localeCompare(b.ultima)).slice(0, 5);
  el.innerHTML = `
    <div class="lm-sec-titulo"><span>Mais tocadas</span><small>${dados.length} músicas</small></div>
    <div class="cu-hist">${dados.slice(0, 30).map((d, i)=>`
      <button type="button" class="cu-hist-item" onclick="abrirLouvorDetalhe('${d.l.id}')">
        <span class="cu-hist-pos">${i + 1}</span>
        <span class="cu-hist-info"><span class="cu-hist-nome">${lvEsc(d.l.titulo || 'Sem título')}</span><span class="cu-hist-barra"><i style="width:${Math.max(6, Math.round(d.n / maior * 100))}%"></i></span></span>
        <span class="cu-hist-num"><b>${d.n}×</b><small>${cultoDataTexto(d.ultima)}</small></span>
      </button>`).join('')}
    </div>
    ${esquecidas.length ? `<div class="lm-sec-titulo"><span>Faz tempo</span><small>sem tocar há mais de 2 meses</small></div>
    <div class="cu-hist">${esquecidas.map(d=>`<button type="button" class="cu-hist-item" onclick="abrirLouvorDetalhe('${d.l.id}')"><span class="cu-hist-pos">·</span><span class="cu-hist-info"><span class="cu-hist-nome">${lvEsc(d.l.titulo || 'Sem título')}</span></span><span class="cu-hist-num"><small>última ${cultoDataTexto(d.ultima)}</small></span></button>`).join('')}</div>` : ''}`;
}

/* linha de baixo do botão "Culto" na aba Louvor: o próximo culto */
function renderCultoBotao(){
  if(typeof atualizarStatusDrive === 'function'){ atualizarStatusDrive(); if(driveClienteId()) drivePreparar(); }
  const el = document.getElementById('lvCultoInfo'); if(!el) return;
  const d = cultoProximaData(), c = cultoDaData(d);
  const n = c ? c.partes.reduce((s, p)=>s + p.musicas.length, 0) : (state.louvores||[]).filter(l=>l.dataAgendamento === d).length;
  el.textContent = `Próximo: ${cultoDataTexto(d, true)}${n ? ` · ${n} ${n === 1 ? 'música' : 'músicas'}` : ''}`;
}