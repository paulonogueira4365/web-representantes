<script lang="ts">
  /* =====================
     MANUTENÇÃO
     ===================== */

  // 🔴 ALTERE PARA false PARA REATIVAR O SISTEMA
  const MANUTENCAO_ATIVA = true;

  const DATA_RETORNO = "01/03/2026";
</script>

{#if MANUTENCAO_ATIVA}
  <!-- =====================
       TELA DE MANUTENÇÃO
  ===================== -->
  <div class="maintenance-root">
    <img src="/uplab-logo.jpg" class="logo" alt="UPLAB" />

    <h1>Sistema em manutenção</h1>

    <p class="msg">
      Estamos realizando melhorias importantes para você.
    </p>

    <div class="box">
      <strong>Previsão de retorno</strong>
      <span>{DATA_RETORNO}</span>
    </div>

    <p class="footer">
      Agradecemos sua compreensão 💙
    </p>
  </div>

{:else}

  <!-- =====================
       SISTEMA NORMAL
       (conteúdo original preservado)
  ===================== -->

  <script lang="ts">
    import { supabase } from "$lib/supabase";
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { browser } from "$app/environment";

    type RepresentanteUI = {
      id: string;
      nome: string;
      oticasLiberadas: number;
    };

    let representantes = $state<RepresentanteUI[]>([]);
    let carregando = $state(true);
    let erro = $state<string | null>(null);

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
      } catch (e) {
        erro = "Erro ao carregar os dados.";
      } finally {
        carregando = false;
      }
    }

    function abrirRepresentante(id: string) {
      goto(`/representante/${id}`);
    }

    onMount(() => {
      carregar();

      if (browser) {
        import("react-onesignal").then(async (mod) => {
          try {
            const OneSignal = mod.default;
            await OneSignal.init({
              appId: "5f714a7b-1f68-495e-a56d-8cbc137d8f4b",
              allowLocalhostAsSecureOrigin: true
            });
            await OneSignal.logout();
          } catch {}
        });

        const handleFocus = () => carregar();
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
      }
    });
  </script>

{/if}

<style>
  :global(:root) {
    --bg: #f8fafc;
    --primary: #0ea5e9;
    --muted: #64748b;
  }

  /* ===== MANUTENÇÃO ===== */

  .maintenance-root {
    min-height: 100vh;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    text-align: center;
    font-family: system-ui, sans-serif;
  }

  .logo {
    width: 90px;
    margin-bottom: 20px;
    border-radius: 14px;
  }

  h1 {
    font-size: 26px;
    font-weight: 800;
    margin-bottom: 8px;
  }

  .msg {
    color: var(--muted);
    max-width: 320px;
    margin-bottom: 24px;
  }

  .box {
    background: white;
    padding: 16px 24px;
    border-radius: 16px;
    box-shadow: 0 6px 16px rgb(0 0 0 / 0.08);
    margin-bottom: 20px;
  }

  .box strong {
    display: block;
    font-size: 13px;
    color: var(--muted);
  }

  .box span {
    font-size: 20px;
    font-weight: 800;
    color: var(--primary);
  }

  .footer {
    font-size: 13px;
    color: var(--muted);
  }
</style>
