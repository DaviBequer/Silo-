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
        ${musicas.length ? `<div class="cu-musicas">${musicas.map(l=>`
          <div class="cu-musica">
            <button type="button" class="cu-musica-nome" onclick="abrirLouvorDetalhe('${l.id}')"><span class="cu-musica-txt">${lvEsc(cultoNomeMusica(l))}</span>${lvTomAtual(l) ? `<span class="cu-tom">${lvEsc(lvTomAtual(l))}</span>` : ''}</button>
            <button type="button" class="btn-icon-sm" aria-label="Tirar a música" onclick="cultoTirarMusica('${p.id}','${l.id}')">${CU_ICO.x}</button>
          </div>`).join('')}</div>` : ''}
        <button type="button" class="ico-btn cu-add-musica" title="Adicionar música" aria-label="Adicionar música" onclick="cultoAbrirEscolher('${p.id}')">${ICO(ICO_D.mais, 20)}</button>
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
let cuSugestoes = [];
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
  el.innerHTML = '<div class="voz-carregando">Pensando no repertório…</div>';
  const hoje = calParse(cultoHojeISO()), ultimas = {};
  cultoHistoricoDados().forEach(h=>{ ultimas[h.l.id] = Math.round((hoje - calParse(h.ultima)) / 864e5); });
  const ja = new Set(cultoAtual().partes.flatMap(p=>p.musicas));
  const lista = (state.louvores||[]).filter(l=>!ja.has(l.id)).map(l=>({ id:l.id, titulo:l.titulo, artista:l.artista||'', categoria:l.categoria||'', tom: lvTomAtual(l), tocadaHaDias: ultimas[l.id] ?? null,
    letra: (l.conteudo||'').split('\n').filter(x=>x.trim() && !isChordLine(x.trim()) && !/^\[.*\]$/.test(x.trim()) && !/^-+$/.test(x.trim())).slice(0, 8).join(' / ').slice(0, 300) }));
  try{
    const j = await lviPerguntarIA([{ type:'text', text:
      `Você ajuda o ministério de louvor de uma igreja evangélica a montar o repertório do culto. Tema da pregação: "${tema}".\n` +
      `Escolha até ${qtd} músicas DA LISTA abaixo que combinam com o tema (pela letra), em uma boa ordem para o culto. ` +
      `Evite as tocadas há menos de 21 dias (tocadaHaDias), a não ser que não haja outra opção. Use só ids da lista.\n` +
      JSON.stringify(lista) }], t=>{ el.innerHTML = `<div class="voz-carregando">${lvEsc(t)}</div>`; }, CU_SUGESTAO_ESQUEMA);
    cuSugestoes = (j.musicas||[]).map(m=>({ ...m, l: (state.louvores||[]).find(l=>l.id === m.id), marcado: true })).filter(m=>m.l);
    el.innerHTML = cuSugestoes.length ? cuSugestoes.map((m, i)=>`
      <label class="cu-sug-item">
        <input type="checkbox" checked onchange="cuSugestoes[${i}].marcado=this.checked">
        <span class="cu-escolher-nome">${lvEsc(m.l.titulo)}${lvTomAtual(m.l) ? ` <i class="cu-tom">${lvEsc(lvTomAtual(m.l))}</i>` : ''}<small>${lvEsc(m.motivo)}${ultimas[m.id] != null ? ` · tocada há ${ultimas[m.id]} dias` : ''}</small></span>
      </label>`).join('') : '<div class="gm-vazio">A IA não achou músicas que combinem. Tente outro tema.</div>';
    document.getElementById('cuSugAcoes').style.display = cuSugestoes.length ? '' : 'none';
  }catch(e){ el.innerHTML = `<div class="drive-linha erro">${lvEsc(String(e && e.message || e))}</div>`; }
}
function cultoUsarSugestao(){
  const p = cultoParte(document.getElementById('cuSugParte').value); if(!p) return;
  const novas = cuSugestoes.filter(m=>m.marcado && !p.musicas.includes(m.id)).map(m=>m.id);
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
    const medley = /^medley\b/i.test(s);
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
      itens.push({ parte: nomeParte, titulo, artista: artista.trim(), tom, medley, harpaNum, status:'', id:'' });
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
  return achados.find(l=>a && (parecido(cuNorm(l.artista), a) || parecido(cuNorm(l.artista), t))) || achados[0] || null;
}
function cultoColarAbrir(){
  cuColar = [];
  document.getElementById('cuColarTexto').value = '';
  document.getElementById('cuColarLista').innerHTML = '';
  document.getElementById('cuColarAcoes').style.display = 'none';
  const b = document.getElementById('cuColarMontar'); b.disabled = false; b.textContent = 'Montar o roteiro'; b.onclick = cultoColarMontar;
  document.getElementById('modalCultoColar').classList.add('active');
  if(typeof driveClienteId === 'function' && driveClienteId()) drivePreparar();
  setTimeout(()=>document.getElementById('cuColarTexto').focus(), 80);
}
function cultoColarLer(){
  cuColar = cultoColarParse(document.getElementById('cuColarTexto').value);
  /* "Boas vindas" / "Haŕpa" → o nome da parte que já existe no roteiro (Boas-vindas, Harpa) */
  const existentes = cultoAtual().partes;
  cuColar.forEach(it=>{ const p = existentes.find(x=>cuNorm(x.nome) === cuNorm(it.parte)); it.parte = p ? p.nome : it.parte.replace(/ŕ/g, 'r'); });
  cuColar.forEach(it=>{ const l = cultoColarNoApp(it); it.id = l ? l.id : ''; it.status = l ? 'app' : ''; });
  cultoColarRender();
}
const CU_COLAR_ST = { app:'já está no app', drive:'✓ do Drive (só o arquivo)', cifra:'✓ criada pelo Cifra Club', vazia:'não achei: criada só com o nome', buscando:'buscando…' };
function cultoColarRender(){
  const partes = [...new Set([...cultoAtual().partes.map(p=>p.nome).filter(Boolean), ...cuColar.map(it=>it.parte)])];
  document.getElementById('cuColarLista').innerHTML = cuColar.length ? cuColar.map((it, i)=>`
    <div class="cu-colar-item">
      <select class="cu-colar-parte" aria-label="Parte" onchange="cuColar[${i}].parte=this.value">${partes.map(p=>`<option${p === it.parte ? ' selected' : ''}>${lvEsc(p)}</option>`).join('')}</select>
      <div class="cu-colar-musica"><b>${it.harpaNum ? 'Harpa ' + lvEsc(it.harpaNum) : lvEsc(it.titulo)}${it.tom ? ` <span class="cu-tom">${lvEsc(it.tom.raiz + (it.tom.menor ? 'm' : ''))}</span>` : ''}</b><small>${lvEsc([it.artista, it.medley ? 'medley' : ''].filter(Boolean).join(' · '))}</small></div>
      <span class="cu-colar-st ${it.status}">${lvEsc(it.status === 'erro' ? it.erro : (CU_COLAR_ST[it.status] || 'vai buscar no Drive ou no Cifra Club'))}</span>
    </div>`).join('') : '<div class="gm-vazio">Cole aqui o texto do grupo: cada linha vira uma música no roteiro.</div>';
  document.getElementById('cuColarAcoes').style.display = cuColar.length ? '' : 'none';
}
async function cultoColarMontar(){
  if(!cuColar.length) return;
  const btn = document.getElementById('cuColarMontar'); btn.disabled = true; btn.textContent = 'Montando…';
  /* Drive: o pedido de acesso sai ainda dentro do toque */
  const faltam = cuColar.filter(it=>!it.id);
  let pdfs = null;
  if(faltam.length && typeof driveClienteId === 'function' && driveClienteId() && driveTokenCliente){
    try{ await drivePedirToken(); pdfs = await driveListarPdfs(); }catch(e){ pdfs = null; }
  }
  for(const it of faltam){
    it.status = 'buscando'; cultoColarRender();
    try{
      const l = (pdfs && await cultoColarDoDrive(it, pdfs)) || await cultoColarDoCifraClub(it);
      it.id = l.id;
    }catch(e){ it.status = 'erro'; it.erro = 'erro: ' + ((e && e.message) || e); }
    cultoColarRender();
  }
  /* põe no roteiro (cria a parte se não existir, antes do "Final") e acerta o tom pedido */
  const c = cultoAtual();
  cuColar.forEach(it=>{
    const l = it.id && (state.louvores || []).find(x=>x.id === it.id); if(!l) return;
    if(it.tom){ const ts = lviTomSiloe(it.tom.raiz, it.tom.menor); if(ts.tomOriginal && (ts.tomOriginal !== l.tomOriginal || ts.tomModoMenor !== !!l.tomModoMenor)) lvAplicarTom(l, ts.tomOriginal, ts.tomModoMenor); }
    let p = c.partes.find(x=>cuNorm(x.nome) === cuNorm(it.parte));
    if(!p){
      p = { id: cultoId('cp'), nome: it.parte, quem:'', musicas:[] };
      const fim = c.partes.findIndex(x=>cuNorm(x.nome) === 'final');
      fim >= 0 ? c.partes.splice(fim, 0, p) : c.partes.push(p);
    }
    if(!p.musicas.includes(l.id)) p.musicas.push(l.id);
  });
  cultoGravar(); renderCulto(); renderLouvor();
  btn.disabled = false; btn.textContent = 'Pronto'; btn.onclick = ()=>closeModal('modalCultoColar');
  showToast(`✓ Roteiro montado · ${cuColar.filter(it=>it.id).length} músicas`);
}
/* Drive: PDF com o nome da música (Harpa: o número num PDF da Harpa) → música só com o arquivo, sem tirar o texto */
async function cultoColarDoDrive(it, pdfs){
  const t = cuNorm(it.titulo), nome = f=>cuNorm(f.name.replace(/\.pdf$/i, ''));
  const f = it.harpaNum
    ? pdfs.find(f=>/harpa/i.test(f.pasta + ' ' + f.name) && new RegExp('(^|\\D)' + it.harpaNum + '(\\D|$)').test(f.name))
    : t.length >= 4 ? (pdfs.find(f=>nome(f).includes(t) && (!it.artista || nome(f).includes(cuNorm(it.artista)))) || pdfs.find(f=>nome(f).includes(t))) : null;
  if(!f) return null;
  const fi = lviNomeDoArquivo(f.name) || {};
  const tom = fi.tom ? lviTomSiloe(fi.tom, fi.menor) : null;
  const l = lvCriarDireto({ titulo: fi.titulo || it.titulo, artista: fi.artista || it.artista,
    categoria: lviEhHarpa(f.pasta + ' ' + f.name) ? 'Harpa Cristã' : /corinho/i.test(f.pasta + ' ' + f.name) ? 'Corinhos' : 'Louvor',
    tomOriginal: tom ? tom.tomOriginal : '', tomModoMenor: tom ? tom.tomModoMenor : false }, false);
  l.origem = { tipo:'drive', id: f.id, nome: f.name, link: f.webViewLink || '', pasta: f.pasta || '', soArquivo: true };
  try{
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`, { headers:{ Authorization:'Bearer ' + driveToken } });
    if(res.ok) lvOriginalGuardar(l.id, new File([await res.blob()], f.name, { type:'application/pdf' }));
  }catch(e){}
  persist();
  it.status = 'drive';
  return l;
}
/* Cifra Club: busca pelo nome (Harpa: "harpa cristã 88") e cria a música como na importação normal */
async function cultoColarDoCifraClub(it){
  const busca = it.harpaNum ? 'harpa cristã ' + it.harpaNum : (it.titulo + ' ' + it.artista).trim();
  const lista = (await ccChamar({ busca })).musicas || [];
  const t = cuNorm(it.titulo), a = cuNorm(it.artista);
  const m = it.harpaNum
    ? lista.find(m=>/harpa-crista/i.test(m.url) && new RegExp('(^|\\D)' + it.harpaNum + '(\\D|$)').test(m.titulo + ' ' + m.artista + ' ' + m.url))
    : lista.find(m=>cuNorm(m.titulo) === t && (!a || cuNorm(m.artista).includes(a))) || lista.find(m=>cuNorm(m.titulo) === t) || lista.find(m=>cuNorm(m.titulo).includes(t) || t.includes(cuNorm(m.titulo))) || lista[0];
  if(!m){
    const l = lvCriarDireto({ titulo: it.titulo, artista: it.harpaNum ? 'Harpa Cristã - ' + it.harpaNum : it.artista, categoria: it.harpaNum ? 'Harpa Cristã' : 'Louvor' }, false);
    it.status = 'vazia';
    return l;
  }
  const r = await ccMontar(m.url);
  const l = lvCriarDireto(r.dados, false);
  ccGuardarOrigem(l, r, m.url);
  it.status = 'cifra';
  return l;
}