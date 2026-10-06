(function(){
  const SUPABASE_URL = window.SUPABASE_URL || window.__SUPABASE_URL__ || '';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || window.__SUPABASE_ANON_KEY__ || '';

  function safeRandomId(){
    if (window.crypto && window.crypto.randomUUID) return 'device_' + window.crypto.randomUUID();
    return 'device_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function getAppUserId(){
    try {
      const saved = localStorage.getItem('siloe-supabase-user-id');
      if (saved) return saved;
      const next = safeRandomId();
      localStorage.setItem('siloe-supabase-user-id', next);
      return next;
    } catch (e) {
      return 'anonymous-device';
    }
  }

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
    userId: getAppUserId(),
    client,
    async loadState(){
      if (!client) return null;
      try {
        const { data, error } = await client
          .from('app_state')
          .select('data, updated_at')
          .eq('user_id', this.userId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        return data ? data.data : null;
      } catch (e) {
        console.error('[SUPABASE] Erro ao carregar estado:', e);
        return null;
      }
    },
    async saveState(payload){
      if (!client) return false;
      try {
        const { error } = await client
          .from('app_state')
          .upsert({
            user_id: this.userId,
            data: payload,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (error) throw error;
        return true;
      } catch (e) {
        console.error('[SUPABASE] Erro ao salvar estado:', e);
        return false;
      }
    }
  };

  if (window.SiloSupabase.enabled) {
    console.info('[SUPABASE] Cliente ativo. Persistência remota habilitada.');
  } else {
    console.info('[SUPABASE] Cliente não configurado; usando localStorage como fallback.');
  }
})();
