<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  type RepresentanteUI = {
    id: string;
    nome: string;
    oticasLiberadas: number;
    oticasComContato: number;
    oticasSemContato: number;
  };

  let representantes: RepresentanteUI[] = [];
  let carregando = true;
  let erro: string | null = null;

  async function carregar() {
    carregando = true;
    erro = null;

    const { data: reps, error: repError } = await supabase
      .from("representantes")
      .select("id, nome")
      .order("nome");

    if (repError) {
      erro = repError.message;
      carregando = false;
      return;
    }

    const resultado: RepresentanteUI[] = [];

    for (const rep of reps ?? []) {
      const { data: oticas, error: oticaError } = await supabase
  .from("vw_oticas_representante_cards")
  .select("id")
  .eq("representante_id", rep.id);


      if (oticaError) continue;

      const oticaIds = oticas?.map(o => o.id) ?? [];
      const totalLiberadas = oticaIds.length;

      let comContato = 0;

      if (oticaIds.length > 0) {
        const { data: contatosRep } = await supabase
          .from("contatos")
          .select("otica_id")
          .in("otica_id", oticaIds)
          .eq("origem", "ATIVO"); // 🔒 contato do representante

        const oticasComContato = new Set(
          contatosRep?.map(c => c.otica_id) ?? []
        );

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

    representantes = resultado;
    carregando = false;
  }

  function abrir(id: string) {
    goto(`/representante/${id}`);
  }

  onMount(() => {
    carregar();

    const handleFocus = () => {
      carregar();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
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
        <button class="card" on:click={() => abrir(r.id)}>
          <div class="info">
            <div class="nome">{r.nome}</div>
            <div class="stats">
              <span class="ok">✔ {r.oticasLiberadas} óticas liberadas</span>
              <span class="info-blue">✅ {r.oticasComContato} com contato</span>
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
  .root {
    min-height: 100vh;
    padding: 24px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--bg);
  }

  .logo {
    width: 72px;
    margin: 24px 0 16px;
    border-radius: 16px;
  }

  .title {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
  }

  .subtitle {
    margin: 6px 0 20px;
    color: var(--muted);
  }

  .list {
    width: 100%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .card {
    all: unset;
    background: var(--card);
    padding: 18px 20px;
    border-radius: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: var(--shadow);
    cursor: pointer;
  }

  .card:active {
    transform: scale(0.97);
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .nome {
    font-weight: 700;
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    font-size: 13px;
  }

  .ok { color: #16a34a; }
  .info-blue { color: #2563eb; }
  .warn { color: #d97706; }

  .caret {
    font-size: 22px;
    color: var(--muted);
  }

  .state {
    margin-top: 24px;
    color: var(--muted);
  }

  .state.error {
    color: #dc2626;
  }
</style>
