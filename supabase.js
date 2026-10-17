(function(){
  const SUPABASE_URL = window.SUPABASE_URL || window.__SUPABASE_URL__ || '';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || window.__SUPABASE_ANON_KEY__ || '';

  // ID fixo: todos os aparelhos enxergam os mesmos dados. Quem protege os dados é o login + RLS no banco, não este ID.
  const USER_ID = 'siloe_b28aad42c1064df76ef2b8fe4def8dd2';

  function getClient(){
    if (!window.supabase) return null;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    // Sessão fica guardada no aparelho: entra uma vez e não pede de novo
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'siloe-auth' }
    });
  }

  const client = getClient();
  // ?teste na URL: lê o banco de verdade mas não grava nada (para conferir mudanças na prévia)
  const MODO_TESTE = /[?&]teste\b/.test(location.search);
  let ultimoUpdatedAt = null;   // updated_at da última leitura/gravação deste aparelho (detecta outro aparelho salvando por cima)

  /* ===== IMAGENS SEPARADAS DOS DADOS =====
     Logos e foto de fundo eram ~75% do registro e iam inteiras a cada gravação. Agora, ao salvar, cada imagem
     grande vira "img:<hash>" no registro e vai uma vez só para a tabela app_imagens; ao carregar, volta para o lugar.
     O resto do app continua vendo as imagens normalmente. Sem a tabela (ou se ela falhar), grava tudo junto como antes. */
  const IMG_MIN = 2000;                          // imagens pequenas ficam no próprio registro
  const imagensConhecidas = new Map();           // hash -> imagem (já está no banco ou acabou de ir)
  let tabelaImagensOk = true;
  async function hashTexto(t){
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  /* JSON do estado -> { leve: JSON sem as imagens grandes, novas: [{hash, data}] } */
  async function separarImagens(json){
    const achadas = [];
    json.replace(/"(data:image\/[^"\\]*(?:\\.[^"\\]*)*)"/g, (m, dentro) => { if (dentro.length >= IMG_MIN) achadas.push(dentro); return m; });
    if (!achadas.length) return { leve: json, novas: [] };
    const troca = new Map(), novas = [];
    for (const bruto of achadas) {
      if (troca.has(bruto)) continue;
      const img = JSON.parse('"' + bruto + '"');
      const h = await hashTexto(img);
      troca.set(bruto, 'img:' + h);
      if (!imagensConhecidas.has(h)) novas.push({ hash: h, data: img });
    }
    const leve = json.replace(/"(data:image\/[^"\\]*(?:\\.[^"\\]*)*)"/g, (m, dentro) => troca.has(dentro) ? '"' + troca.get(dentro) + '"' : m);
    return { leve, novas };
  }
  /* registro do banco -> mesmo registro com as imagens de volta no lugar */
  async function juntarImagens(dados){
    if (!dados) return dados;
    const refs = new Set();
    const procurar = o => { if (!o || typeof o !== 'object') return; for (const k in o) { const v = o[k]; if (typeof v === 'string') { if (/^img:[0-9a-f]{64}$/.test(v)) refs.add(v.slice(4)); } else procurar(v); } };
    procurar(dados);
    if (!refs.size) return dados;
    const faltam = [...refs].filter(h => !imagensConhecidas.has(h));
    if (faltam.length) {
      const { data, error } = await client.from('app_imagens').select('hash, data').eq('user_id', USER_ID).in('hash', faltam);
      if (error) throw error;
      (data || []).forEach(r => imagensConhecidas.set(r.hash, r.data));
    }
    const repor = o => { if (!o || typeof o !== 'object') return; for (const k in o) { const v = o[k]; if (typeof v === 'string') { if (/^img:[0-9a-f]{64}$/.test(v) && imagensConhecidas.has(v.slice(4))) o[k] = imagensConhecidas.get(v.slice(4)); } else repor(v); } };
    repor(dados);
    return dados;
  }
  /* manda as imagens novas; se não der, a gravação segue com as imagens dentro do registro */
  async function prepararGravacao(json){
    if (!tabelaImagensOk) return json;
    try {
      const { leve, novas } = await separarImagens(json);
      if (novas.length) {
        const { error } = await client.from('app_imagens').upsert(novas.map(n => ({ user_id: USER_ID, hash: n.hash, data: n.data })), { onConflict: 'user_id,hash', ignoreDuplicates: true });
        if (error) throw error;
        novas.forEach(n => imagensConhecidas.set(n.hash, n.data));
      }
      return leve;
    } catch (e) {
      console.warn('[SUPABASE] imagens ficam dentro do registro:', e && (e.message || e.code));
      if (e && (e.code === '42P01' || /app_imagens|does not exist|schema cache/i.test(e.message || ''))) tabelaImagensOk = false;   // tabela ainda não criada
      return json;
    }
  }

  window.SiloSupabase = {
    enabled: !!client,
    userId: USER_ID,
    imagens: { separar: separarImagens, juntar: juntarImagens },   // usado pela página de testes
    lastError: '',
    client,
    /* ===== LOGIN: com a proteção (RLS) ligada no banco, só quem entrou com e-mail e senha lê e grava ===== */
    async temSessao(){
      if (!client) return false;
      try { const { data } = await client.auth.getSession(); return !!(data && data.session); }
      catch (e) { return false; }
    },
    /* Aparelho conectado para sempre: o login fica guardado e só é pedido de novo se o banco recusar a sessão
       (saiu de todos os aparelhos, senha trocada...). Falha de rede NÃO pede login: mostra a cópia local e tenta de novo.
       Retorna 'ok' | 'sem-sessao' | 'sem-rede'. */
    async garantirSessao(){
      if (!client) return 'sem-sessao';
      const tokenGuardado = () => { try { const s = JSON.parse(localStorage.getItem('siloe-auth') || 'null'); return (s && s.refresh_token) || ''; } catch (e) { return ''; } };
      const esperar = ms => new Promise(r => setTimeout(r, ms));
      try { const { data } = await client.auth.getSession(); if (data && data.session) return 'ok'; } catch (e) {}
      /* o acesso de 1 h venceu e a renovação automática falhou (rede, ou outra aba renovando ao mesmo tempo):
         tenta renovar com o token guardado; só desiste se o BANCO recusar e ninguém tiver renovado nesse meio tempo */
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        const tok = tokenGuardado();
        if (!tok) return 'sem-sessao';
        let recusado = false;
        try {
          const { data, error } = await client.auth.refreshSession({ refresh_token: tok });
          if (!error && data && data.session) return 'ok';
          recusado = !!(error && error.name === 'AuthApiError' && [400, 401, 403].includes(error.status));
        } catch (e) {}
        await esperar(1500);
        try { const { data } = await client.auth.getSession(); if (data && data.session) return 'ok'; } catch (e) {}
        if (recusado && tokenGuardado() === tok) return 'sem-sessao';   // recusado de verdade (ex.: "Sair de todos")
      }
      return 'sem-rede';
    },
    /* pede ao navegador para não apagar os dados deste site (login e cópia local) quando faltar espaço */
    pedirArmazenamentoPermanente(){
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(()=>{}); } catch (e) {}
    },
    async entrar(email, senha){
      if (!client) return { ok:false, erro:'Supabase não configurado' };
      try {
        const { error } = await client.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        return { ok:true };
      } catch (e) {
        const m = String((e && e.message) || e);
        return { ok:false, erro: /invalid/i.test(m) ? 'E-mail ou senha incorretos' : m.slice(0,120) };
      }
    },
    async sair(){
      if (client) { try { await client.auth.signOut(); } catch (e) {} }
    },
    /* desconecta TODOS os aparelhos (ex.: celular perdido); cada um vai pedir login de novo */
    /* PIN de entrada = a senha da conta passa a ser o PIN (o Supabase só entra com e-mail + senha) */
    async trocarSenha(nova){
      if (!client) return { ok:false, erro:'Supabase não configurado' };
      try {
        const { error } = await client.auth.updateUser({ password: nova });
        if (error) throw error;
        return { ok:true };
      } catch (e) {
        const m = String((e && e.message) || e);
        return { ok:false, erro: /should be|at least|weak/i.test(m) ? 'O banco não aceitou esse PIN como senha (' + m.slice(0,80) + ')'
          : /reauth|recent/i.test(m) ? 'Por segurança, saia e entre de novo com a senha antiga antes de criar o PIN' : m.slice(0,120) };
      }
    },
    async emailAtual(){
      try { const { data } = await client.auth.getSession(); return (data && data.session && data.session.user && data.session.user.email) || ''; } catch (e) { return ''; }
    },
    async sairDeTodos(){
      if (!client) return false;
      try { const { error } = await client.auth.signOut({ scope:'global' }); return !error; } catch (e) { return false; }
    },
    // Retorna { ok:true, data } (data = null se ainda não existe) ou { ok:false, error }
    async loadState(){
      if (!client) return { ok:false, error:new Error('Supabase não configurado') };
      try {
        const { data, error } = await client
          .from('app_state')
          .select('data, updated_at')
          .eq('user_id', USER_ID)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        ultimoUpdatedAt = data ? data.updated_at : null;
        return { ok:true, data: data ? await juntarImagens(data.data) : null, updatedAt: ultimoUpdatedAt };
      } catch (e) {
        console.error('[SUPABASE] Erro ao carregar estado:', e);
        this.lastError = String((e && (e.message || e.code)) || e).slice(0,120);
        return { ok:false, error:e };
      }
    },
    // Grava o estado. Só grava por cima se ninguém mais salvou depois da última leitura deste aparelho.
    // Retorna true/false; this.conflito fica true quando outro aparelho salvou algo mais novo.
    async saveState(payload){
      if (!client) { this.lastError = 'Supabase não configurado'; return false; }
      this.conflito = false;
      if (MODO_TESTE) { console.info('[TESTE] gravação ignorada (?teste na URL)'); return true; }
      try {
        const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const parsed = JSON.parse(await prepararGravacao(json));
        const agora = new Date().toISOString();
        if (ultimoUpdatedAt) {
          const { data, error } = await client
            .from('app_state')
            .update({ data: parsed, updated_at: agora })
            .eq('user_id', USER_ID)
            .eq('updated_at', ultimoUpdatedAt)
            .select('updated_at');
          if (error) throw error;
          if (!data || data.length === 0) {
            this.conflito = true;
            this.lastError = 'Outro aparelho salvou alterações mais novas';
            return false;
          }
          ultimoUpdatedAt = data[0].updated_at;
          return true;
        }
        const { data, error } = await client
          .from('app_state')
          .upsert({ user_id: USER_ID, data: parsed, updated_at: agora }, { onConflict: 'user_id' })
          .select('updated_at');
        if (error) throw error;
        ultimoUpdatedAt = (data && data[0] && data[0].updated_at) || agora;
        return true;
      } catch (e) {
        console.error('[SUPABASE] Erro ao salvar estado:', e);
        this.lastError = String((e && (e.message || e.code)) || e).slice(0,160);
        return false;
      }
    },
    // Só consulta o updated_at no banco (leve) para saber se outro aparelho salvou algo novo
    async checarAtualizacao(){
      if (!client) return { ok:false };
      try {
        const { data, error } = await client.from('app_state').select('updated_at').eq('user_id', USER_ID).maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        return { ok:true, updatedAt: data ? data.updated_at : null, mudou: !!(data && ultimoUpdatedAt && data.updated_at !== ultimoUpdatedAt) };
      } catch (e) { return { ok:false }; }
    },
    // Usuário escolheu sobrescrever o que o outro aparelho salvou: adota o updated_at atual do banco como base
    async adotarVersaoDoBanco(){
      const r = await this.checarAtualizacao();
      if (r.ok) ultimoUpdatedAt = r.updatedAt;
      return r.ok;
    }
  };

  if (window.SiloSupabase.enabled) {
    console.info('[SUPABASE] Cliente ativo. Persistência 100% remota.');
  } else {
    console.error('[SUPABASE] Cliente não configurado: o app não consegue salvar.');
  }
})();
