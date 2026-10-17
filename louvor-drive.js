/* ================= DRIVE DO LOUVOR: Culto → "Enviar para o Drive" =================
   Pastas (como já estão no Drive do Davi):
     Som de Adoradores/            ← PDFs da data (soltos)
       Repertório/1. Domingo | 2. Harpa Cristã | 3. Corinhos   ← PDFs antigos
       Slide/                      ← slides da data (soltos)
         Louvores | Harpa Cristã | Corinhos                     ← slides antigos
   Ao enviar: os arquivos soltos que não são desta data vão para a pasta da categoria (se já houver um com o mesmo
   nome lá, o velho vai para a lixeira do Drive); os da data entram soltos (mesmo nome = atualiza o arquivo).
   Login: Google Identity Services com o ID do cliente salvo em state.driveClienteId (Dados do App → Recursos). */
const DRIVE_ESCOPO = 'https://www.googleapis.com/auth/drive';
const DRIVE_GIS = 'https://accounts.google.com/gsi/client';
const DRIVE_PASTA_RAIZ = 'Som de Adoradores';
const DRIVE_PASTA_PDF = 'Repertório';
const DRIVE_PASTAS_SLIDE = ['Slide', 'Slides'];
const DRIVE_PDF_POR_CATEGORIA = { 'Louvor':'1. Domingo', 'Harpa Cristã':'2. Harpa Cristã', 'Corinhos':'3. Corinhos' };
const DRIVE_SLIDE_POR_CATEGORIA = { 'Louvor':'Louvores', 'Harpa Cristã':'Harpa Cristã', 'Corinhos':'Corinhos' };
const DRIVE_PASTA_MIME = 'application/vnd.google-apps.folder';
const DRIVE_PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
let driveTokenCliente = null, driveToken = null, driveTokenVence = 0, drivePedido = null;

function driveClienteId(){ return String(state.driveClienteId || '').trim(); }
function atualizarStatusDrive(){
  const tem = !!driveClienteId();
  const st = document.getElementById('driveStatus'), inp = document.getElementById('driveClienteInput');
  if(st){ st.textContent = tem ? 'Ligado' : 'Desligado'; st.classList.toggle('ligada', tem); }
  if(inp) inp.placeholder = tem ? 'ID salvo ✓' : 'ID do cliente (…apps.googleusercontent.com)';
  const rem = document.getElementById('driveRemover'); if(rem) rem.style.display = tem ? '' : 'none';
  document.querySelectorAll('#cultoDriveBtn,.so-drive').forEach(b=>b.style.display = tem ? '' : 'none');
}
function salvarDriveCliente(){
  const inp = document.getElementById('driveClienteInput');
  const v = (inp.value || '').trim();
  if(!/\.apps\.googleusercontent\.com$/.test(v)){ showToast('Cole o ID que termina em .apps.googleusercontent.com'); inp.focus(); return; }
  state.driveClienteId = v; inp.value = '';
  driveTokenCliente = null; driveToken = null;
  persist(); atualizarStatusDrive();
  showToast('Drive ligado — use no Culto');
}
async function removerDriveCliente(){
  if(!(await iosConfirm('Desligar o Drive deste app?'))) return;
  if(driveToken && window.google && google.accounts && google.accounts.oauth2) try{ google.accounts.oauth2.revoke(driveToken, ()=>{}); }catch(e){}
  state.driveClienteId = ''; driveTokenCliente = null; driveToken = null;
  persist(); atualizarStatusDrive();
}

/* o script do Google é carregado antes (ao abrir o Culto), para o pedido de acesso sair direto do toque */
async function drivePreparar(){
  if(!driveClienteId()) return false;
  if(!(window.google && google.accounts && google.accounts.oauth2)){
    try{ await lviCarregarScript(DRIVE_GIS, ()=>!!(window.google && google.accounts && google.accounts.oauth2)); }catch(e){ return false; }
  }
  if(!driveTokenCliente){
    driveTokenCliente = google.accounts.oauth2.initTokenClient({
      client_id: driveClienteId(), scope: DRIVE_ESCOPO,
      callback: r=>{
        const p = drivePedido; drivePedido = null; if(!p) return;
        if(r && r.access_token){ driveToken = r.access_token; driveTokenVence = Date.now() + (Number(r.expires_in) || 3600) * 1000 - 60000; p.ok(driveToken); }
        else p.erro(new Error(r && r.error || 'sem acesso'));
      },
      error_callback: e=>{ const p = drivePedido; drivePedido = null; if(p) p.erro(new Error(e && e.type || 'janela fechada')); }
    });
  }
  return true;
}
/* precisa ser chamado direto do toque (sem await antes), senão o navegador bloqueia a janela do Google */
function drivePedirToken(){
  if(driveToken && Date.now() < driveTokenVence) return Promise.resolve(driveToken);
  if(!driveTokenCliente) return Promise.reject(new Error('preparando'));
  return new Promise((ok, erro)=>{ drivePedido = { ok, erro }; driveTokenCliente.requestAccessToken({ prompt: driveToken ? '' : 'select_account' }); });
}
async function driveApi(caminho, opcoes = {}, base = 'https://www.googleapis.com/drive/v3/'){
  const res = await fetch(base + caminho, { ...opcoes, headers: { Authorization: 'Bearer ' + driveToken, ...(opcoes.headers || {}) } });
  if(res.status === 401){ driveToken = null; throw new Error('O acesso ao Drive venceu: toque de novo'); }
  if(!res.ok){ let msg = res.status; try{ const j = await res.json(); msg = j.error && j.error.message || msg; }catch(e){} throw new Error('Drive: ' + msg); }
  return res.status === 204 ? null : res.json();
}
const driveAspas = s=>String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
async function driveListar(q){
  const out = []; let page = '';
  do{
    const r = await driveApi('files?pageSize=1000&fields=nextPageToken,files(id,name,mimeType)&q=' + encodeURIComponent(q + ' and trashed=false') + (page ? '&pageToken=' + page : ''));
    out.push(...(r.files || [])); page = r.nextPageToken || '';
  } while(page);
  return out;
}
async function drivePasta(nome, paiId, criar){
  const achou = await driveListar(`name='${driveAspas(nome)}' and mimeType='${DRIVE_PASTA_MIME}'` + (paiId ? ` and '${paiId}' in parents` : ''));
  if(achou.length) return achou[0].id;
  if(!criar) return null;
  const r = await driveApi('files?fields=id', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ name: nome, mimeType: DRIVE_PASTA_MIME, parents: paiId ? [paiId] : undefined }) });
  return r.id;
}
async function driveMover(id, deId, paraId){ return driveApi(`files/${id}?addParents=${paraId}&removeParents=${deId}&fields=id`, { method:'PATCH' }); }
async function driveLixeira(id){ return driveApi(`files/${id}?fields=id`, { method:'PATCH', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ trashed: true }) }); }
async function driveSubir(blob, nome, mime, paiId, existenteId){
  blob = new Blob([blob], { type: mime });   // o gerador de slides devolve "application/zip"
  if(existenteId) return driveApi(`files/${existenteId}?uploadType=media&fields=id`, { method:'PATCH', headers:{ 'Content-Type': mime }, body: blob }, 'https://www.googleapis.com/upload/drive/v3/');
  const corpo = new FormData();
  corpo.append('metadata', new Blob([JSON.stringify({ name: nome, parents: [paiId] })], { type:'application/json' }));
  corpo.append('file', blob, nome);
  return driveApi('files?uploadType=multipart&fields=id', { method:'POST', body: corpo }, 'https://www.googleapis.com/upload/drive/v3/');
}
/* categoria de um arquivo antigo: pelo louvor do app com o título no nome; senão pelas palavras do nome */
function driveCategoriaDoArquivo(nome){
  const n = vozSemAcento(nome.replace(/\.[^.]+$/, ''));
  let melhor = null;
  (state.louvores||[]).forEach(l=>{
    const t = vozSemAcento(l.titulo || '').trim();
    if(t.length >= 3 && n.includes(t) && (!melhor || t.length > melhor.t.length)) melhor = { t, cat: l.categoria };
  });
  if(melhor && DRIVE_PDF_POR_CATEGORIA[melhor.cat]) return melhor.cat;
  if(/harpa/.test(n)) return 'Harpa Cristã';
  if(/corinho/.test(n)) return 'Corinhos';
  return 'Louvor';
}

/* ---------- janela de progresso ---------- */
function driveLog(txt, tipo){
  const el = document.getElementById('driveLog'); if(!el) return;
  el.insertAdjacentHTML('beforeend', `<div class="drive-linha ${tipo || ''}">${lvEsc(txt)}</div>`);
  el.scrollTop = el.scrollHeight;
}
function driveJanela(titulo){
  document.getElementById('driveTitulo').textContent = titulo;
  document.getElementById('driveLog').innerHTML = '';
  document.getElementById('driveFechar').disabled = true;
  document.getElementById('modalDrive').classList.add('active');
}

/* ---------- enviar os louvores da data do Culto ---------- */
let driveEnviando = false;
function cultoEnviarDrive(){
  if(driveEnviando) return;
  if(!driveClienteId()){ showToast('Ligue o Drive em Dados do App → Recursos'); return; }
  if(!driveTokenCliente){ drivePreparar().then(ok=>showToast(ok ? 'Pronto: toque de novo em Drive' : 'Não consegui falar com o Google')); return; }
  const pedido = drivePedirToken();   // primeiro, ainda dentro do toque
  const c = cultoAtual();
  let ids = [...new Set(c.partes.flatMap(p=>p.musicas))];
  if(!ids.length) ids = (state.louvores||[]).filter(l=>l.dataAgendamento === c.data).map(l=>l.id);
  const louvores = ids.map(id=>(state.louvores||[]).find(l=>l.id === id)).filter(Boolean);
  if(!louvores.length){ showToast('Nenhuma música nesse culto'); return; }
  driveEnviando = true;
  driveJanela('Drive · ' + cultoDataTexto(c.data, true));
  driveLog('Pedindo acesso ao Google Drive…');
  pedido.then(()=>driveEnviarLouvores(louvores))
    .then(()=>driveLog('Pronto ✓ Tudo no Drive.', 'ok'))
    .catch(e=>driveLog(String(e && e.message || e), 'erro'))
    .finally(()=>{ driveEnviando = false; document.getElementById('driveFechar').disabled = false; });
}
async function driveEnviarLouvores(louvores){
  /* 1. arquivos novos */
  driveLog(`Gerando ${louvores.length} PDF${louvores.length > 1 ? 's' : ''} e slides…`);
  const novos = [];
  for(const l of louvores){
    const pdf = lvMontarPdf(l);
    if(pdf) novos.push({ tipo:'pdf', nome: pdf.nome, blob: pdf.doc.output('blob'), mime:'application/pdf' });
    const sl = await lvMontarSlides(l);
    if(sl) novos.push({ tipo:'slide', nome: sl.nome, blob: await sl.pres.write({ outputType:'blob' }), mime: DRIVE_PPTX_MIME });
  }
  /* 2. pastas */
  driveLog('Achando as pastas…');
  const raiz = await drivePasta(DRIVE_PASTA_RAIZ, null, false);
  if(!raiz) throw new Error(`Não achei a pasta "${DRIVE_PASTA_RAIZ}" no Drive`);
  const repertorio = await drivePasta(DRIVE_PASTA_PDF, raiz, true);
  let slide = null;
  for(const n of DRIVE_PASTAS_SLIDE){ slide = await drivePasta(n, raiz, false); if(slide) break; }
  if(!slide) slide = await drivePasta(DRIVE_PASTAS_SLIDE[0], raiz, true);
  const cachePastas = {};
  const pastaCategoria = async (pai, nome)=>(cachePastas[pai + nome] = cachePastas[pai + nome] || await drivePasta(nome, pai, true));
  /* 3. arquiva os soltos que não são desta data */
  const arquivar = async (pai, soltos, porCat, tipo)=>{
    const nomesNovos = new Set(novos.filter(x=>x.tipo === tipo).map(x=>x.nome));
    for(const f of soltos){
      if(nomesNovos.has(f.name)) continue;
      const cat = driveCategoriaDoArquivo(f.name), destino = await pastaCategoria(pai, porCat[cat]);
      const repetidos = await driveListar(`name='${driveAspas(f.name)}' and '${destino}' in parents`);
      for(const r of repetidos) await driveLixeira(r.id);
      await driveMover(f.id, pai, destino);
      driveLog(`Arquivado: ${f.name} → ${porCat[cat]}`);
    }
  };
  const pdfsSoltos = (await driveListar(`'${raiz}' in parents and mimeType='application/pdf'`));
  const slidesSoltos = (await driveListar(`'${slide}' in parents and mimeType != '${DRIVE_PASTA_MIME}'`)).filter(f=>/\.pptx?$/i.test(f.name));
  await arquivar(raiz, pdfsSoltos, DRIVE_PDF_POR_CATEGORIA, 'pdf');
  await arquivar(slide, slidesSoltos, DRIVE_SLIDE_POR_CATEGORIA, 'slide');
  /* 4. envia os da data (mesmo nome solto = atualiza) */
  for(const x of novos){
    const pai = x.tipo === 'pdf' ? raiz : slide;
    const ja = (x.tipo === 'pdf' ? pdfsSoltos : slidesSoltos).find(f=>f.name === x.nome);
    await driveSubir(x.blob, x.nome, x.mime, pai, ja && ja.id);
    driveLog(`${ja ? 'Atualizado' : 'Enviado'}: ${x.nome}`, 'ok');
  }
}

/* ---------- puxar um PDF do Drive: usar na música (importa e atualiza a cifra) ou só abrir ----------
   Procura em "Som de Adoradores", nas pastas dele e nas pastas do Repertório (1. Domingo, 2. Harpa Cristã...). */
let drivePdfModo = 'novo', drivePdfLista = [];
function driveEscolherPdf(modo){
  drivePdfModo = modo;
  if(!driveClienteId()){ showToast('Ligue o Drive em Dados do App → Recursos'); return; }
  if(!driveTokenCliente){ drivePreparar().then(ok=>showToast(ok ? 'Pronto: toque de novo' : 'Não consegui falar com o Google')); return; }
  const pedido = drivePedirToken();   // ainda dentro do toque
  document.getElementById('drivePdfTitulo').textContent = modo === 'atual' ? 'Atualizar com PDF do Drive' : 'PDF do Drive';
  document.getElementById('drivePdfBusca').value = '';
  document.getElementById('drivePdfLista').innerHTML = '<div class="voz-carregando">Abrindo o Drive…</div>';
  document.getElementById('modalDrivePdf').classList.add('active');
  pedido.then(driveListarPdfs).then(lista=>{ drivePdfLista = lista; driveRenderPdfs(); })
    .catch(e=>{ document.getElementById('drivePdfLista').innerHTML = `<div class="drive-linha erro">${lvEsc(String(e && e.message || e))}</div>`; });
}
async function driveListarPdfs(){
  const raiz = await drivePasta(DRIVE_PASTA_RAIZ, null, false);
  if(!raiz) throw new Error(`Não achei a pasta "${DRIVE_PASTA_RAIZ}" no Drive`);
  const pastas = { [raiz]: DRIVE_PASTA_RAIZ };
  const filhas = await driveListar(`'${raiz}' in parents and mimeType='${DRIVE_PASTA_MIME}'`);
  filhas.forEach(p=>pastas[p.id] = p.name);
  for(const p of filhas){
    (await driveListar(`'${p.id}' in parents and mimeType='${DRIVE_PASTA_MIME}'`)).forEach(n=>pastas[n.id] = p.name + ' / ' + n.name);
  }
  const ids = Object.keys(pastas), out = [];
  for(let i = 0; i < ids.length; i += 20){   // consulta em partes (a busca do Drive tem limite de tamanho)
    const q = '(' + ids.slice(i, i + 20).map(id=>`'${id}' in parents`).join(' or ') + `) and mimeType='application/pdf'`;
    let page = '';
    do{
      const r = await driveApi('files?pageSize=1000&fields=nextPageToken,files(id,name,modifiedTime,webViewLink,parents)&q=' + encodeURIComponent(q + ' and trashed=false') + (page ? '&pageToken=' + page : ''));
      (r.files || []).forEach(f=>out.push({ ...f, pasta: pastas[(f.parents || []).find(p=>pastas[p])] || '' }));
      page = r.nextPageToken || '';
    } while(page);
  }
  return out.sort((a, b)=>String(b.modifiedTime).localeCompare(String(a.modifiedTime)));
}
function driveRenderPdfs(){
  const el = document.getElementById('drivePdfLista'); if(!el) return;
  const termo = vozSemAcento(document.getElementById('drivePdfBusca').value.trim());
  const lista = drivePdfLista.filter(f=>!termo || vozSemAcento(f.name + ' ' + f.pasta).includes(termo));
  const usar = drivePdfModo === 'atual' ? 'Atualizar' : 'Usar';
  el.innerHTML = lista.length ? lista.slice(0, 100).map(f=>`
    <div class="dpdf-item">
      <div class="dpdf-info"><b>${lvEsc(f.name.replace(/\.pdf$/i, ''))}</b><small>${lvEsc(f.pasta)} · ${new Date(f.modifiedTime).toLocaleDateString('pt-BR')}</small></div>
      <button type="button" class="link-btn-sm" onclick="window.open('${f.webViewLink}','_blank')">Abrir</button>
      <button type="button" class="btn btn-sm" onclick="driveUsarPdf('${f.id}')">${usar}</button>
    </div>`).join('') : `<div class="gm-vazio">${drivePdfLista.length ? 'Nenhum PDF com esse nome.' : 'Nenhum PDF nas pastas.'}</div>`;
}
async function driveUsarPdf(id){
  const f = drivePdfLista.find(x=>x.id === id); if(!f) return;
  closeModal('modalDrivePdf');
  showToast('Baixando do Drive…');
  try{
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { headers:{ Authorization:'Bearer ' + driveToken } });
    if(!res.ok) throw new Error('Drive: ' + res.status);
    const file = new File([await res.blob()], f.name, { type:'application/pdf' });
    const ev = { target:{ files:[file], value:'' } };
    if(drivePdfModo === 'atual') lvImportarNoAtual(ev);
    else { openLouvorForm(); lvImportarNoNovo(ev); }
  }catch(e){ showToast('Não consegui baixar: ' + (e && e.message || e)); }
}