<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";

  type RepresentanteUI = {
    id: string;
    nome: string;
    oticasLiberadas: number;
    oticasComContato: number;
    oticasSemContato: number;
  };

  // --- ESTADO REATIVO (Svelte 5) ---
  // Inicializamos com valores padrão explícitos
  let representantes = $state<RepresentanteUI[]>([]);
  let carregando = $state(true);
  let erro = $state<string | null>(null);

  async function carregar() {
    // 💡 IMPORTANTE: Sempre use a atribuição direta para disparar a reatividade
    carregando = true; 
    erro = null;

    try {
      const { data: reps, error: repError } = await supabase
        .from("representantes")
        .select("id, nome")
        .order("nome");

      if (repError) throw repError;

      const resultado: RepresentanteUI[] = [];
      
      for (const rep of reps ?? []) {
        const { data: oticas } = await supabase
          .from("vw_oticas_representante_cards")
          .select("id")
          .eq("representante_id", rep.id);

        const oticaIds = oticas?.map(o => o.id) ?? [];
        const totalLiberadas = oticaIds.length;
        let comContato = 0;

        if (totalLiberadas > 0) {
          const { data: contatosRep } = await supabase
            .from("contatos")
            .select("otica_id")
            .in("otica_id", oticaIds)
            .eq("origem", "ATIVO");

          const oticasComContato = new Set(contatosRep?.map(c => c.otica_id) ?? []);
          comContato = oticasComContato.size;
        }

        resultado.push({
          id: rep.id,
          nome: rep.nome,
          oticasLiberadas: totalLiberadas,
          oticasComContato: comContato,
          oticasSemContato: totalLiberadas - comContato
        });
      }
      
      // Atualiza o estado de uma vez só
      representantes = resultado;
    } catch (e: any) {
      console.error("Erro na busca:", e);
      erro = e.message;
    } finally {
      carregando = false;
    }
  }

  function abrir(id: string) {
    goto(`/representante/${id}`);
  }

  onMount(() => {
    carregar();

    if (browser) {
      // Corrigido: Inicializa antes de deslogar
      import('react-onesignal').then(async (mod) => {
        const OneSignal = mod.default;
        
        try {
          // Precisamos do init para o logout funcionar sem erro 'tt'
          await OneSignal.init({
            appId: "5f714a7b-1f68-495e-a56d-8cbc137d8f4b",
            allowLocalhostAsSecureOrigin: true
          });
          
          await OneSignal.logout();
          console.log("Sessão OneSignal limpa.");
        } catch (e) {
          // Silencia erros caso o OneSignal já esteja inicializado ou falhe
        }
      });

      const handleFocus = () => carregar();
      window.addEventListener("focus", handleFocus);
      return () => window.removeEventListener("focus", handleFocus);
    }
  });
</script>

<div class="root">
  <img src="/uplab-logo.jpg" class="logo" alt="UPLAB" />

  <h1 class="title">Portal UPLAB</h1>
  <p class="subtitle">SELECIONE SEU USUÁRIO</p>

  {#if carregando}
    <div class="state">Carregando…</div>
  {:else if erro}
    <div class="state error">{erro}</div>
  {:else}
    <div class="list">
      {#each representantes as r (r.id)}
        <button class="card" onclick={() => abrir(r.id)}>
          <div class="info">
            <div class="nome">{r.nome}</div>
            <div class="stats">
              <span class="ok">✔ {r.oticasLiberadas} óticas</span>
              <span class="info-blue">✅ {r.oticasComContato} contatos</span>
              <span class="warn">⚠ {r.oticasSemContato} pendentes</span>
            </div>
          </div>
          <span class="caret">›</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  :global(:root) {
    --bg: #f8fafc;
    --card: #ffffff;
    --muted: #64748b;
    --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  }
  .root {
    min-height: 100vh;
    padding: 24px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--bg);
    font-family: sans-serif;
  }
  .logo { width: 72px; margin-bottom: 16px; border-radius: 12px; }
  .title { font-size: 22px; font-weight: 800; margin: 0; }
  .subtitle { color: var(--muted); font-size: 14px; margin-bottom: 24px; }
  .list { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 12px; }
  .card {
    all: unset; background: var(--card); padding: 16px; border-radius: 16px;
    display: flex; justify-content: space-between; align-items: center;
    box-shadow: var(--shadow); cursor: pointer; transition: transform 0.2s;
  }
  .card:active { transform: scale(0.98); }
  .nome { font-weight: 700; display: block; margin-bottom: 4px; }
  .stats { display: flex; gap: 8px; font-size: 11px; font-weight: 600; }
  .ok { color: #16a34a; }
  .info-blue { color: #2563eb; }
  .warn { color: #d97706; }
  .caret { color: #cbd5e1; font-size: 20px; }
  .state { margin-top: 40px; color: var(--muted); }
  .error { color: #ef4444; }
</style>