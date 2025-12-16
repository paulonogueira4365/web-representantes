<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { supabase } from "$lib/supabase";

  /* =====================
     DADOS DA ROTA
  ===================== */
  export let data: { id: string };
  const representanteId = data.id;
  console.log("REPRESENTANTE ID DA ROTA:", representanteId);

  /* =====================
     NOTIFICAÇÕES
  ===================== */
  let notificacoesAtivas = false;
  let ativandoNotificacao = false;

  async function verificarNotificacaoAtiva() {
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("representante_id", representanteId)
      .limit(1);

    if (!error) {
      notificacoesAtivas = !!data?.length;
    }
  }

  async function ativarNotificacoes() {
    if (ativandoNotificacao || notificacoesAtivas) return;
    if (typeof window === "undefined") return;

    if (!("serviceWorker" in navigator)) {
      alert("Navegador não suporta notificações");
      return;
    }

    ativandoNotificacao = true;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("Permissão negada");
        return;
      }

      // registra o Service Worker
      const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js"
      );

      await navigator.serviceWorker.ready;

      // importa FCM
      const { registrarFCM } = await import("$lib/firebase");
      const token = await registrarFCM(registration);

      if (!token) {
        alert("Token FCM não gerado");
        return;
      }

      await supabase.from("push_subscriptions").upsert(
        {
          representante_id: representanteId,
          fcm_token: token,
        },
        {
          onConflict: "representante_id,fcm_token",
        }
      );

      notificacoesAtivas = true;
      alert("Notificações ativadas 🔔");
    } catch (err) {
      console.error("Erro ao ativar notificações:", err);
      alert("Erro ao ativar notificações");
    } finally {
      ativandoNotificacao = false;
    }
  }

  /* =====================
     TIPOS
  ===================== */
  type OticaRow = {
    id: string;
    nome: string;
    cidade: string | null;
    uf: string | null;
    temperatura: "QUENTE" | "MORNO" | "FRIO" | string | null;
    telefone: string | null;
    responsavel: string | null;
    origem: string | null;
    link_google_maps: string | null;
    created_at: string;
    representante_id: string | null;
    liberada: boolean;
    observacao: string | null;
  };

  type ContatoRow = {
    id: string;
    otica_id: string;
    meio: string | null;
    nota: string | null;
    created_at: string;
  };

  /* =====================
     ESTADO
  ===================== */
  let ativo: "oticas" | "detalhes" = "oticas";

  let todasOtica: OticaRow[] = [];
  let cidades: string[] = [];

  let lastContactMap: Record<string, string | null> = {};

  let oticaSelecionada: string | null = null;
  let detalhes: OticaRow | null = null;
  let contatos: ContatoRow[] = [];

  let carregandoListas = true;
  let carregandoOtica = false;
  let salvandoContato = false;

  /* =====================
     HELPERS
  ===================== */
  function formatDateShort(d?: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString();
  }

  function daysSince(dateIso?: string | null) {
    if (!dateIso) return Infinity;
    return Math.floor(
      (Date.now() - new Date(dateIso).getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  /* =====================
     LISTAGEM
  ===================== */
  async function carregarListas() {
    carregandoListas = true;

    try {
      const { data, error } = await supabase
        .from("view_oticas_representante")
        .select("*")
        .eq("representante_id", representanteId);

      if (error) {
        console.error(error);
        todasOtica = [];
        return;
      }

      todasOtica = data as OticaRow[];

      const citySet = new Set<string>();
      todasOtica.forEach((o) => o.cidade && citySet.add(o.cidade));
      cidades = ["Todas", ...Array.from(citySet).sort()];

      const ids = todasOtica.map((o) => o.id);
      if (ids.length) {
        const { data: contatosAll } = await supabase
          .from("view_contatos_otica")
          .select("otica_id, created_at")
          .in("otica_id", ids)
          .order("created_at", { ascending: false });

        lastContactMap = {};
        contatosAll?.forEach((c: any) => {
          if (!lastContactMap[c.otica_id]) {
            lastContactMap[c.otica_id] = c.created_at;
          }
        });
      }
    } finally {
      carregandoListas = false;
    }
  }

  /* =====================
     DETALHES
  ===================== */
  async function abrirDetalhes(id: string) {
    ativo = "detalhes";
    carregandoOtica = true;
    oticaSelecionada = id;

    const { data: det } = await supabase
      .from("oticas")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    detalhes = det ?? null;

    const { data: cont } = await supabase
      .from("view_contatos_otica")
      .select("*")
      .eq("otica_id", id)
      .order("created_at", { ascending: false });

    contatos = cont ?? [];
    lastContactMap[id] = contatos[0]?.created_at ?? null;

    carregandoOtica = false;
  }

  /* =====================
     CONTATO RÁPIDO
  ===================== */
  async function marcarContatoRapido(
    oticaId: string,
    meio = "CHECK",
    nota = "Representante confirmou contato"
  ) {
    if (!detalhes || salvandoContato) return;

    const hoje = new Date().toISOString().slice(0, 10);
    if (lastContactMap[oticaId]?.slice(0, 10) === hoje) {
      alert("Você já registrou contato hoje.");
      return;
    }

    salvandoContato = true;

    try {
      const { data: contato } = await supabase
        .from("contatos")
        .insert([{
          otica_id: oticaId,
          nome: detalhes.nome,
          telefone: detalhes.telefone,
          cidade: detalhes.cidade,
          uf: detalhes.uf,
          responsavel: detalhes.responsavel,
          meio,
          nota
        }])
        .select()
        .single();

      await supabase
        .from("otica_representante")
        .update({ contato_realizado_em: new Date().toISOString() })
        .eq("otica_id", oticaId)
        .eq("representante_id", representanteId);

      lastContactMap[oticaId] = contato.created_at;
      contatos = [contato, ...contatos];
    } finally {
      salvandoContato = false;
    }
  }

  function voltarInicio() {
    goto("/");
  }

  onMount(() => {
    verificarNotificacaoAtiva();
    carregarListas();
  });
</script>

<!-- =====================
     HTML COMPLETO
===================== -->
<div class="wrp">
  <header class="header">
    <div class="brand">
      <img src="/uplab-logo.jpg" class="logo" alt="UPLAB" />
      <div>
        <h1 class="title">Painel do Representante</h1>
        <p class="subtitle">Gerencie suas Óticas</p>
      </div>
    </div>

    <div class="header-actions">
      <button class="btn-ghost" on:click={voltarInicio}>← Voltar</button>
     <button
  class="btn-primary"
  disabled={notificacoesAtivas}
  on:click={ativarNotificacoes}
>
  {notificacoesAtivas ? "🔔 Notificações ativas" : "🔔 Ativar notificações"}
</button>

    </div>
  </header>
<nav class="nav">
  <button
    class="tab {ativo === 'oticas' ? 'active' : ''}"
    on:click={() => (ativo = 'oticas')}
  >
    Óticas
  </button>

  <button
    class="tab {ativo === 'detalhes' ? 'active' : ''}"
    disabled={!oticaSelecionada}
    on:click={() => (ativo = 'detalhes')}
  >
    Detalhes
  </button>
</nav>

<main class="content">
  <!-- =========================
       LISTAGEM DE ÓTICAS
  ========================== -->
  {#if ativo === 'oticas'}
    {#if carregandoListas}
      <div class="state">Carregando óticas...</div>
    {:else}
      <div class="list">
        {#each todasOtica as o (o.id)}
          <div
            class="card"
            role="button"
            tabindex="0"
            on:click={() => abrirDetalhes(o.id)}
          >
            <div class="left">
              <div class="c-title">{o.nome}</div>
              <div class="c-sub">
                {o.cidade} • {o.uf}
              </div>
            </div>

            <div class="right">
              <div class="meta">
                <div class="chip temp">{o.temperatura ?? '—'}</div>

                {#if lastContactMap[o.id]}
                  {#if daysSince(lastContactMap[o.id]) <= 7}
                    <div class="badge ok">Recent</div>
                  {:else if daysSince(lastContactMap[o.id]) <= 30}
                    <div class="badge warn">7–30d</div>
                  {:else}
                    <div class="badge cold">+30d</div>
                  {/if}
                {:else}
                  <div class="badge none">—</div>
                {/if}
              </div>

              <div class="caret">›</div>
            </div>
          </div>
        {/each}

        {#if todasOtica.length === 0}
          <div class="state">Nenhuma ótica encontrada.</div>
        {/if}
      </div>
    {/if}
  {/if}

  <!-- =========================
       DETALHES DA ÓTICA
  ========================== -->
  {#if ativo === 'detalhes'}
    {#if carregandoOtica}
      <div class="state">Carregando detalhes...</div>
    {:else if detalhes}
      <article class="details">
        <div class="d-header">
          <div>
            <h2 class="d-title">{detalhes.nome}</h2>
            <div class="d-sub">
              {detalhes.cidade} • {detalhes.uf}
            </div>
          </div>

          <div class="d-actions">
            <button
              class="btn-primary"
              disabled={salvandoContato}
             on:click={() => detalhes && marcarContatoRapido(detalhes.id)}

            >
              {#if salvandoContato}
                Salvando...
              {:else}
                Já entrei em contato
              {/if}
            </button>

            <button class="btn-ghost" on:click={() => (ativo = 'oticas')}>
              Voltar
            </button>
          </div>
        </div>

        <!-- INFORMAÇÕES -->
        <section class="panel">
          <h3 class="p-title">Informações</h3>

          <div class="grid">
            <div>
              <b>Responsável</b>
              <div class="muted">{detalhes.responsavel ?? '—'}</div>
            </div>

            <div>
              <b>Telefone</b>
              <div class="muted">{detalhes.telefone ?? '—'}</div>
            </div>

            <div>
              <b>Temperatura</b>
              <div class="muted">{detalhes.temperatura ?? '—'}</div>
            </div>

            <div>
              <b>Origem</b>
              <div class="muted">{detalhes.origem ?? '—'}</div>
            </div>

            <div>
              <b>Localização</b>
              {#if detalhes.link_google_maps}
                <a
                  class="maps"
                  href={detalhes.link_google_maps}
                  target="_blank"
                >
                  Abrir no mapa →
                </a>
              {:else}
                <div class="muted">Não informado</div>
              {/if}
            </div>

            {#if detalhes.liberada && detalhes.observacao}
              <div>
                <b>Observação do SDR</b>
                <div class="obs-box">{detalhes.observacao}</div>
              </div>
            {/if}
          </div>
        </section>

        <!-- HISTÓRICO DE CONTATOS -->
        <section class="panel">
          <h3 class="p-title">Histórico de Contatos</h3>

          {#if contatos.length === 0}
            <div class="muted">Nenhum contato registrado.</div>
          {:else}
            <div class="list-contacts">
              {#each contatos as c (c.id)}
                <div class="contact">
                  <div class="c-left">
                    <div class="c-meio">{c.meio}</div>
                    <div class="muted">
                      {formatDateShort(c.created_at)}
                    </div>
                  </div>

                  <div class="c-note">{c.nota}</div>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      </article>
    {:else}
      <div class="state">Selecione uma ótica para ver os detalhes.</div>
    {/if}
  {/if}
</main>

  <!-- (restante do HTML e CSS permanece exatamente como no seu arquivo atual) -->
</div>

<style>

  :global(:root) {
    --bg: #f7f9fb;
    --card: #ffffff;
    --muted: #64748b;
    --accent: #0ea5a3;
    --radius: 12px;
    --shadow: 0 6px 20px rgba(2,6,23,0.06);
  }

  .wrp {
    min-height: 100vh;
    padding: 26px;
    background: var(--bg);
    font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 16px;
  }

  .brand { display:flex; gap:12px; align-items:center; }
  .logo { width:56px; border-radius:10px; }
  .title { font-size:20px; font-weight:700; margin:0; }
  .subtitle { margin:0; color:var(--muted); font-size:13px; }

  .header-actions { display:flex; gap:10px; align-items:center; }

  .btn-ghost, .btn-primary {
    padding:8px 12px;
    border-radius:10px;
    border:1px solid transparent;
    cursor:pointer;
    background:var(--card);
    box-shadow: var(--shadow);
    transition: .12s;
  }

  .btn-ghost:hover { transform:translateY(-2px); }
  .btn-primary { background: linear-gradient(180deg,#0fb7b1,#0ea5a3); color:white; border:none; }
  .btn-primary:hover { transform:translateY(-2px); }

  .nav { display:flex; gap:10px; margin-bottom:14px; }
  .tab { padding:10px 16px; border-radius:10px; background:var(--card); border:1px solid #e6eef3; cursor:pointer; }
  .tab.active { color:var(--accent); border-color:var(--accent); box-shadow: var(--shadow); font-weight:700; }

  .content { margin-top:6px; }

  .controls { display:flex; gap:12px; align-items:center; margin-bottom:12px; justify-content:space-between; flex-wrap:wrap; }
  .search input { padding:10px 12px; border-radius:10px; border:1px solid #e6eef3; min-width:280px; }
  .filters { display:flex; gap:8px; align-items:center; }
  .filters select { padding:8px 10px; border-radius:8px; border:1px solid #e6eef3; }

  .list { display:grid; gap:12px; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); }

  .card {
    background:var(--card);
    border-radius:12px;
    padding:14px;
    display:flex;
    justify-content:space-between;
    align-items:center;
    border:1px solid #e6eef3;
    box-shadow:var(--shadow);
    cursor:pointer;
    transition:.12s;
  }
  .card:hover { transform:translateY(-3px); }

  .left {}
  .c-title { font-weight:700; font-size:16px; }
  .c-sub { color:var(--muted); margin-top:4px; font-size:13px; }

  .right { display:flex; align-items:center; gap:10px; }
  .chip { padding:6px 10px; border-radius:999px; font-weight:700; font-size:12px; }
  .temp { background:#defcf9; color:#0e918c; }
  .chip.new { background:#fff1f2; color:#b4005a; }

  .badge { padding:6px 8px; border-radius:999px; font-weight:700; font-size:12px; }
  .badge.ok { background:#e6fffa; color:#0e918c; }
  .badge.warn { background:#fff7e6; color:#b36b00; }
  .badge.cold { background:#eef2ff; color:#334155; }
  .badge.none { background:#f1f5f9; color:var(--muted); }

  .caret { font-size:20px; color:var(--muted); }

  .temp-sections { display:flex; flex-direction:column; gap:16px; }
  .temp-block { }
  .temp-heading { margin:0 0 8px 0; font-weight:700; color:#0f172a; }

  .details { max-width:920px; margin:0 auto; background:var(--card); border-radius:14px; padding:18px; border:1px solid #e6eef3; box-shadow:var(--shadow); }
  .d-header { display:flex; justify-content:space-between; align-items:center; gap:12px; }
  .d-title { font-size:20px; margin:0; font-weight:800; }
  .d-sub { color:var(--muted); margin-top:6px; }

  .d-actions { display:flex; gap:8px; align-items:center; }

  .panel { margin-top:14px; padding:12px; border-radius:10px; background:#fff; border:1px solid #e6eef3; }
  .p-title { margin:0 0 8px 0; font-weight:700; }

  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; }

  .timeline { margin-top:10px; display:grid; gap:10px; }
  .t-item { display:flex; gap:10px; padding-left:10px; border-left:3px solid var(--accent); }

  .list-contacts { margin-top:8px; }
  .contact { display:flex; justify-content:space-between; padding:10px; border-radius:8px; border:1px solid #e6eef3; background:#fff; margin-bottom:8px; }
  .c-meio { font-weight:700; }
  .c-note { max-width:60%; }

  .state { text-align:center; color:var(--muted); margin-top:12px; }
  .state.small { font-size:13px; }
  /* === Observação SDR (adição segura) === */
.obs-preview {
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 260px;
}

.obs-box {
  margin-top: 6px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f0fdfa;
  border: 1px solid #99f6e4;
  color: #065f46;
  font-size: 14px;
  line-height: 1.4;
}

</style>