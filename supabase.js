(function(){
  const SUPABASE_URL = window.SUPABASE_URL || window.__SUPABASE_URL__ || '';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || window.__SUPABASE_ANON_KEY__ || '';

  // ID fixo: todos os aparelhos enxergam os mesmos dados. Quem protege os dados é o login + RLS no banco, não este ID.
  const USER_ID = 'siloe_b28aad42c1064df76ef2b8fe4def8dd2';

  // Chaves antigas do localStorage: lidas só uma vez, para migrar os dados para o Supabase.
  const CHAVES_LEGADO = ['siloe-data-v1','siloe-mes-atual','siloe-logo','siloe-supabase-user-id','siloe-backups-auto','siloe-versao-anterior'];

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

  window.SiloSupabase = {
    enabled: !!client,
    userId: USER_ID,
    lastError: '',
    client,
    /* ===== LOGIN: com a proteção (RLS) ligada no banco, só quem entrou com e-mail e senha lê e grava ===== */
    async temSessao(){
      if (!client) return false;
      try { const { data } = await client.auth.getSession(); return !!(data && data.session); }
      catch (e) { return false; }
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
    /* ===== VERSÕES ANTERIORES (tabela app_state_historico: uma cópia por hora, 30 dias) ===== */
    async listarVersoes(){
      if (!client) return { ok:false };
      try {
        const { data, error } = await client.from('app_state_historico')
          .select('id, salvo_em').eq('user_id', USER_ID).order('salvo_em', { ascending:false }).limit(200);
        if (error) throw error;
        return { ok:true, lista: data || [] };
      } catch (e) { return { ok:false, erro: String((e && e.message) || e).slice(0,120) }; }
    },
    async lerVersao(id){
      if (!client) return { ok:false };
      try {
        const { data, error } = await client.from('app_state_historico').select('data').eq('id', id).maybeSingle();
        if (error) throw error;
        return { ok: !!data, data: data ? data.data : null };
      } catch (e) { return { ok:false, erro: String((e && e.message) || e).slice(0,120) }; }
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
        return { ok:true, data: data ? data.data : null, updatedAt: ultimoUpdatedAt };
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
        const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
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
    },
    // MIGRAÇÃO ÚNICA: lê o que sobrou no localStorage. Pode apagar estas duas funções quando todos os aparelhos já tiverem migrado.
    lerLegado(){
      const out = { state:null, mesAtual:null, logo:null };
      try {
        const raw = localStorage.getItem('siloe-data-v1');
        if (raw) out.state = JSON.parse(raw);
        out.mesAtual = localStorage.getItem('siloe-mes-atual') || null;
        out.logo = localStorage.getItem('siloe-logo') || null;
      } catch (e) {}
      return out;
    },
    limparLegado(){
      try { CHAVES_LEGADO.forEach(k => localStorage.removeItem(k)); } catch (e) {}
    }
  };

  if (window.SiloSupabase.enabled) {
    console.info('[SUPABASE] Cliente ativo. Persistência 100% remota.');
  } else {
    console.error('[SUPABASE] Cliente não configurado: o app não consegue salvar.');
  }
})();
