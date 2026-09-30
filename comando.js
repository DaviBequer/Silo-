/* ========== COMANDO — disciplina, ordens do dia, juramento ========== */

function diaKeyHoje(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function garantirEstadoComando(){
  if(!state.comando){
    state.comando = {
      ordens: [
        {id:'o1', texto:'Acordar no horário definido', feito:false},
        {id:'o2', texto:'Treinar / atividade física', feito:false},
        {id:'o3', texto:'30 min de foco em algo importante, sem tela', feito:false},
        {id:'o4', texto:'Zero adiamento na tarefa mais difícil do dia', feito:false}
      ],
      ultimoDia: null,
      diaFechado: false,
      streak: 0,
      recorde: 0,
      juramento: '',
      sabotagens: [],
      rupturaHoje: false
    };
  }
  if(!state.comando.sabotagens) state.comando.sabotagens = [];
  const hoje = diaKeyHoje();
  if(state.comando.ultimoDia !== hoje){
    const eraPrimeiraVez = !state.comando.ultimoDia;
    const quebrou = !eraPrimeiraVez && !state.comando.diaFechado;
    if(quebrou){
      state.comando.streak = 0;
      state.comando.rupturaHoje = true;
    } else {
      state.comando.rupturaHoje = false;
    }
    state.comando.ordens.forEach(o=>o.feito=false);
    state.comando.diaFechado = false;
    state.comando.ultimoDia = hoje;
    persist();
  }
}

function abrirComando(){
  garantirEstadoComando();
  document.getElementById('pageComando').classList.add('active');
  renderComando();
}
function fecharComando(){
  document.getElementById('pageComando').classList.remove('active');
}

function renderComando(){
  const c = state.comando;
  const todasFeitas = c.ordens.length>0 && c.ordens.every(o=>o.feito);

  const rupturaHtml = c.rupturaHoje ? `<div class="cmd-ruptura">Formação quebrada. Ontem não foi fechado. Reorganize e siga.</div>` : '';

  const ordensHtml = c.ordens.map(o=>`
    <div class="cmd-ordem${o.feito?' done':''}">
      <div class="cmd-checkbox${o.feito?' checked':''}" onclick="toggleOrdemComando('${o.id}')">${o.feito?'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
      <div class="cmd-ordem-texto" id="ordemTexto-${o.id}" onclick="editarOrdemComando('${o.id}')">${o.texto}</div>
      <button class="cmd-ordem-del" onclick="event.stopPropagation();excluirOrdemComando('${o.id}')">&times;</button>
    </div>`).join('');

  const juramentoHtml = c.juramento ? `
    <div class="cmd-juramento-signed">
      <div class="cmd-stamp">ASSINADO</div>
      <div class="cmd-juramento-texto">${c.juramento.replace(/\n/g,'<br>')}</div>
      <button class="btn-icon-sm" style="margin-top:10px" onclick="editarJuramentoComando()">${ICON_EDIT||'Editar'}</button>
    </div>` : `
    <textarea id="juramentoInput" class="cmd-juramento-input" placeholder="Escreva o compromisso que você assume com você mesmo. Sem meio-termo."></textarea>
    <button class="btn btn-block" style="margin-top:10px" onclick="assinarJuramentoComando()">Assinar</button>`;

  const sabotagensHtml = c.sabotagens.slice(-5).reverse().map(s=>`
    <div class="cmd-sabotagem-item">
      <span class="cmd-sabotagem-data">${new Date(s.data).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
      <span>${s.nota}</span>
    </div>`).join('') || `<div class="cmd-sabotagem-vazio">Nenhum registro ainda.</div>`;

  document.getElementById('comandoConteudo').innerHTML = `
    <div class="cmd-hero">
      <div class="cmd-ribbon">SEU COMANDO</div>
      <div class="cmd-streak-num">${c.streak}</div>
      <div class="cmd-streak-label">dias seguidos em disciplina</div>
      ${c.recorde>c.streak ? `<div class="cmd-record">recorde: ${c.recorde} dias</div>` : ''}
    </div>

    ${rupturaHtml}

    <div class="cmd-section-title">Ordens do dia</div>
    <div class="cmd-ordens-list">${ordensHtml}</div>
    <button class="cmd-add-ordem" onclick="adicionarOrdemComando()">+ nova ordem</button>
    <button class="btn btn-block cmd-close-btn" ${todasFeitas && !c.diaFechado ? '' : 'disabled'} onclick="fecharDiaComando()">
      ${c.diaFechado ? 'Dia fechado ✓' : (todasFeitas ? 'Fechar o dia' : 'Cumpra todas as ordens pra fechar o dia')}
    </button>

    <div class="cmd-section-title" style="margin-top:32px">Juramento</div>
    ${juramentoHtml}

    <div class="cmd-section-title" style="margin-top:32px">Peguei-me sabotando</div>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <input type="text" id="sabotagemInput" placeholder="O que quase te derrubou agora?" style="flex:1;padding:10px 12px;border:1px solid var(--line);border-radius:10px;font-size:13px;background:var(--card-2);color:var(--text);font-family:inherit">
      <button class="btn" onclick="registrarSabotagemComando()">Registrar</button>
    </div>
    <div class="cmd-sabotagem-log">${sabotagensHtml}</div>
  `;
}

function toggleOrdemComando(id){
  const o = state.comando.ordens.find(x=>x.id===id);
  if(!o) return;
  o.feito = !o.feito;
  persist();
  renderComando();
}
function editarOrdemComando(id){
  const o = state.comando.ordens.find(x=>x.id===id);
  if(!o) return;
  const el = document.getElementById('ordemTexto-'+id);
  el.outerHTML = `<input type="text" id="ordemTexto-${id}" value="${o.texto.replace(/"/g,'&quot;')}" style="flex:1;padding:6px 8px;border:1px solid var(--gold);border-radius:8px;font-size:13.5px;font-family:inherit;background:var(--card)" onblur="salvarOrdemComando('${id}',this.value)" onkeydown="if(event.key==='Enter')this.blur()">`;
  document.getElementById('ordemTexto-'+id).focus();
}
function salvarOrdemComando(id, texto){
  const o = state.comando.ordens.find(x=>x.id===id);
  if(!o) return;
  o.texto = (texto||'').trim() || o.texto;
  persist();
  renderComando();
}
function adicionarOrdemComando(){
  const id = 'o'+Date.now();
  state.comando.ordens.push({id, texto:'Nova ordem', feito:false});
  persist();
  renderComando();
  editarOrdemComando(id);
}
async function excluirOrdemComando(id){
  const ok = await iosConfirm('Remover esta ordem?');
  if(!ok) return;
  state.comando.ordens = state.comando.ordens.filter(x=>x.id!==id);
  persist();
  renderComando();
}
function fecharDiaComando(){
  const c = state.comando;
  if(c.diaFechado || !c.ordens.every(o=>o.feito)) return;
  c.diaFechado = true;
  c.streak += 1;
  c.recorde = Math.max(c.recorde, c.streak);
  c.rupturaHoje = false;
  persist();
  renderComando();
}
function assinarJuramentoComando(){
  const texto = (document.getElementById('juramentoInput').value||'').trim();
  if(!texto) return;
  state.comando.juramento = texto;
  persist();
  renderComando();
}
async function editarJuramentoComando(){
  const ok = await iosConfirm('Reescrever o juramento?');
  if(!ok) return;
  state.comando.juramento = '';
  persist();
  renderComando();
}
function registrarSabotagemComando(){
  const input = document.getElementById('sabotagemInput');
  const nota = (input.value||'').trim();
  if(!nota) return;
  state.comando.sabotagens.push({data:new Date().toISOString(), nota});
  if(state.comando.sabotagens.length>50) state.comando.sabotagens = state.comando.sabotagens.slice(-50);
  input.value = '';
  persist();
  renderComando();
}
