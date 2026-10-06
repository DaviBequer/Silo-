(function(){
  const SUPABASE_URL = window.SUPABASE_URL || window.__SUPABASE_URL__ || '';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || window.__SUPABASE_ANON_KEY__ || '';

  // ID fixo: todos os aparelhos enxergam os mesmos dados. Não compartilhe este arquivo publicamente.
  const USER_ID = 'siloe_b28aad42c1064df76ef2b8fe4def8dd2';

  // Chaves antigas do localStorage: lidas só uma vez, para migrar os dados para o Supabase.
  const CHAVES_LEGADO = ['siloe-data-v1','siloe-mes-atual','siloe-logo','siloe-supabase-user-id','siloe-backups-auto','siloe-versao-anterior'];

  function getClient(){
    if (!window.supabase) return null;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  }

  const client = getClient();

  window.SiloSupabase = {
    enabled: !!client,
    userId: USER_ID,
    client,
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
        return { ok:true, data: data ? data.data : null };
      } catch (e) {
        console.error('[SUPABASE] Erro ao carregar estado:', e);
        return { ok:false, error:e };
      }
    },
    async saveState(payload){
      if (!client) return false;
      try {
        const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
        const { error } = await client
          .from('app_state')
          .upsert({
            user_id: USER_ID,
            data: parsed,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
        if (error) throw error;
        return true;
      } catch (e) {
        console.error('[SUPABASE] Erro ao salvar estado:', e);
        return false;
      }
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
