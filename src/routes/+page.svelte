<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";

  /* =====================
      TYPES
  ===================== */
  type RepresentanteUI = {
    id: string;
    nome: string;
    oticasLiberadas: number;
  };

  /* =====================
      STATE (Svelte 5)
  ===================== */
  let representantes = $state<RepresentanteUI[]>([]);
  let carregando = $state(true);
  let erro = $state<string | null>(null);

  /* =====================
      DATA
  ===================== */
  async function carregar() {
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

        resultado.push({
          id: rep.id,
          nome: rep.nome,
          oticasLiberadas: oticas?.length ?? 0
        });
      }

      representantes = resultado;
    } catch (e: any) {
      console.error("Erro ao carregar representantes:", e);
      erro = "Erro ao carregar os dados.";
    } finally {
      carregando = false;
    }
  }

  function abrirRepresentante(id: string) {
    goto(`/representante/${id}`);
  }

  /* =====================
      LIFECYCLE
  ===================== */
  onMount(() => {
    carregar();

    if (browser) {
      // limpa sessão OneSignal ao voltar para a home
      import("react-onesignal").then(async (mod) => {
        try {
          const OneSignal = mod.default;
          await OneSignal.init({
            appId: "5f714a7b-1f68-495e-a56d-8cbc137d8f4b",
            allowLocalhostAsSecureOrigin: true
          });
          await OneSignal.logout();
        } catch {
          // ignora erros
        }
      });

      const handleFocus = () => carregar();
      window.addEventListener("focus", handleFocus);
      return () => window.removeEventListener("focus", handleFocus);
    }
  });
</script>

<!-- =====================
     TEMPLATE
===================== -->
<div class="root">
  <img src="/uplab-logo.jpg" class="logo" alt="UPLAB" />

  <h1 class="title">Portal UPLAB</h1>
  <p class="subtitle">Selecione seu usuário</p>

  {#if carregando}
    <div class="state">Carregando representantes…</div>

  {:else if erro}
    <div class="state error">{erro}</div>

  {:else}
    <div class="list">
      {#each representantes as r (r.id)}
        <button class="card" onclick={() => abrirRepresentante(r.id)}>
          <div class="info">
            <div class="nome">{r.nome}</div>
            <div class="stats">
              <span>✔ {r.oticasLiberadas} óticas liberadas</span>
            </div>
          </div>
          <span class="caret">›</span>
        </button>
      {/each}

      {#if representantes.length === 0}
        <div class="state">Nenhum representante encontrado.</div>
      {/if}
    </div>
  {/if}
</div>

<!-- =====================
     STYLE
===================== -->
<style>
  :global(:root) {
    --bg: #f8fafc;
    --card: #ffffff;
    --muted: #64748b;
    --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    --primary: #0ea5e9;
  }

  .root {
    min-height: 100vh;
    padding: 24px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--bg);
    font-family: system-ui, sans-serif;
  }

  .logo {
    width: 72px;
    margin-bottom: 16px;
    border-radius: 12px;
  }

  .title {
    font-size: 22px;
    font-weight: 800;
    margin: 0;
  }

  .subtitle {
    color: var(--muted);
    font-size: 14px;
    margin-bottom: 24px;
  }

  .list {
    width: 100%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .card {
    all: unset;
    background: var(--card);
    padding: 16px;
    border-radius: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: var(--shadow);
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .card:hover {
    box-shadow: 0 8px 12px -3px rgb(0 0 0 / 0.15);
  }

  .card:active {
    transform: scale(0.98);
  }

  .nome {
    font-weight: 700;
    margin-bottom: 6px;
  }

  .stats span {
    font-size: 12px;
    font-weight: 700;
    color: #166534;
    background: #dcfce7;
    padding: 4px 10px;
    border-radius: 999px;
  }

  .caret {
    color: #cbd5e1;
    font-size: 22px;
  }

  .state {
    margin-top: 40px;
    color: var(--muted);
    font-size: 14px;
    text-align: center;
  }

  .error {
    color: #ef4444;
    font-weight: 600;
  }
</style>
