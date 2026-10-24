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
  if(typeof lvPdfCarregarFonte === 'function') lvPdfCarregarFonte();
  cultoData = cultoData || cultoProximaData();
  cultoAba = 'roteiro';
  cuPartesEntrar = true;
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
function cultoMudarData(v){ if(!v) return; cultoData = v; cultoRascunho = null; cuPartesEntrar = true; renderCulto(); }
function cultoPularData(dias){ const d = calParse(cultoData) || new Date(); d.setDate(d.getDate() + dias); cultoMudarData(calISO(d)); }
function cultoEscolherData(){ document.querySelector('#cultoRoteiro .cu-data .data-btn')?.click(); }

const CU_ICO = {
  sobe:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
  desce:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  x:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
};
/* cor pastel de cada parte (segue a parte quando ela muda de lugar) */
const CU_TINTAS = ['#f1e1d2','#e2ead8','#dce6ec','#efdfe6','#ece5cc','#e4e0ef','#d9ebe6'];
function cultoTinta(id, partes){ const ids = partes.map(p=>p.id).sort(); return CU_TINTAS[Math.max(0, ids.indexOf(id)) % CU_TINTAS.length]; }
let cuPartesEntrar = true;   // as partes entram com animação só ao abrir ou trocar a data
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
    return `<div class="cu-parte${cuPartesEntrar ? ' entra' : ''}" data-id="${p.id}" style="--tinta:${cultoTinta(p.id, c.partes)};--i:${i}">
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
        ${musicas.length ? `<div class="cu-musicas">${musicas.map(l=>`
          <div class="cu-musica">
            <button type="button" class="cu-musica-nome" onclick="abrirLouvorDetalhe('${l.id}')"><span class="cu-musica-txt">${lvEsc(cultoNomeMusica(l))}</span>${lvTomAtual(l) ? `<span class="cu-tom">${lvEsc(lvTomAtual(l))}</span>` : ''}</button>
            <button type="button" class="btn-icon-sm" aria-label="Tirar a música" onclick="cultoTirarMusica('${p.id}','${l.id}')">${CU_ICO.x}</button>
          </div>`).join('')}</div>` : ''}
        <button type="button" class="ico-btn cu-add-musica" title="Adicionar música" aria-label="Adicionar música" onclick="cultoAbrirEscolher('${p.id}')">${ICO(ICO_D.mais, 20)}</button>
      </div>
    </div>`;
  }).join('') || `<div class="gm-vazio">Nenhuma parte. Toque em "Adicionar parte".</div>`;
  cuPartesEntrar = false;
  /* ordem dos louvores no texto do WhatsApp (não mexe nas partes) */
  const ordem = cultoMusicasOrdem(c).map(id=>(state.louvores||[]).find(l=>l.id === id)).filter(Boolean);
  document.getElementById('cultoOrdem').innerHTML = ordem.length ? `
    <div class="lm-sec-titulo"><span>Ordem no WhatsApp</span><small>só muda o texto do grupo</small></div>
    <div class="cu-ordem">${ordem.map((l, i)=>`
      <div class="cu-ordem-item">
        <span class="cu-ordem-num">${i + 1}</span>
        <span class="cu-ordem-nome">${lvEsc(cultoNomeMusica(l))}${lvTomAtual(l) ? ` <small>${lvEsc(lvTomAtual(l))}</small>` : ''}</span>
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
  /* as duas partes deslizam devagar até o lugar novo (guarda onde estavam, desenha e anima a diferença) */
  const lista = document.getElementById('cultoPartes'), antes = {};
  lista.querySelectorAll('.cu-parte').forEach(el=>antes[el.dataset.id] = el.getBoundingClientRect().top);
  cultoGravar(); renderCulto();
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  lista.querySelectorAll('.cu-parte').forEach(el=>{
    const dy = (antes[el.dataset.id] ?? 0) - el.getBoundingClientRect().top;
    if(!dy) return;
    el.animate([{ transform:`translateY(${dy}px)` }, { transform:'none' }], { duration: 650, easing:'cubic-bezier(.45,0,.2,1)' });
    if(el.dataset.id === id) el.animate([{ boxShadow:'0 0 0 0 transparent' }, { boxShadow:'0 10px 26px -12px rgba(43,38,32,.35)' }, { boxShadow:'0 0 0 0 transparent' }], { duration: 650 });
  });
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

/* "Cantor - Música" (padrão do Davi em todo o Culto) */
function cultoNomeMusica(l){ return [l.artista, l.titulo || 'Sem título'].filter(x=>(x||'').trim()).join(' - '); }
/* ---------- texto para o grupo (só texto; os PDFs vão para o Drive) ---------- */
function cultoTexto(c){
  const musicas = cultoMusicasOrdem(c).map(id=>(state.louvores||[]).find(l=>l.id === id)).filter(Boolean);
  const linhas = ['*Culto · ' + cultoDataTexto(c.data, true) + '*', ''];
  musicas.forEach((l, i)=>linhas.push(`${i + 1}. ${cultoNomeMusica(l)}${lvTomAtual(l) ? ' - ' + lvTomAtual(l) : ''}`));
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
/* ---------- sugestão de repertório (IA): tema da pregação → músicas do app que combinam, sem repetir as recentes ---------- */
const CU_SUGESTAO_ESQUEMA = { type:'object', properties:{ musicas:{ type:'array', items:{ type:'object', properties:{
  id:{ type:'string', description:'id exato de uma música da lista' }, motivo:{ type:'string', description:'por que combina, curto' }
}, required:['id','motivo'] } } }, required:['musicas'] };
let cuSugestoes = [], cuSugDrive = null;   // PDFs do Drive (lidos uma vez por abertura do app)
function cultoAbrirSugestao(){
  if(typeof lviChaveIA !== 'function' || !lviChaveIA()){ showToast('Precisa da chave da IA (Dados do App → Recursos)'); return; }
  if(!(state.louvores||[]).length){ showToast('Cadastre músicas no Louvor primeiro'); return; }
  const c = cultoAtual();
  document.getElementById('cuSugParte').innerHTML = c.partes.map(p=>`<option value="${p.id}"${/hino|louvor/i.test(p.nome) ? ' selected' : ''}>${lvEsc(p.nome || 'Parte')}</option>`).join('');
  document.getElementById('cuSugLista').innerHTML = '';
  document.getElementById('cuSugAcoes').style.display = 'none';
  document.getElementById('modalCultoSugestao').classList.add('active');
  setTimeout(()=>document.getElementById('cuSugTema').focus(), 80);
}
async function cultoSugerir(){
  const tema = document.getElementById('cuSugTema').value.trim(), qtd = Number(document.getElementById('cuSugQtd').value) || 5;
  const el = document.getElementById('cuSugLista');
  if(!tema){ document.getElementById('cuSugTema').focus(); return; }
  /* Drive primeiro: o pedido de acesso sai ainda dentro do toque (sem await antes) */
  const pedidoDrive = cuSugDrive ? Promise.resolve(cuSugDrive)
    : (typeof driveClienteId === 'function' && driveClienteId() && driveTokenCliente) ? drivePedirToken().then(driveListarPdfs).catch(()=>null) : Promise.resolve(null);
  el.innerHTML = '<div class="voz-carregando">Olhando as músicas do app e do Drive…</div>';
  const pdfs = await pedidoDrive;
  if(pdfs) cuSugDrive = pdfs;
  const hoje = calParse(cultoHojeISO()), ultimas = {};
  cultoHistoricoDados().forEach(h=>{ ultimas[h.l.id] = Math.round((hoje - calParse(h.ultima)) / 864e5); });
  const ja = new Set(cultoAtual().partes.flatMap(p=>p.musicas));
  const lista = (state.louvores||[]).filter(l=>!ja.has(l.id)).map(l=>({ id:l.id, onde:'app', titulo:l.titulo, artista:l.artista||'', categoria:l.categoria||'', tom: lvTomAtual(l), tocadaHaDias: ultimas[l.id] ?? null,
    letra: (l.conteudo||'').split('\n').filter(x=>x.trim() && !isChordLine(x.trim()) && !/^\[.*\]$/.test(x.trim()) && !/^-+$/.test(x.trim())).slice(0, 8).join(' / ').slice(0, 300) }));
  /* PDFs do Drive que ainda não estão no app (só o nome; a IA usa o que conhece da música) */
  const noApp = new Set((state.louvores||[]).map(l=>cuNorm(l.titulo)));
  const vistos = new Set();
  (pdfs || []).forEach(f=>{
    const fi = lviNomeDoArquivo(f.name) || {}, titulo = fi.titulo || f.name.replace(/\.pdf$/i, ''), k = cuNorm(titulo);
    if(!k || noApp.has(k) || vistos.has(k)) return;
    vistos.add(k);
    lista.push({ id:'drive:' + f.id, onde:'drive', titulo, artista: fi.artista || '', categoria: driveTipoDoPdf(f) });
  });
  el.innerHTML = '<div class="voz-carregando">Pensando no repertório…</div>';
  try{
    const j = await lviPerguntarIA([{ type:'text', text:
      `Você ajuda o ministério de louvor de uma igreja evangélica a montar o repertório do culto. Tema da pregação: "${tema}".\n` +
      `Escolha até ${qtd} músicas DA LISTA abaixo que combinam com o tema, em uma boa ordem para o culto. ` +
      `A lista tem as músicas do app (onde:"app", com um trecho da letra) e os PDFs do Drive da igreja (onde:"drive", só o nome: use o que você conhece da letra dessa música). ` +
      `São todas músicas que o grupo sabe tocar; NÃO sugira nada fora da lista. ` +
      `Evite as tocadas há menos de 21 dias (tocadaHaDias), a não ser que não haja outra opção. Use só ids da lista.\n` +
      JSON.stringify(lista) }], t=>{ el.innerHTML = `<div class="voz-carregando">${lvEsc(t)}</div>`; }, CU_SUGESTAO_ESQUEMA);
    cuSugestoes = (j.musicas||[]).map(m=>{
      if(String(m.id).startsWith('drive:')){
        const f = (pdfs || []).find(f=>'drive:' + f.id === m.id), d = lista.find(x=>x.id === m.id);
        return f && d ? { ...m, f, titulo: d.titulo, artista: d.artista, marcado: true } : null;
      }
      const l = (state.louvores||[]).find(l=>l.id === m.id);
      return l ? { ...m, l, titulo: l.titulo, marcado: true } : null;
    }).filter(Boolean);
    el.innerHTML = cuSugestoes.length ? cuSugestoes.map((m, i)=>`
      <label class="cu-sug-item">
        <input type="checkbox" checked onchange="cuSugestoes[${i}].marcado=this.checked">
        <span class="cu-escolher-nome">${lvEsc(m.titulo)}${m.l && lvTomAtual(m.l) ? ` <i class="cu-tom">${lvEsc(lvTomAtual(m.l))}</i>` : ''}${m.f ? ` <i class="cu-sug-drive">Drive</i>` : ''}<small>${lvEsc(m.motivo)}${ultimas[m.id] != null ? ` · tocada há ${ultimas[m.id]} dias` : ''}</small></span>
      </label>`).join('') : '<div class="gm-vazio">A IA não achou músicas que combinem. Tente outro tema.</div>';
    document.getElementById('cuSugAcoes').style.display = cuSugestoes.length ? '' : 'none';
  }catch(e){ el.innerHTML = `<div class="drive-linha erro">${lvEsc(String(e && e.message || e))}</div>`; }
}
async function cultoUsarSugestao(){
  const p = cultoParte(document.getElementById('cuSugParte').value); if(!p) return;
  /* as do Drive viram música no app (só com o arquivo, como no colar do WhatsApp) */
  for(const m of cuSugestoes.filter(m=>m.marcado && m.f && !m.l)){
    try{ m.l = await cultoCriarDoDrive(m.f, m.titulo, m.artista); m.id = m.l.id; }catch(e){ m.marcado = false; }
  }
  const novas = cuSugestoes.filter(m=>m.marcado && m.l && !p.musicas.includes(m.l.id)).map(m=>m.l.id);
  p.musicas.push(...novas);
  cultoGravar();
  closeModal('modalCultoSugestao');
  renderCulto();
  showToast(`${novas.length} ${novas.length === 1 ? 'música adicionada' : 'músicas adicionadas'} em ${p.nome || 'parte'}`);
}

/* ---------- colar o roteiro do WhatsApp ----------
   Ex.: "[21/10, 21:00] +55 47 ...: Abertura: Por caminhos- Mara Lima (E)", "Harpa: 88 (G)", "O Deus do impossível ( C)",
   "Após a Palavra: Medley- Adorador (Eliane Fernandes) + Nada pode calar um adorador (Mi maior)".
   Cada música: já está no app → usa; senão, se há um PDF com o nome no Drive → cria a música só com o arquivo (o Comparar mostra o PDF);
   senão → cria pelo Cifra Club como na importação normal. Linha sem "Parte:" vai para "Hinos" (ou para a última parte que veio sozinha numa linha). */
let cuColar = [];
const cuNorm = s=>vozSemAcento(s).replace(/[^a-z0-9#]+/g, ' ').trim();
const CU_SOLFEJO = { do:'C', re:'D', mi:'E', fa:'F', sol:'G', la:'A', si:'B' };
function cultoColarTom(txt){
  const s = String(txt || '').trim();
  let m = /^([A-G])\s*(#|b)?\s*(m|min|menor)?\s*(maior)?$/.exec(s);
  if(m) return { raiz: m[1] + (m[2] || ''), menor: !!m[3] };
  m = /^(do|re|mi|fa|sol|la|si)\s*(#|sustenido|b|bemol)?\s*(maior|menor|m)?$/.exec(vozSemAcento(s).trim());
  if(m) return { raiz: CU_SOLFEJO[m[1]] + (m[2] ? (/^(#|sus)/.test(m[2]) ? '#' : 'b') : ''), menor: m[3] === 'menor' || m[3] === 'm' };
  return null;
}
function cultoColarParse(texto){
  const itens = []; let cabecalho = '';
  String(texto || '').split(/\r?\n/).forEach(linha=>{
    let s = linha
      .replace(/^\s*\[[^\]]*\]\s*[^:]{1,40}:\s*/, '')                                         // [21/10, 20:25] +55 47 ...:
      .replace(/^\s*\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}\s*-\s*[^:]{1,40}:\s*/, '')   // 21/10/2026 20:25 - Nome:
      .replace(/[*_~]/g, '').trim();
    if(!s || /^culto\b/i.test(s) || /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(s)) return;
    s = s.replace(/^\s*(\d+\s*[.)]\s+|[-•·▪]\s+)/, '');
    let parte = '';
    const mp = /^([^:]{2,30}):\s*(.*)$/.exec(s);
    if(mp && !/\d/.test(mp[1])){ parte = mp[1].trim(); s = mp[2].trim(); }
    if(!s){ if(parte) cabecalho = parte; return; }
    /* tom: "(E)", "( C)", "(Mi maior)" no fim, ou " - D" no fim */
    let tom = null;
    const mt = /\(\s*([^()]*?)\s*\)\s*$/.exec(s);
    if(mt && cultoColarTom(mt[1])){ tom = cultoColarTom(mt[1]); s = s.slice(0, mt.index).trim(); }
    else { const md = /\s[-–]\s*([A-G](?:#|b)?)(m?)\s*$/.exec(s); if(md){ tom = { raiz: md[1], menor: !!md[2] }; s = s.slice(0, md.index).trim(); } }
    const medley = /^medley\b/i.test(s) || /\s\+\s/.test(s);   // "Medley- A + B" (ou só "A + B"): as músicas viram um medley
    const grupo = medley ? 'md' + itens.length : '';
    s = s.replace(/^medley\s*[-–:]?\s*/i, '');
    const nomeParte = parte || cabecalho || 'Hinos';
    s.split(/\s+\+\s+/).forEach(peca=>{
      let titulo = peca.trim(), artista = '';
      const ma = /\(\s*([^()]+?)\s*\)\s*$/.exec(titulo);
      if(ma && !cultoColarTom(ma[1])){ artista = ma[1]; titulo = titulo.slice(0, ma.index).trim(); }
      else { const sp = titulo.split(/\s*[–—-]\s*/); if(sp.length >= 2 && sp[0] && sp[1]){ titulo = sp[0]; artista = sp.slice(1).join(' - '); } }
      titulo = titulo.replace(/\s+/g, ' ').trim();
      if(!titulo) return;
      const harpaNum = /harpa/.test(vozSemAcento(nomeParte)) && /^\d{1,3}$/.test(titulo) ? titulo : '';
      itens.push({ parte: nomeParte, titulo, artista: artista.trim(), tom, medley, grupo, harpaNum, status:'', id:'' });
    });
  });
  return itens;
}
/* música já no app: Harpa pelo número; as outras pelo nome (aceita "Música - Cantor" ou "Cantor - Música") */
function cultoColarNoApp(it){
  const L = state.louvores || [];
  if(it.harpaNum){
    const re = new RegExp('(^|\\D)' + it.harpaNum + '(\\D|$)');
    return L.find(l=>(l.categoria === 'Harpa Cristã' || /harpa/i.test(l.artista || '')) && re.test((l.titulo || '') + ' ' + (l.artista || ''))) || null;
  }
  const parecido = (a, b)=>!!a && !!b && (a === b || (a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a))));
  const t = cuNorm(it.titulo), a = cuNorm(it.artista);
  const achados = L.filter(l=>parecido(cuNorm(l.titulo), t) || (a && parecido(cuNorm(l.titulo), a)));
  /* com cantor: só a desse cantor (mesmo nome de outro cantor é outra letra); sem cantor: só se não houver dúvida */
  if(a) return achados.find(l=>parecido(cuNorm(l.artista), a) || parecido(cuNorm(l.artista), t)) || null;
  return new Set(achados.map(l=>cuNorm(l.artista))).size === 1 ? achados[0] : null;
}
function cultoColarAbrir(){
  cuColar = []; cuColarMontando = false; cuColarMedleys = {};
  document.getElementById('cuColarTexto').value = '';
  document.getElementById('cuColarLista').innerHTML = '';
  document.getElementById('cuColarAcoes').style.display = 'none';
  const b = document.getElementById('cuColarMontar'); b.disabled = false; b.textContent = 'Montar o roteiro'; b.onclick = cultoColarMontar;
  document.getElementById('modalCultoColar').classList.add('active');
  document.getElementById('cuColarPergunta').style.display = 'none';
  document.getElementById('cuColarTexto').style.display = '';
  document.querySelector('#modalCultoColar .cu-colar-btn').style.display = '';
  if(typeof driveClienteId === 'function' && driveClienteId()) drivePreparar();
}
/* botão "Colar o que copiei": puxa o último texto da área de transferência */
async function cultoColarDaAreaDeTransferencia(){
  try{
    const t = await navigator.clipboard.readText();
    if(!(t || '').trim()){ showToast('A área de transferência está vazia — copie o texto no WhatsApp'); return; }
    document.getElementById('cuColarTexto').value = t;
    cultoColarLer();
  }catch(e){
    showToast('O celular não deixou ler o que foi copiado: segure no campo e escolha Colar');
    document.getElementById('cuColarTexto').focus();
  }
}
/* pergunta dentro da janela (qual das opções, cantor): devolve uma promessa com a resposta */
/* pergunta DENTRO da linha da música (opções, cantor): guarda em it.pergunta e devolve uma promessa com a resposta */
function cultoColarPerguntar(it, html, montar){
  return new Promise(ok=>{
    it.pergunta = { html, montar, fim: v=>{ delete it.pergunta; cultoColarRender(); ok(v); } };
    cultoColarRender();
    document.querySelector(`.cu-colar-item[data-i="${cuColar.indexOf(it)}"]`)?.scrollIntoView({ block:'center', behavior:'smooth' });
  });
}
/* opções primeiro; se nenhuma for a certa, "Digitar o cantor" (busca de novo) ou "criar só com o nome".
   → { i } escolheu a opção i · { cantor } quer buscar com esse cantor · { nenhuma:true } */
function cultoColarPerguntarOpcao(it, titulo, opcoes, nenhuma, comCantor){
  return cultoColarPerguntar(it, `
    <div class="cu-perg-tit">${titulo}</div>
    ${opcoes.length ? `<div class="cu-colar-opcoes">${opcoes.map((o, i)=>`<button type="button" class="cu-opcao" style="--i:${i}" data-op="${i}"><span class="cu-opcao-nome">${lvEsc(o.nome)}<small>${lvEsc(o.sub || '')}</small></span><span class="cu-opcao-seta">${ICO(ICO_D.baixar, 17)}</span></button>`).join('')}</div>` : '<div class="cu-perg-desc">Não achei nenhuma opção com esse nome.</div>'}
    ${comCantor ? `<form class="voz-escrever cu-perg-cantor"${opcoes.length ? ' hidden' : ''}><input type="text" class="voz-campo" placeholder="Nome do cantor (ex.: Aline Barros)" autocomplete="off" enterkeyhint="search"><button type="submit" class="btn">Buscar</button></form>` : ''}
    <div class="cu-perg-links">${comCantor && opcoes.length ? '<button type="button" class="link-txt cu-perg-digitar">Não é nenhuma: digitar o cantor</button>' : ''}<button type="button" class="link-txt cu-perg-pular">${lvEsc(nenhuma)}</button></div>`, (fim, el)=>{
    el.querySelectorAll('[data-op]').forEach(b=>b.onclick = ()=>{ b.classList.add('escolhida'); setTimeout(()=>fim({ i: Number(b.dataset.op) }), 180); });
    el.querySelector('.cu-perg-pular').onclick = ()=>fim({ nenhuma: true });
    const form = el.querySelector('.cu-perg-cantor');
    if(form){
      const inp = form.querySelector('input');
      form.onsubmit = e=>{ e.preventDefault(); if(inp.value.trim()) fim({ cantor: inp.value.trim() }); };
      const dig = el.querySelector('.cu-perg-digitar');
      if(dig) dig.onclick = ()=>{ form.hidden = false; dig.remove(); inp.focus(); };
      else setTimeout(()=>inp.focus(), 60);
    }
  });
}
function cultoColarLer(){
  cuColar = cultoColarParse(document.getElementById('cuColarTexto').value);
  /* "Boas vindas" / "Haŕpa" → o nome da parte que já existe no roteiro (Boas-vindas, Harpa) */
  const existentes = cultoAtual().partes;
  cuColar.forEach(it=>{ const p = existentes.find(x=>cuNorm(x.nome) === cuNorm(it.parte)); it.parte = p ? p.nome : it.parte.replace(/ŕ/g, 'r'); });
  /* no medley a música precisa ter a cifra: a que está no app só com o PDF do Drive é buscada de novo */
  cuColar.forEach(it=>{ const l = cultoColarNoApp(it); const serve = l && !(it.grupo && !(l.conteudo || '').trim()); it.id = serve ? l.id : ''; it.status = serve ? 'app' : ''; });
  cultoColarRender(true);
}
const CU_COLAR_ST = { app:'já está no app', drive:'do Drive (só o arquivo)', cifra:'criada pelo Cifra Club', vazia:'criada só com o nome', pulada:'não entrou' };
const CU_COLAR_ICO = {
  ok:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  erro:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 7v6"/><path d="M12 17h.01"/></svg>'
};
let cuColarMontando = false;
function cultoColarRender(entrar){
  const partes = [...new Set([...cultoAtual().partes.map(p=>p.nome).filter(Boolean), ...cuColar.map(it=>it.parte)])];
  const feito = s=>['app','drive','cifra'].includes(s), ruim = s=>['erro','vazia','pulada'].includes(s);
  const opcoesParte = sel=>partes.map(p=>`<option${p === sel ? ' selected' : ''}>${lvEsc(p)}</option>`).join('');
  const grupoVisto = {};
  const lista = document.getElementById('cuColarLista');
  lista.innerHTML = cuColar.length ? cuColar.map((it, i)=>{
    const primeiro = it.grupo && !grupoVisto[it.grupo]; if(it.grupo) grupoVisto[it.grupo] = true;
    const doGrupo = it.grupo ? cuColar.filter(x=>x.grupo === it.grupo) : [];
    const posNoGrupo = doGrupo.indexOf(it);
    const medleyId = it.grupo && cuColarMedleys[it.grupo];
    return `${primeiro ? `<div class="cu-colar-medley${entrar ? ' entra' : ''}" style="--i:${i}">
        <div class="cu-md-txt"><span>Medley</span><small>${doGrupo.length} músicas · vira um arquivo só: do Drive ou com as cifras juntas</small></div>
        ${medleyId ? '' : `<select class="cu-colar-parte" aria-label="Parte do medley" onchange="cuColar.filter(x=>x.grupo==='${it.grupo}').forEach(x=>x.parte=this.value)">${opcoesParte(it.parte)}</select>`}
      </div>` : ''}
    <div class="cu-colar-item${it.status === 'buscando' ? ' ativo' : ''}${it.grupo ? ' no-medley' : ''}${it.pergunta ? ' perguntando' : ''}${entrar ? ' entra' : ''}" style="--i:${i}" data-i="${i}">
      <span class="cu-colar-ico ${feito(it.status) ? 'ok' : ruim(it.status) ? 'erro' : it.status === 'buscando' ? 'gira' : ''}">${feito(it.status) ? CU_COLAR_ICO.ok : ruim(it.status) ? CU_COLAR_ICO.erro : it.grupo ? posNoGrupo + 1 : ''}</span>
      <div class="cu-colar-musica"><b>${it.harpaNum ? 'Harpa ' + lvEsc(it.harpaNum) : lvEsc(it.titulo)}${it.tom ? ` <span class="cu-tom">${lvEsc(it.tom.raiz + (it.tom.menor ? 'm' : ''))}</span>` : ''}</b>${it.artista ? `<small>${lvEsc(it.artista)}</small>` : ''}</div>
      ${it.grupo
        ? ''
        : `<select class="cu-colar-parte" aria-label="Parte" onchange="cuColar[${i}].parte=this.value">${opcoesParte(it.parte)}</select>`}
      <span class="cu-colar-st ${it.status}">${lvEsc(it.status === 'erro' ? it.erro : it.status === 'buscando' ? (it.passo || 'buscando…') : (CU_COLAR_ST[it.status] || (it.grupo ? 'vai buscar a cifra' : 'vai buscar no Drive ou no Cifra Club')))}</span>
      ${it.status === 'buscando' && !it.pergunta ? '<div class="cu-colar-barra"><i></i></div>' : ''}
      ${it.pergunta ? `<div class="cu-colar-pergunta">${it.pergunta.html}</div>` : ''}
    </div>`;
  }).join('') : '<div class="gm-vazio">Toque em "Colar o que copiei" (ou cole no campo): cada linha vira uma música no roteiro.</div>';
  cuColar.forEach((it, i)=>{ if(it.pergunta){ const el = lista.querySelector(`.cu-colar-item[data-i="${i}"] .cu-colar-pergunta`); if(el) it.pergunta.montar(it.pergunta.fim, el); } });
  document.getElementById('cuColarAcoes').style.display = cuColar.length ? '' : 'none';
}
/* medleys criados nesta montagem (grupo → id da música do medley) */
let cuColarMedleys = {};
/* andamento de uma música (aparece na linha dela com a barrinha correndo) */
function cultoColarPasso(it, txt){ it.passo = txt; cultoColarRender(); }
async function cultoColarMontar(){
  if(!cuColar.length) return;
  const btn = document.getElementById('cuColarMontar'); btn.disabled = true; btn.textContent = 'Montando…';
  cuColarMontando = true; cuColarMedleys = {};
  document.getElementById('cuColarTexto').style.display = 'none';
  document.querySelector('#modalCultoColar .cu-colar-btn').style.display = 'none';
  /* Drive: o pedido de acesso sai ainda dentro do toque */
  const faltam = cuColar.filter(it=>!it.id && !it.grupo), grupos = [...new Set(cuColar.filter(it=>it.grupo).map(it=>it.grupo))];
  let pdfs = null;
  if((faltam.length || grupos.length) && typeof driveClienteId === 'function' && driveClienteId() && driveTokenCliente){
    const primeiro = faltam[0] || cuColar.find(it=>it.grupo);
    primeiro.status = 'buscando'; cultoColarPasso(primeiro, 'Abrindo o Drive…');
    try{ await drivePedirToken(); pdfs = await driveListarPdfs(); }catch(e){ pdfs = null; }
  }
  for(const it of faltam){
    it.status = 'buscando'; cultoColarRender();
    document.querySelectorAll('.cu-colar-item')[cuColar.indexOf(it)]?.scrollIntoView({ block:'nearest', behavior:'smooth' });
    try{
      const l = (pdfs && await cultoColarDoDrive(it, pdfs)) || await cultoColarDoCifraClub(it);
      it.id = l ? l.id : '';
      if(!l) it.status = 'pulada';
    }catch(e){ it.status = 'erro'; it.erro = 'erro: ' + ((e && e.message) || e); }
    cultoColarRender();
  }
  /* medley: um arquivo só (do Drive, ou as cifras juntas numa música) */
  for(const g of grupos){
    const membros = cuColar.filter(x=>x.grupo === g);
    try{
      const l = await cultoColarMedleyMontar(membros, pdfs);
      cuColarMedleys[g] = l ? l.id : '';
    }catch(e){ membros.forEach(m=>{ m.status = 'erro'; m.erro = 'erro: ' + ((e && e.message) || e); }); }
    cultoColarRender();
  }
  /* tom pedido em cada música (o do medley já foi aplicado em cada parte dele) */
  const L = id=>(state.louvores || []).find(x=>x.id === id);
  cuColar.forEach(it=>{
    if(it.grupo) return;
    const l = it.id && L(it.id); if(!l || !it.tom) return;
    const ts = lviTomSiloe(it.tom.raiz, it.tom.menor);
    if(ts.tomOriginal && (ts.tomOriginal !== l.tomOriginal || ts.tomModoMenor !== !!l.tomModoMenor)) lvAplicarTom(l, ts.tomOriginal, ts.tomModoMenor);
  });
  /* põe no roteiro (cria a parte se não existir, antes do "Final"); medley entra como UMA música (a do medley) */
  const c = cultoAtual(), feitos = {};
  cuColar.forEach(it=>{
    let id = it.id;
    if(it.grupo){
      if(feitos[it.grupo] !== undefined) return;
      id = feitos[it.grupo] = cuColarMedleys[it.grupo] || '';
    }
    const l = id && L(id); if(!l) return;
    let p = c.partes.find(x=>cuNorm(x.nome) === cuNorm(it.parte));
    if(!p){
      p = { id: cultoId('cp'), nome: it.parte, quem:'', musicas:[] };
      const fim = c.partes.findIndex(x=>cuNorm(x.nome) === 'final');
      fim >= 0 ? c.partes.splice(fim, 0, p) : c.partes.push(p);
    }
    if(!p.musicas.includes(l.id)) p.musicas.push(l.id);
  });
  cultoGravar(); renderCulto(); renderLouvor(); cultoColarRender();
  btn.disabled = false; btn.textContent = 'Pronto'; btn.onclick = ()=>closeModal('modalCultoColar');
  const n = c.partes.reduce((s, p)=>s + p.musicas.length, 0);
  showToast(`✓ Roteiro montado · ${n} ${n === 1 ? 'música' : 'músicas'}`);
}
/* medley = UM arquivo só (pedido do Davi: nada de uma música para cada parte).
   1º o Drive: PDF com o nome de todas as músicas do medley (ou "Medley" + uma delas) → música só com o arquivo.
   Senão as cifras (a do app, se já existe com cifra; senão a do Cifra Club, sem criar a música sozinha) viram uma música só:
   "[♪ Nome — Tom X]" antes de cada uma, cada uma no tom pedido. Os links do Cifra Club ficam em l.cifraLinks. */
async function cultoColarMedleyMontar(membros, pdfs){
  const titulos = membros.map(m=>m.titulo).filter(Boolean);
  const nomeMedley = 'Medley ' + titulos.join(' + ');
  const artistas = [...new Set(membros.map(m=>m.artista).filter(Boolean))].join(' · ');
  const passo = (m, t)=>{ m.status = 'buscando'; m.passo = t; cultoColarRender(); };
  /* 1. Drive */
  if(pdfs){
    membros.forEach(m=>passo(m, 'Procurando o medley no Drive…'));
    const nome = f=>cuNorm(f.name.replace(/\.pdf$/i, ''));
    const ts = titulos.map(cuNorm).filter(t=>t.length >= 4);
    let cands = ts.length ? pdfs.filter(f=>ts.every(t=>nome(f).includes(t))) : [];
    if(!cands.length) cands = pdfs.filter(f=>/medley/.test(nome(f)) && ts.some(t=>nome(f).includes(t)));
    let f = cands[0];
    if(cands.length > 1){
      passo(membros[0], 'esperando você escolher o arquivo…');
      const r = await cultoColarPerguntarOpcao(membros[0], `Achei ${cands.length} PDFs desse medley no Drive. Qual é?`,
        cands.slice(0, 8).map(f=>({ nome: f.name.replace(/\.pdf$/i, ''), sub: f.pasta })), 'Nenhum: montar com as cifras', false);
      f = r.i === undefined ? null : cands[r.i];
    }
    if(f){
      const l = await cultoCriarDoDrive(f, nomeMedley, artistas);
      membros.forEach(m=>{ m.status = 'drive'; m.id = l.id; });
      return l;
    }
  }
  /* 2. as cifras juntas numa música só */
  const L = id=>(state.louvores || []).find(x=>x.id === id);
  const blocos = [], links = [];
  let tomPrimeira = null;
  for(const m of membros){
    let texto = '', tom = '', menor = false;
    const app = m.id && L(m.id);
    if(app && (app.conteudo || '').trim()){ texto = app.conteudo; tom = lvTomMaiorAtual(app); menor = !!app.tomModoMenor; m.status = 'app'; }
    else {
      const res = await cultoColarDoCifraClub(m, false);
      if(res){ texto = res.r.dados.conteudo; tom = res.r.dados.tomOriginal; menor = !!res.r.dados.tomModoMenor; links.push({ titulo: m.titulo, url: res.url }); m.status = 'cifra'; }
    }
    /* no tom pedido ("Mi maior", "(E)") */
    const alvo = m.tom ? lviTomSiloe(m.tom.raiz, m.tom.menor) : null;
    if(texto && alvo && alvo.tomOriginal && tom){
      const de = lvPc(tom), para = lvPc(alvo.tomOriginal);
      if(de !== -1 && para !== -1 && de !== para) texto = lvTransposeConteudoTexto(texto, ((para - de) % 12 + 12) % 12, alvo.tomOriginal, tom);
      tom = alvo.tomOriginal; menor = alvo.tomModoMenor;
    }
    if(!tomPrimeira && tom) tomPrimeira = { tom, menor };
    const tomTxt = tom ? (menor ? lvRelativoMenor(tom) + 'm' : tom) : '';
    blocos.push(`[♪ ${(m.titulo || 'Música').replace(/[\[\]]/g, '')}${tomTxt ? ' — Tom ' + tomTxt : ''}]` + (texto ? '\n' + texto.trim() : ''));
    m.id = '';   // a música sozinha não entra no app nem no roteiro
  }
  const conteudo = blocos.join('\n--\n');
  const ja = (state.louvores || []).find(l=>cuNorm(l.titulo) === cuNorm(nomeMedley));
  const l = ja || lvCriarDireto({ titulo: nomeMedley, artista: artistas, categoria: 'Louvor' }, false);
  Object.assign(l, { conteudo, tomOriginal: tomPrimeira ? tomPrimeira.tom : '', tomModoMenor: tomPrimeira ? tomPrimeira.menor : false, transpose: 0 });
  if(links.length){ l.cifraLinks = links; if(!l.origem) l.origem = { tipo:'cifraclub', url: links[0].url, texto:'', letras: null, quando: Date.now() }; }
  persist();
  membros.forEach(m=>{ m.id = l.id; });
  return l;
}
/* Drive: PDF com o nome da música (Harpa: o número num PDF da Harpa) → música só com o arquivo, sem tirar o texto.
   Mais de um PDF possível (cantores diferentes) → pergunta qual. */
async function cultoColarDoDrive(it, pdfs){
  cultoColarPasso(it, 'Procurando no Drive…');
  const t = cuNorm(it.titulo), a = cuNorm(it.artista), nome = f=>cuNorm(f.name.replace(/\.pdf$/i, ''));
  let cands = it.harpaNum
    ? pdfs.filter(f=>/harpa/i.test(f.pasta + ' ' + f.name) && new RegExp('(^|\\D)' + it.harpaNum + '(\\D|$)').test(f.name))
    : t.length >= 4 ? pdfs.filter(f=>nome(f).includes(t)) : [];
  if(a && !it.harpaNum) cands = cands.filter(f=>nome(f).includes(a));   // com cantor: só o dele
  if(!cands.length) return null;
  let f = cands[0];
  if(cands.length > 1){
    cultoColarPasso(it, 'esperando você escolher o arquivo…');
    const r = await cultoColarPerguntarOpcao(it, `Achei ${cands.length} PDFs de <b>${lvEsc(it.harpaNum ? 'Harpa ' + it.harpaNum : it.titulo)}</b> no Drive. Qual é?`,
      cands.slice(0, 8).map(f=>({ nome: f.name.replace(/\.pdf$/i, ''), sub: f.pasta })), 'Nenhum: buscar no Cifra Club', false);
    if(r.i === undefined) return null;
    f = cands[r.i];
  }
  cultoColarPasso(it, 'Ligando ao PDF do Drive…');
  const l = await cultoCriarDoDrive(f, it.titulo, it.artista);
  it.status = 'drive';
  return l;
}
/* música nova só com o arquivo do Drive (sem tirar o texto nem baixar o PDF) */
async function cultoCriarDoDrive(f, titulo, artista){
  const fi = lviNomeDoArquivo(f.name) || {};
  const tom = fi.tom ? lviTomSiloe(fi.tom, fi.menor) : null;
  const l = lvCriarDireto({ titulo: fi.titulo || titulo, artista: fi.artista || artista || '',
    categoria: lviEhHarpa(f.pasta + ' ' + f.name) ? 'Harpa Cristã' : /corinho/i.test(f.pasta + ' ' + f.name) ? 'Corinhos' : 'Louvor',
    tomOriginal: tom ? tom.tomOriginal : '', tomModoMenor: tom ? tom.tomModoMenor : false }, false);
  l.origem = { tipo:'drive', id: f.id, nome: f.name, link: f.webViewLink || '', pasta: f.pasta || '', soArquivo: true };
  persist();   // o PDF não é baixado: o Comparar mostra a prévia do Drive pelo link
  return l;
}
/* Cifra Club: pega sozinho só quando o nome E o cantor batem; senão mostra as opções primeiro.
   Nenhuma é a certa → digitar o cantor e buscar de novo (ou criar só com o nome). */
async function cultoColarDoCifraClub(it, criar){   // criar=false: só lê (medley) → { r, url } ou null
  const t = cuNorm(it.titulo);
  let m = null;
  for(let volta = 0; volta < 4 && !m; volta++){
    cultoColarPasso(it, 'Buscando no Cifra Club…');
    const a = cuNorm(it.artista);
    const busca = it.harpaNum ? 'harpa cristã ' + it.harpaNum : (it.titulo + ' ' + it.artista).trim();
    const lista = (await ccChamar({ busca })).musicas || [];
    const bate = m=>cuNorm(m.titulo) === t && (cuNorm(m.artista).includes(a) || a.includes(cuNorm(m.artista)));
    m = it.harpaNum
      ? lista.find(m=>/harpa-crista/i.test(m.url) && new RegExp('(^|\\D)' + it.harpaNum + '(\\D|$)').test(m.titulo + ' ' + m.artista + ' ' + m.url))
      : (a ? lista.find(bate) : null);
    if(m) break;
    cultoColarPasso(it, 'esperando você escolher…');
    const r = await cultoColarPerguntarOpcao(it, `Qual destas é <b>${lvEsc(it.harpaNum ? 'Harpa ' + it.harpaNum : it.titulo)}</b>${it.artista ? ' (' + lvEsc(it.artista) + ')' : ''}?`,
      lista.slice(0, 8).map(m=>({ nome: m.titulo, sub: m.artista })), 'Nenhuma: criar só com o nome', !it.harpaNum);
    if(r.i !== undefined){ m = lista[r.i]; break; }
    if(r.cantor){ it.artista = r.cantor; cultoColarRender(); continue; }
    break;   // nenhuma
  }
  if(!m){
    if(criar === false){ it.status = 'vazia'; return null; }
    const l = lvCriarDireto({ titulo: it.titulo, artista: it.harpaNum ? 'Harpa Cristã - ' + it.harpaNum : it.artista, categoria: it.harpaNum ? 'Harpa Cristã' : 'Louvor' }, false);
    it.status = 'vazia';
    return l;
  }
  const r = await ccMontar(m.url, t=>cultoColarPasso(it, t), ()=>{});
  if(criar === false) return { r, url: m.url };
  const l = lvCriarDireto(r.dados, false);
  ccGuardarOrigem(l, r, m.url);
  it.status = 'cifra';
  return l;
}
