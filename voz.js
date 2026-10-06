/* ========== VOZ — ditado por aba (Planner, Cartões, Ponto PJ, Louvor) ==========
   O microfone preenche o formulário e deixa aberto para conferir; só salva quando você toca em Salvar.
   O Mercado tem o próprio ditado em mercado.js. */

const VOZ_MIC_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v4"/></svg>';
let vozRec = null;

function vozOuvir(btn, aoTexto, dica){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ showToast('Ditado não disponível neste navegador'); return; }
  if(vozRec){ try{ vozRec.stop(); }catch(e){} return; }
  const rec = new SR();
  vozRec = rec;
  rec.lang = 'pt-BR';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  if(btn) btn.classList.add('ouvindo');
  showToast(dica || 'Pode falar');
  rec.onresult = (ev)=>{
    try{ aoTexto(ev.results[0][0].transcript); }
    catch(e){ console.error(e); showToast('Não consegui interpretar, tente de novo'); }
  };
  rec.onerror = ()=>{ showToast('Não consegui ouvir. Verifique o microfone'); };
  rec.onend = ()=>{ if(btn) btn.classList.remove('ouvindo'); vozRec = null; };
  try{ rec.start(); }catch(e){ if(btn) btn.classList.remove('ouvindo'); vozRec = null; }
}

/* ---------- Analisador de frase ---------- */
function vozSemAcento(s){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function vozTokens(texto){
  const limpo = texto.replace(/r\$\s*/gi,'').replace(/meio[\s-]dia/gi,'12:00').replace(/meia[\s-]noite/gi,'00:00').trim();
  return limpo.split(/\s+/).filter(Boolean).map(o=>({
    o, s: vozSemAcento(o).toLowerCase().replace(/^[^a-z0-9#]+|[^a-z0-9#]+$/g,''), used:false
  })).filter(t=>t.s);
}
const VOZ_UNID = { um:1, uma:1, dois:2, duas:2, tres:3, quatro:4, cinco:5, seis:6, sete:7, oito:8, nove:9, dez:10, onze:11, doze:12, treze:13, catorze:14, quatorze:14, quinze:15, dezesseis:16, dezeseis:16, dezessete:17, dezoito:18, dezenove:19 };
const VOZ_DEZ = { vinte:20, trinta:30, quarenta:40, cinquenta:50, sessenta:60, setenta:70, oitenta:80, noventa:90 };
const VOZ_CENT = { cem:100, cento:100, duzentos:200, duzentas:200, trezentos:300, trezentas:300, quatrocentos:400, quatrocentas:400, quinhentos:500, quinhentas:500, seiscentos:600, seiscentas:600, setecentos:700, setecentas:700, oitocentos:800, oitocentas:800, novecentos:900, novecentas:900 };
function vozEhNumPalavra(s){ return s in VOZ_UNID || s in VOZ_DEZ || s in VOZ_CENT || s==='mil'; }

/* troca números por extenso ("dois mil e quinhentos", "dezessete") por dígitos */
function vozExtenso(tok){
  const out = [];
  let i = 0;
  while(i < tok.length){
    if(!vozEhNumPalavra(tok[i].s)){ out.push(tok[i]); i++; continue; }
    let total = 0, cur = 0, j = i, usadas = 0, ultimaFim = i;
    while(j < tok.length){
      const s = tok[j].s;
      if(s === 'e' && usadas > 0 && j+1 < tok.length && vozEhNumPalavra(tok[j+1].s)){ j++; continue; }
      if(!vozEhNumPalavra(s)) break;
      let ok = true;
      if(s === 'mil'){ total += (cur||1)*1000; cur = 0; }
      else {
        const v = VOZ_UNID[s] ?? VOZ_DEZ[s] ?? VOZ_CENT[s];
        const resto = cur % 100;
        if(v >= 100) ok = (cur === 0);
        else if(v >= 20) ok = (resto === 0);
        else if(v >= 10) ok = (resto === 0);
        else ok = (resto === 0 || (resto >= 20 && resto % 10 === 0));
        if(ok) cur += v;
      }
      if(!ok) break;
      usadas++; ultimaFim = j; j++;
    }
    const n = total + cur;
    const soUm = usadas === 1 && (tok[i].s === 'um' || tok[i].s === 'uma');
    if(usadas === 0 || soUm){ out.push(tok[i]); i++; continue; }
    out.push({ o:String(n), s:String(n), used:false });
    i = ultimaFim + 1;
  }
  tok.length = 0;
  out.forEach(t=>tok.push(t));
}
function vozNumTok(s){
  if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return parseFloat(s.replace(/\./g,'').replace(',','.'));
  if(/^\d+([.,]\d+)?$/.test(s)) return parseFloat(s.replace(',','.'));
  return null;
}
function vozTem(tok, lista){
  let achou = false;
  tok.forEach(t=>{ if(!t.used && lista.includes(t.s)){ t.used = true; achou = true; } });
  return achou;
}
function vozTemSeq(tok, seq){
  for(let i=0;i<=tok.length-seq.length;i++){
    if(seq.every((w,k)=>!tok[i+k].used && tok[i+k].s===w)){ seq.forEach((w,k)=>tok[i+k].used = true); return true; }
  }
  return false;
}
const VOZ_MESES = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function vozMes(tok){
  const base = mesFinanceiroAtual();
  const bY = parseInt(base.slice(0,4),10), bM = parseInt(base.slice(5,7),10);
  for(let i=0;i<tok.length;i++){
    const m = VOZ_MESES.indexOf(tok[i].s);
    if(tok[i].used || m === -1) continue;
    tok[i].used = true;
    let ano = null;
    [i+1, i-1].forEach(k=>{
      if(ano===null && tok[k] && !tok[k].used && /^20\d\d$/.test(tok[k].s)){ ano = parseInt(tok[k].s,10); tok[k].used = true; }
    });
    if(tok[i+1] && !tok[i+1].used && tok[i+1].s==='de' && tok[i+2] && /^20\d\d$/.test(tok[i+2].s)){ ano = parseInt(tok[i+2].s,10); tok[i+1].used = tok[i+2].used = true; }
    if(ano === null) ano = (m+1 < bM) ? bY+1 : bY;
    return ano+'-'+String(m+1).padStart(2,'0');
  }
  if(vozTemSeq(tok,['proximo','mes']) || vozTemSeq(tok,['mes','que','vem'])) return addMonths(base, 1);
  if(vozTemSeq(tok,['este','mes']) || vozTemSeq(tok,['esse','mes']) || vozTemSeq(tok,['mes','atual'])) return base;
  return null;
}
/* parcelas: "10x", "10 parcelas", "em 10 vezes", "parcelado em 10", "à vista" */
function vozParcelas(tok){
  const r = { n:null, porParcela:false, aVista:false };
  for(let i=0;i<tok.length;i++){
    const t = tok[i];
    if(t.used) continue;
    const mx = t.s.match(/^(\d+)x$/);
    if(mx){
      r.n = parseInt(mx[1],10); t.used = true;
      if(tok[i+1] && tok[i+1].s==='de' && tok[i+2] && /^\d/.test(tok[i+2].s)){ r.porParcela = true; tok[i+1].used = true; }
      continue;
    }
    const v = /^\d+$/.test(t.s) ? parseInt(t.s,10) : null;
    const prox = tok[i+1];
    if(v && v<=72 && prox && ['x','parcelas','parcela','vezes','vez'].includes(prox.s)){
      r.n = v; t.used = prox.used = true;
      if(tok[i+2] && tok[i+2].s==='de') { r.porParcela = true; tok[i+2].used = true; }
    }
  }
  if(r.n===null){
    for(let i=0;i<tok.length-2;i++){
      if(['parcelado','parcelada'].includes(tok[i].s) && tok[i+1].s==='em' && /^\d+$/.test(tok[i+2].s)){
        r.n = parseInt(tok[i+2].s,10); tok[i].used = tok[i+1].used = tok[i+2].used = true; break;
      }
    }
  }
  if(vozTemSeq(tok,['a','vista'])){ r.aVista = true; if(r.n===null) r.n = 1; }
  vozTem(tok,['parcelado','parcelada','parcelas','parcela','parcelar']);
  return r;
}
function vozDia(tok){
  for(let i=0;i<tok.length-1;i++){
    if(!tok[i].used && tok[i].s==='dia' && /^\d{1,2}$/.test(tok[i+1].s) && !tok[i+1].used){
      const d = parseInt(tok[i+1].s,10);
      if(d>=1 && d<=31){ tok[i].used = tok[i+1].used = true; return d; }
    }
  }
  return null;
}
function vozValor(tok){
  for(const t of tok){
    if(t.used) continue;
    const v = vozNumTok(t.s);
    if(v!==null){ t.used = true; return v; }
  }
  return null;
}
const VOZ_ESTRUTURA = ['categoria','nome','compra','valor','reais','real','vezes','partir','comecando','iniciando','inicio','vence','vencimento','mes','total','cada','adicionar','adicione','adiciona','cadastrar','cadastre','criar','crie','quero','nova','novo','cartao','assinatura','assinaturas','gasto','a','vista'];
const VOZ_LIGACAO = ['de','do','da','dos','das','em','no','na','nos','nas','a','o','as','os','um','uma','para','pra','por','que','e','com','ao','aos'];
function vozNome(tok, extraEstrutura){
  const estr = VOZ_ESTRUTURA.concat(extraEstrutura||[]);
  const rest = tok.filter(t=>!t.used && !estr.includes(t.s));
  while(rest.length && VOZ_LIGACAO.includes(rest[0].s)) rest.shift();
  while(rest.length && VOZ_LIGACAO.includes(rest[rest.length-1].s)) rest.pop();
  const nome = rest.map(t=>t.o).join(' ').trim();
  return nome ? nome.charAt(0).toUpperCase()+nome.slice(1) : '';
}
function vozFmtValor(v){ return (v||0).toFixed(2).replace('.',','); }
function vozSetMes(pickerId, key){
  if(key && typeof monthPickers!=='undefined' && monthPickers[pickerId]) selectPickerMonth(pickerId, key);
}

/* ---------- PLANNER: gastos (moradia, assinaturas, fixos, contas futuras) ---------- */
const VOZ_CAT_NOMES = { moradia:'Moradia', assinatura:'Assinaturas', fixo:'Fixos', futuro:'Contas Futuras' };
function ditarGastoPlanner(btn){
  vozOuvir(btn, (texto)=>{
    const tok = vozTokens(texto);
    vozExtenso(tok);
    let cat = null;
    if(vozTemSeq(tok,['conta','futura']) || vozTemSeq(tok,['contas','futuras'])) cat = 'futuro';
    tok.forEach(t=>{
      if(cat || t.used) return;
      if(t.s==='moradia') cat='moradia';
      else if(['assinatura','assinaturas'].includes(t.s)) cat='assinatura';
      else if(['fixo','fixos','fixa','fixas'].includes(t.s)) cat='fixo';
      else if(['futuro','futura','futuros','futuras'].includes(t.s)) cat='futuro';
      else return;
      t.used = true;
    });
    const mes = vozMes(tok);
    const par = vozParcelas(tok);
    const dia = vozDia(tok);
    const recorrente = vozTem(tok,['recorrente','mensal','mensalmente']) || vozTemSeq(tok,['todo','mes']);
    const total = vozTem(tok,['total']);
    const valor = vozValor(tok);
    const nome = vozNome(tok);
    if(!nome && valor===null){ showToast('Não entendi, tente de novo'); return; }
    if(!cat) cat = (par.n || recorrente || (mes && !dia)) ? 'futuro' : 'fixo';
    const modo = (par.n>1 || recorrente) ? 'parcelada' : 'simples';
    openGastoModal(cat, null, cat==='futuro' ? modo : undefined);
    document.getElementById('gastoDesc').value = nome;
    let aviso = VOZ_CAT_NOMES[cat];
    if(valor!==null){
      let v = valor;
      if(cat==='futuro' && modo==='parcelada' && !recorrente && par.n>1 && !par.porParcela) v = valor/par.n;
      document.getElementById('gastoValor').value = vozFmtValor(v);
      if(cat==='futuro' && par.n>1 && !recorrente) aviso += ' · '+par.n+'x de R$ '+vozFmtValor(v);
    }
    if(cat==='futuro'){
      vozSetMes('gastoMesInicioPicker', mes);
      if(modo==='parcelada'){
        if(recorrente) document.getElementById('gastoRecorrente').checked = true;
        else document.getElementById('gastoParcelas').value = par.n || 1;
        updateGastoFieldsVisibility();
      }
    } else {
      vozSetMes('gastoMesInicioSimplesPicker', mes);
      if(dia) document.getElementById('gastoDia').value = dia;
    }
    showToast(aviso+' · confira e toque em Salvar');
  }, 'Ex: "moradia, aluguel, 1500, a partir de novembro"');
}

/* ---------- CARTÕES: compra parcelada e assinatura ---------- */
function ditarCompraCartao(btn){
  const cartoes = state.cartoesTracker || [];
  if(!cartoes.length){ showToast('Cadastre um cartão primeiro'); return; }
  vozOuvir(btn, (texto)=>{
    const tok = vozTokens(texto);
    vozExtenso(tok);
    const ehAss = vozTem(tok,['assinatura','assinaturas']);
    let cartao = null;
    const genericas = ['cartao','de','do','da','credito','no','na'];
    for(const c of cartoes){
      const palavras = vozSemAcento(c.nome||'').toLowerCase().split(/\s+/).filter(p=>p.length>2 && !genericas.includes(p));
      const achados = tok.filter(t=>!t.used && palavras.includes(t.s));
      if(achados.length){ cartao = c; achados.forEach(t=>t.used = true); break; }
    }
    if(!cartao) cartao = cartoes[0];
    const mes = vozMes(tok);
    const par = vozParcelas(tok);
    const valor = vozValor(tok);
    const nome = vozNome(tok);
    if(!nome && valor===null){ showToast('Não entendi, tente de novo'); return; }
    if(ehAss){
      openAssinaturaModal(cartao.id);
      document.getElementById('assinaturaNome').value = nome;
      if(valor!==null) document.getElementById('assinaturaValor').value = vozFmtValor(valor);
      vozSetMes('assinaturaMesInicioPicker', mes);
      showToast('Assinatura no '+cartao.nome+' · confira e toque em Salvar');
    } else {
      openCompraTrackerModal(cartao.id);
      document.getElementById('compraTrackerNome').value = nome;
      const n = par.n || 1;
      if(valor!==null) document.getElementById('compraTrackerValor').value = vozFmtValor(par.porParcela ? valor*n : valor);
      document.getElementById('compraTrackerParcelas').value = n;
      vozSetMes('compraTrackerMesInicioPicker', mes);
      showToast('Compra no '+cartao.nome+' · confira e toque em Salvar');
    }
  }, 'Ex: "cartão Nubank, tênis, 400, 4x, começando em novembro"');
}

/* ---------- PONTO PJ: horários do dia ---------- */
function vozHora(tok, i){
  const t = tok[i];
  let h = null, m = 0, consumidos = 1;
  let mm = t.s.match(/^(\d{1,2}):(\d{2})$/) || t.s.match(/^(\d{1,2})h(\d{2})?$/);
  if(mm){ h = parseInt(mm[1],10); m = mm[2] ? parseInt(mm[2],10) : 0; }
  else if(/^\d{1,2}$/.test(t.s)){
    h = parseInt(t.s,10);
    let k = i+1;
    if(tok[k] && ['horas','hora','h'].includes(tok[k].s)){ k++; consumidos++; }
    if(tok[k] && tok[k].s==='e' && tok[k+1]){
      if(tok[k+1].s==='meia'){ m = 30; consumidos += 2; }
      else if(/^\d{1,2}$/.test(tok[k+1].s) && parseInt(tok[k+1].s,10)<60){ m = parseInt(tok[k+1].s,10); consumidos += 2; }
      else if(tok[k+1].s==='um' || tok[k+1].s==='uma'){ m = 1; consumidos += 2; }
    }
  }
  if(h===null && (t.s==='um' || t.s==='uma') && tok[i+1] && ['hora','horas'].includes(tok[i+1].s)){ h = 1; consumidos = 2; }
  if(h===null || h>23) return null;
  const apos = tok.slice(i+consumidos, i+consumidos+2).map(x=>x.s).join(' ');
  if(/^da (tarde|noite)/.test(apos) && h<12){ h += 12; consumidos += 2; }
  else if(/^da (manha|madrugada)/.test(apos)){ consumidos += 2; }
  return { min: h*60+m, consumidos };
}
function ditarPonto(btn){
  vozOuvir(btn, (texto)=>{
    const bruto = vozSemAcento(texto).toLowerCase()
      .replace(/(saida|sai)\s+(do|para o|pro|pra)\s+almoco/g,'almoco')
      .replace(/(volta|voltei|retorno|retornei)\s+(do|ao|para o|pro|pra)\s+almoco/g,'volta');
    const tok = vozTokens(bruto);
    vozExtenso(tok);
    /* o ditado só vale para o mês vigente */
    const mKey = todayKey();
    const hojeReal = new Date();
    const mesReal = monthKey(hojeReal) === mKey;
    let dia = null;
    for(let i=0;i<tok.length-1;i++) if(tok[i].s==='dia' && /^\d{1,2}$/.test(tok[i+1].s)){ dia = parseInt(tok[i+1].s,10); tok[i].used = tok[i+1].used = true; break; }
    if(dia===null && mesReal){
      if(tok.some(t=>t.s==='ontem') && hojeReal.getDate()>1) dia = hojeReal.getDate()-1;
      else dia = hojeReal.getDate();
    }
    if(dia===null){ showToast('Diga o dia. Ex.: "dia 5, entrada 7 e 3"'); return; }
    if(dia<1 || dia>daysInMonth(mKey)){ showToast('Esse dia não existe em '+monthLabel(mKey)); return; }
    if(tok.some(t=>['folga','folgar','zerar','zera'].includes(t.s))){
      getDia(mKey, dia); state.pontoOffset = 0;
      state.ponto.days[mKey][dia] = { entrada:null, almocoSaida:null, almocoVolta:null, saida:null, extra:0, confirmado:{} };
      renderPonto(); persist(); showToast('Dia '+dia+' zerado'); return;
    }
    const d = getDia(mKey, dia);
    if(d.concluido){ showToast('Dia '+dia+' está trancado, abra o cadeado antes'); return; }

    /* marcas na ordem em que foram faladas */
    const marcas = [];
    tok.forEach((t,i)=>{
      if(/^(entrada|entrei|cheguei|comecei|inicio|iniciei)$/.test(t.s)) marcas.push({ tipo:'in', i });
      else if(/^(saida|sai|terminei|encerrei|embora|saio|fui)$/.test(t.s)) marcas.push({ tipo:'out', i });
      else if(/^(almoco|almocei|almocar)$/.test(t.s)) marcas.push({ tipo:'almoco', i });
      else if(/^(volta|voltei|retorno|retornei)$/.test(t.s)) marcas.push({ tipo:'volta', i });
    });
    const lerHoras = (de, ate)=>{
      const horas = [];
      for(let i=de;i<ate;i++){ const h = vozHora(tok, i); if(h){ horas.push(h.min); i += h.consumidos-1; } }
      return horas;
    };
    const rotulo = { entrada:'entrada', almocoSaida:'almoço', almocoVolta:'volta', saida:'saída' };
    const novos = {};      // campo -> minutos, só o que foi falado agora
    const temConfirmado = ['entrada','almocoSaida','almocoVolta','saida'].some(c=>d.confirmado[c]);
    const jaTem = (c)=> !!d.confirmado[c] || (c in novos);
    marcas.forEach((mk, idx)=>{
      const fim = idx+1 < marcas.length ? marcas[idx+1].i : tok.length;
      const horas = lerHoras(mk.i+1, fim);
      if(!horas.length) return;
      const min = horas[0];
      if(mk.tipo==='almoco'){
        novos.almocoSaida = min;
        if(horas[1]!==undefined) novos.almocoVolta = horas[1];
      } else if(mk.tipo==='volta'){
        novos.almocoVolta = min;
      } else if(mk.tipo==='in'){
        const campo = !jaTem('entrada') ? 'entrada' : (!jaTem('almocoVolta') ? 'almocoVolta' : 'entrada');
        novos[campo] = min;
      } else {
        let campo;
        if(min < 15*60 && !jaTem('almocoSaida')) campo = 'almocoSaida';
        else if(!jaTem('saida')) campo = 'saida';
        else campo = min < 15*60 ? 'almocoSaida' : 'saida';
        novos[campo] = min;
      }
    });
    /* hora extra: "hora extra 2 horas", "extra 1 e meia" */
    let extraMin = null;
    const iExtra = tok.findIndex(t=>t.s==='extra' || t.s==='extras');
    if(iExtra>=0){
      for(let i=Math.max(0,iExtra-3); i<Math.min(tok.length, iExtra+4); i++){
        if(/^\d{1,2}$/.test(tok[i].s) && !(i>0 && tok[i-1].s==='dia') && !(i>0 && ['entrada','saida','almoco','volta'].includes(tok[i-1].s))){
          extraMin = parseInt(tok[i].s,10)*60;
          if(tok[i+1] && tok[i+1].s==='e' && tok[i+2]){
            if(tok[i+2].s==='meia') extraMin += 30;
            else if(/^\d{1,2}$/.test(tok[i+2].s)) extraMin += parseInt(tok[i+2].s,10);
          }
          break;
        }
      }
    }
    const campos = Object.keys(novos);
    if(!campos.length && extraMin===null){ showToast('Não entendi os horários. Ex.: "dia 5, entrada 7 e 3, saída meio-dia"'); return; }
    /* registro parcial: num dia ainda sem horários confirmados, só entra o que foi falado */
    if(campos.length && !temConfirmado){
      d.entrada = d.almocoSaida = d.almocoVolta = d.saida = null;
    }
    campos.forEach(c=>{ d[c] = minToTime(novos[c]); d.confirmado[c] = true; });
    if(extraMin!==null) d.extra = extraMin;
    state.pontoOffset = 0;
    renderPonto(); persist();
    const ordem = ['entrada','almocoSaida','almocoVolta','saida'];
    const resumo = ordem.filter(c=>c in novos).map(c=>rotulo[c]+' '+d[c]);
    if(extraMin!==null) resumo.push('extra '+minToHoursLabel(extraMin));
    showToast('Dia '+dia+': '+resumo.join(', '));
  }, 'Ex: "dia 5, entrada 7 e 3, saída meio-dia"');
}

/* ---------- LOUVOR: novo louvor ---------- */
const VOZ_NOTAS = { do:'C', re:'D', mi:'E', fa:'F', sol:'G', la:'A', si:'B', c:'C', d:'D', e:'E', f:'F', g:'G', a:'A', b:'B' };
function ditarLouvor(btn){
  vozOuvir(btn, processarLouvorTexto, 'Ex: "louvor Aliança, artista Fulano, tom D, categoria harpa"');
}
/* mic da lista do Louvor: "buscar Aliança" filtra a lista; qualquer outra frase cria um louvor novo */
function ditarLouvorLista(btn){
  vozOuvir(btn, (texto)=>{
    const m = vozSemAcento(texto).toLowerCase().match(/^\s*(buscar|busque|procurar|procure|achar|ache|abrir|abra)\s+(.+)$/);
    if(m){
      const termo = texto.trim().split(/\s+/).slice(1).join(' ').replace(/^(o|a|os|as|musica|louvor|hino)\s+/i,'');
      const inp = document.getElementById('louvorSearchInput');
      inp.value = termo; onLouvorSearchInput(termo);
      showToast('Buscando "'+termo+'"');
      return;
    }
    processarLouvorTexto(texto);
  }, 'Ex: "buscar Aliança" ou "louvor Aliança, artista Fulano, tom D"');
}
function processarLouvorTexto(texto){
  {
    const tok = vozTokens(texto);
    const iArt = tok.findIndex(t=>['artista','cantor','cantora','autor','banda'].includes(t.s));
    const iTom = tok.findIndex(t=>t.s==='tom');
    const iCat = tok.findIndex(t=>t.s==='categoria');
    const marcas = [iArt,iTom,iCat].filter(i=>i>=0).sort((a,b)=>a-b);
    const fimTitulo = marcas.length ? marcas[0] : tok.length;
    const ini = ['adicionar','adicione','adiciona','nova','novo','musica','louvor','hino','cantico','canto','titulo','nome','chamada','chamado','cadastrar','criar','crie','de'];
    let titulo = tok.slice(0, fimTitulo);
    while(titulo.length && ini.includes(titulo[0].s)) titulo.shift();
    const nomeTitulo = titulo.map(t=>t.o).join(' ').trim();
    let artista = '';
    if(iArt>=0){
      const fim = marcas.find(i=>i>iArt) ?? tok.length;
      artista = tok.slice(iArt+1, fim).map(t=>t.o).join(' ').trim();
    }
    let cat = 'Louvor';
    if(tok.some(t=>t.s==='harpa')) cat = 'Harpa Cristã';
    else if(tok.some(t=>['corinho','corinhos'].includes(t.s))) cat = 'Corinhos';
    let tomOrig = '', menor = false;
    if(iTom>=0){
      const seg = tok.slice(iTom+1, iTom+5).map(t=>t.s);
      const nota = VOZ_NOTAS[seg[0]];
      if(nota){
        let n = nota;
        if(seg[1]==='sustenido' || seg[1]==='#') n += '#';
        else if(seg[1]==='bemol') n += 'b';
        menor = seg.slice(1,4).includes('menor');
        const idx = (LV_CHROMATIC.indexOf(n) !== -1) ? LV_CHROMATIC.indexOf(n) : LV_FLAT.indexOf(n);
        if(idx !== -1){
          if(menor){ const rel = (idx+3)%12; tomOrig = n.includes('b') ? LV_FLAT[rel] : LV_CHROMATIC[rel]; }
          else tomOrig = n;
        }
      }
    }
    if(!nomeTitulo){ showToast('Não entendi o nome, tente de novo'); return; }
    openLouvorForm();
    document.getElementById('lvNovoTitulo').value = nomeTitulo.charAt(0).toUpperCase()+nomeTitulo.slice(1);
    document.getElementById('lvNovoArtista').value = artista;
    window.lvNovoCategoriaSelecionada = cat;
    renderLvNovoCategoriaChips();
    if(tomOrig){ window.lvNovoTomOriginal = tomOrig; window.lvNovoTomModoMenor = menor; atualizarLvNovoTomBox(); }
    showToast('Confira e toque em Criar e Abrir');
  }
}

/* rola o campo para a área visível quando o teclado abre dentro de um modal */
document.addEventListener('focusin', (e)=>{
  const el = e.target;
  if(el && el.closest && el.closest('.modal') && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)){
    setTimeout(()=>{ try{ el.scrollIntoView({ block:'center', behavior:'smooth' }); }catch(_){} }, 320);
  }
});

/* ---------- PERGUNTAS POR VOZ (na Busca): o app só responde, não altera nada ---------- */
function vozReais(v){ return fmtMoney(v); }
function responderPergunta(texto){
  const t = vozSemAcento(texto).toLowerCase();
  const tem = (...ws)=> ws.some(w=>t.includes(w));
  const agora = new Date();
  const nomeMes = (k)=> monthLabelLong(k);
  /* Mercado */
  if(tem('mercado','compra','compras','lista','carrinho','supermercado')){
    const emAnd = totalCompraEmAndamento();
    const gastoMes = calcularGastoMercadoMes(agora.getFullYear(), agora.getMonth()) + emAnd;
    if(tem('lista','carrinho','vai dar','compra atual') && !tem('gastei','gasto','gastou')){
      const n = (state.listaCompras||[]).length;
      return bannerGeo('positivo','carrinho', vozReais(emAnd)+' na compra em andamento', n+(n===1?' item':' itens')+' na lista agora');
    }
    const meta = state.mercadoMeta || 0;
    if(meta>0){
      const resto = meta - gastoMes;
      return bannerGeo(resto<0?'negativo':'positivo', resto<0?'alerta':'carrinho',
        vozReais(gastoMes)+' no Mercado este mês',
        resto<0 ? 'Passou '+vozReais(-resto)+' da meta de '+vozReais(meta) : 'Faltam '+vozReais(resto)+' para a meta de '+vozReais(meta), gastoMes/meta);
    }
    return bannerGeo('positivo','carrinho', vozReais(gastoMes)+' no Mercado este mês','Sem meta definida para o Mercado');
  }
  /* Ponto PJ */
  if(tem('ponto','horas','hora ','trabalh','expediente',' pj')){
    const mKey = todayKey();
    const st = pontoStatusMes(mKey);
    if(tem('receber','valor','ganh')){
      return bannerGeo('positivo','moeda', vozReais(st.r.valorReceber)+' a receber', 'Ponto PJ de '+nomeMes(mKey)+' · '+minToHoursLabel(st.r.totalMin)+' registradas');
    }
    if(tem('trabalhei','total','quantas horas tenho','ja fiz')){
      return bannerGeo('positivo','relogio', minToHoursLabel(st.r.totalMin)+' no mês', 'Padrão do mês: '+minToHoursLabel(st.r.padraoMin)+' · '+nomeMes(mKey));
    }
    return pontoBannerHtml(mKey);
  }
  /* Planner / Dashboard */
  if(tem('sobra','sobrar','sobrou','sobram','saldo','gastos','gasto','gastei','gastamos','despesa','renda','salario','em aberto','pagar','contas')){
    const mKey = mesFinanceiroAtual();
    let users = ['davi','cris'], quem = 'do casal';
    if(tem('davi')){ users=['davi']; quem='do Davi'; }
    else if(tem('cris')){ users=['cris']; quem='da Cris'; }
    const renda = users.reduce((a,u)=>a+incomeForMonth(u,mKey),0);
    const gasto = users.reduce((a,u)=>a+expensesForMonth(u,mKey),0);
    if(tem('em aberto','pagar','falta pagar')){
      const n = contasEmAbertoNoMes(mKey);
      return bannerGeo(n>0?'negativo':'positivo', n>0?'alerta':'ok', n>0 ? n+(n===1?' conta em aberto':' contas em aberto') : 'Nenhuma conta em aberto', 'Contas de '+nomeMes(mKey));
    }
    if(tem('renda','salario','ganho','receber')){
      return bannerGeo('positivo','moeda', vozReais(renda)+' de renda '+quem, nomeMes(mKey));
    }
    if(tem('gastos','gasto','gastei','gastamos','despesa') && !tem('sobra','sobrar','sobrou','sobram','saldo')){
      return bannerGeo('positivo','moeda', vozReais(gasto)+' em gastos '+quem, nomeMes(mKey)+' · renda '+vozReais(renda), renda>0?gasto/renda:null);
    }
    const sobra = renda - gasto;
    return bannerGeo(sobra<0?'negativo':'positivo', sobra<0?'alerta':'ok',
      sobra<0 ? 'Faltam '+vozReais(-sobra)+' no mês' : 'Sobram '+vozReais(sobra)+' no mês',
      nomeMes(mKey)+' '+quem+' · renda '+vozReais(renda)+' · gastos '+vozReais(gasto), renda>0?Math.min(1,gasto/renda):null);
  }
  return null;
}
function perguntarPorVoz(btn){
  vozOuvir(btn, (texto)=>{
    const resp = document.getElementById('buscaGlobalResposta');
    const html = responderPergunta(texto);
    if(html){
      resp.innerHTML = html;
      document.getElementById('buscaGlobalInput').value = '';
      document.getElementById('buscaGlobalResultados').innerHTML = '';
    } else {
      resp.innerHTML = '';
      const inp = document.getElementById('buscaGlobalInput');
      inp.value = texto.trim().replace(/[.?!]+$/,'');
      onBuscaGlobalInput(inp.value);
    }
  }, 'Pergunte: "quanto gastei no mercado?" ou diga o que procurar');
}
