<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  // SSR-safe: id vindo do +page.ts
  export let data: { id: string };
  const representanteId = data.id;

  // -----------------------
  // Tipos
  // -----------------------
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
  };

  type ContatoRow = {
    id: string;
    otica_id: string;
    meio: string | null;
    nota: string | null;
    created_at: string;
  };

  // -----------------------
  // Estado UI
  // -----------------------
  let ativo: "oticas" | "detalhes" = "oticas";
  let sub: "todas" | "temperatura" | "novas" = "todas";

  let todasOtica: OticaRow[] = [];
  let temperaturaOtica: OticaRow[] = [];
  let novasOtica: OticaRow[] = [];

  // mapas e filtros
  let busca = "";
  let cidadeFilter = "Todas";
  let cidades: string[] = [];

  // mapa de último contato por otica_id (Date | null)
  let lastContactMap: Record<string, string | null> = {};

  // detalhes
  let oticaSelecionada: string | null = null;
  let detalhes: OticaRow | null = null;
  let contatos: ContatoRow[] = [];
  let carregandoListas = true;
  let carregandoOtica = false;
  let salvandoContato = false;

  // -----------------------
  // Util helpers
  // -----------------------
  function formatDateShort(d?: string | null) {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return d;
    }
  }

  function daysSince(dateIso?: string | null) {
    if (!dateIso) return Infinity;
    const diff = Date.now() - new Date(dateIso).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // ranking for temperatura
  const tempOrder = (t: string | null) => {
    if (!t) return 99;
    if (t === "QUENTE") return 1;
    if (t === "MORNO") return 2;
    if (t === "FRIO") return 3;
    return 99;
  };

  // -----------------------
  // Carrega listas principais
  // -----------------------
  async function carregarListas() {
    carregandoListas = true;

    // Todas as óticas liberadas (filtro representative handled in view)
    const { data: todas, error: e1 } = await supabase
      .from("view_oticas_representante")
      .select("*")
      .eq("representante_id", representanteId)
      .order("nome", { ascending: true });

    if (e1) {
      console.error("Erro ao buscar todas as óticas:", e1);
      todasOtica = [];
    } else {
      todasOtica = (todas ?? []) as OticaRow[];
    }

    // cidades para filtro
    const citySet = new Set<string>();
    todasOtica.forEach((o) => {
      if (o.cidade) citySet.add(o.cidade);
    });
    cidades = ["Todas", ...Array.from(citySet).sort()];

    // temperatura view (já ordenaremos por nossa ordem)
    const { data: temp, error: e2 } = await supabase
      .from("view_oticas_por_temperatura")
      .select("*")
      .eq("representante_id", representanteId);

    temperaturaOtica = (temp ?? []) as OticaRow[];

    // novas
    const { data: novas, error: e3 } = await supabase
      .from("view_oticas_novas")
      .select("*")
      .eq("representante_id", representanteId);

    novasOtica = (novas ?? []) as OticaRow[];

    // buscar últimos contatos para todas as óticas carregadas (limite)
    const oticaIds = todasOtica.map((o) => o.id);
    if (oticaIds.length > 0) {
      const { data: contatosAll, error: e4 } = await supabase
        .from("view_contatos_otica")
        .select("otica_id, created_at")
        .in("otica_id", oticaIds)
        .order("created_at", { ascending: false });

      if (e4) {
        console.error("Erro ao buscar contatos:", e4);
      } else {
        // primeiro item por otica é o mais recente (porque ordenamos desc)
        lastContactMap = {};
        (contatosAll ?? []).forEach((c: any) => {
          if (!lastContactMap[c.otica_id]) lastContactMap[c.otica_id] = c.created_at;
        });
      }
    } else {
      lastContactMap = {};
    }

    // preparar temperaturaOtica ordenada (garantir order)
    temperaturaOtica.sort((a, b) => {
      const oa = tempOrder(a.temperatura);
      const ob = tempOrder(b.temperatura);
      if (oa !== ob) return oa - ob;
      return (a.nome ?? "").localeCompare(b.nome ?? "");
    });

    carregandoListas = false;
  }

  // -----------------------
  // Abrir detalhes
  // -----------------------
  async function abrirDetalhes(id: string) {
    ativo = "detalhes";
    carregandoOtica = true;
    oticaSelecionada = id;

    const { data: det, error } = await supabase
      .from("oticas")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar detalhes:", error);
      detalhes = null;
    } else {
      detalhes = (det ?? null) as OticaRow | null;
    }

    const { data: cont, error: e2 } = await supabase
      .from("view_contatos_otica")
      .select("*")
      .eq("otica_id", id)
      .order("created_at", { ascending: false });

    contatos = (cont ?? []) as ContatoRow[];

    // atualizar mapa local
    lastContactMap[id] = contatos.length > 0 ? contatos[0].created_at : null;

    carregandoOtica = false;
  }

  // -----------------------
  // Marca contato rápido (botão)
  // -----------------------
  async function marcarContatoRapido(meio = "CHECK", nota = "Representante confirmou contato") {
    if (!oticaSelecionada) return;
    salvandoContato = true;

    const payload = {
      otica_id: oticaSelecionada,
      meio,
      nota,
    };

    const { data: insertData, error } = await supabase.from("contatos").insert([payload]).select().single();

    if (error) {
      console.error("Erro ao inserir contato:", error);
      // opcional: mostrar toast
    } else {
      // atualizar lista de contatos locais e mapa de último contato
      const novo: ContatoRow = {
        id: insertData.id,
        otica_id: insertData.otica_id,
        meio: insertData.meio,
        nota: insertData.nota,
        created_at: insertData.created_at,
      };
      contatos = [novo, ...contatos];
      lastContactMap[oticaSelecionada] = novo.created_at;
    }

    salvandoContato = false;
  }

  // -----------------------
  // Buscas / filtros (reactive)
  // -----------------------
  $: filtroTexto = busca.trim().toLowerCase();
  $: filtradas = todasOtica.filter((o) => {
    if (!o) return false;
    if (cidadeFilter !== "Todas" && (o.cidade ?? "") !== cidadeFilter) return false;
    if (!filtroTexto) return true;
    return (
      (o.nome ?? "").toLowerCase().includes(filtroTexto) ||
      (o.cidade ?? "").toLowerCase().includes(filtroTexto) ||
      (o.responsavel ?? "").toLowerCase().includes(filtroTexto)
    );
  });

  // agrupamento por temperatura com a ordem QUENTE -> MORNO -> FRIO
  $: porTemperaturaGrouped = {
    QUENTE: temperaturaOtica.filter((o) => o.temperatura === "QUENTE"),
    MORNO: temperaturaOtica.filter((o) => o.temperatura === "MORNO"),
    FRIO: temperaturaOtica.filter((o) => o.temperatura === "FRIO"),
  };

  // -----------------------
  // Navegação
  // -----------------------
  function voltarInicio() {
    goto("/");
  }

  function handleKeyOpen(ev: KeyboardEvent, id: string) {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      abrirDetalhes(id);
    }
  }

  onMount(() => {
    carregarListas();
  });
</script>

<!-- ===========================
       White Pro Layout
=========================== -->
<div class="wrp">
  <header class="header">
    <div class="brand">
      <img src="/uplab-logo.jpg" class="logo" />
      <div>
        <h1 class="title">Painel do Representante</h1>
        <p class="subtitle">Gerencie suas Óticas</p>
      </div>
    </div>

    <div class="header-actions">
      <button class="btn-ghost" on:click={voltarInicio} aria-label="Voltar para portal">
        ← Voltar ao Portal
      </button>
    </div>
  </header>

  <nav class="nav">
    <button class="tab {ativo === 'oticas' ? 'active' : ''}" on:click={() => (ativo = "oticas")}>
      Óticas
    </button>
    <button class="tab {ativo === 'detalhes' ? 'active' : ''}" on:click={() => (ativo = "detalhes")} disabled={!oticaSelecionada}>
      Detalhes
    </button>
  </nav>

  <main class="content">
    {#if ativo === "oticas"}
      <div class="controls">
        <div class="search">
          <input placeholder="Pesquisar por nome, cidade ou responsável" bind:value={busca} />
        </div>

        <div class="filters">
          <label>
            Cidade
            <select bind:value={cidadeFilter}>
              {#each cidades as c}
                <option value={c}>{c}</option>
              {/each}
            </select>
          </label>

          <label>
            Ver
            <select bind:value={sub}>
              <option value="todas">Todas</option>
              <option value="temperatura">Temperatura</option>
              <option value="novas">Novas</option>
            </select>
          </label>
        </div>
      </div>

      {#if carregandoListas}
        <div class="state">Carregando óticas...</div>
      {:else}
        <!-- SUB-VIEW: TODAS (com busca/cidade) -->
        {#if sub === "todas"}
          <div class="list">
            {#each filtradas as o (o.id)}
              <div
                class="card"
                role="button"
                tabindex="0"
                on:click={() => abrirDetalhes(o.id)}
                on:keydown={(e) => handleKeyOpen(e, o.id)}
              >
                <div class="left">
                  <div class="c-title">{o.nome}</div>
                  <div class="c-sub">{o.cidade} • {o.uf}</div>
                </div>

                <div class="right">
                  <div class="meta">
                    <div class="chip temp">{o.temperatura ?? "—"}</div>
                    <!-- indicador do ultimo contato -->
                    {#if lastContactMap[o.id]}
                      {#if daysSince(lastContactMap[o.id]) <= 7}
                        <div class="badge ok" title={"Último contato: " + formatDateShort(lastContactMap[o.id])}>Recent</div>
                      {:else if daysSince(lastContactMap[o.id]) <= 30}
                        <div class="badge warn" title={"Último contato: " + formatDateShort(lastContactMap[o.id])}>7–30d</div>
                      {:else}
                        <div class="badge cold" title={"Último contato: " + formatDateShort(lastContactMap[o.id])}>+30d</div>
                      {/if}
                    {:else}
                      <div class="badge none" title="Sem contato">—</div>
                    {/if}
                  </div>

                  <div class="caret">›</div>
                </div>
              </div>
            {/each}

            {#if filtradas.length === 0}
              <div class="state">Nenhuma ótica encontrada.</div>
            {/if}
          </div>
        {/if}

        <!-- SUB-VIEW: TEMPERATURA (agrupada QUENTE/MORNO/FRIO) -->
        {#if sub === "temperatura"}
          <div class="temp-sections">
            {#each ["QUENTE","MORNO","FRIO"] as sec}
              <section class="temp-block">
                <h3 class="temp-heading">{sec}</h3>
                {#if porTemperaturaGrouped[sec].length === 0}
                  <div class="state small">Nenhuma ótica nesta categoria.</div>
                {:else}
                  <div class="list">
                    {#each porTemperaturaGrouped[sec] as o (o.id)}
                      <div
                        class="card"
                        role="button"
                        tabindex="0"
                        on:click={() => abrirDetalhes(o.id)}
                        on:keydown={(e) => handleKeyOpen(e, o.id)}
                      >
                        <div class="left">
                          <div class="c-title">{o.nome}</div>
                          <div class="c-sub">{o.cidade} • {o.uf}</div>
                        </div>

                        <div class="right">
                          <div class="meta">
                            <div class="chip temp">{o.temperatura}</div>
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
                  </div>
                {/if}
              </section>
            {/each}
          </div>
        {/if}

        <!-- SUB-VIEW: NOVAS -->
        {#if sub === "novas"}
          <div class="list">
            {#each novasOtica as o (o.id)}
              <div
                class="card"
                role="button"
                tabindex="0"
                on:click={() => abrirDetalhes(o.id)}
                on:keydown={(e) => handleKeyOpen(e, o.id)}
              >
                <div class="left">
                  <div class="c-title">{o.nome}</div>
                  <div class="c-sub">Criada em {formatDateShort(o.created_at)}</div>
                </div>

                <div class="right">
                  <div class="chip new">Nova</div>
                  <div class="caret">›</div>
                </div>
              </div>
            {/each}

            {#if novasOtica.length === 0}
              <div class="state">Nenhuma ótica nova.</div>
            {/if}
          </div>
        {/if}
      {/if}
    {/if}

    <!-- =============================
         TAB DETALHES
    ============================== -->
    {#if ativo === "detalhes"}
      {#if carregandoOtica}
        <div class="state">Carregando detalhes...</div>
      {:else}
        {#if detalhes}
          <article class="details">
            <div class="d-header">
              <div>
                <h2 class="d-title">{detalhes.nome}</h2>
                <div class="d-sub">{detalhes.cidade} • {detalhes.uf}</div>
              </div>

              <div class="d-actions">
                <button class="btn-primary" on:click={() => marcarContatoRapido()}>
                  {#if salvandoContato}Salvando...{:else}Já entrei em contato{/if}
                </button>

                <button class="btn-ghost" on:click={voltarInicio}>Voltar</button>
              </div>
            </div>

            <section class="panel">
              <h3 class="p-title">Informações</h3>
              <div class="grid">
                <div>
                  <b>Responsável</b>
                  <div class="muted">{detalhes.responsavel ?? "—"}</div>
                </div>

                <div>
                  <b>Telefone</b>
                  <div class="muted">{detalhes.telefone ?? "—"}</div>
                </div>

                <div>
                  <b>Temperatura</b>
                  <div class="muted">{detalhes.temperatura ?? "—"}</div>
                </div>

                <div>
                  <b>Origem</b>
                  <div class="muted">{detalhes.origem ?? "—"}</div>
                </div>

                <div>
                  <b>Localização</b>
                  {#if detalhes.link_google_maps}
                    <a class="maps" href={detalhes.link_google_maps} target="_blank">Abrir no mapa →</a>
                  {:else}
                    <div class="muted">Não informado</div>
                  {/if}
                </div>
              </div>
            </section>

            {#if funil}
              <section class="panel">
                <h3 class="p-title">Funil Comercial</h3>
                <div class="muted">Etapa atual: <b>{funil.etapa_atual}</b></div>
                <div class="timeline">
                  {#each funil.historico ?? [] as h}
                    <div class="t-item">
                      <div class="t-when">{formatDateShort(h.data)}</div>
                      <div class="t-what"><b>{h.etapa_nova}</b><div class="muted">{h.descricao}</div></div>
                    </div>
                  {/each}
                </div>
              </section>
            {/if}

            <section class="panel">
              <h3 class="p-title">Contatos Recentes</h3>

              {#if contatos.length === 0}
                <div class="muted">Nenhum contato registrado.</div>
              {:else}
                <div class="list-contacts">
                  {#each contatos as c (c.id)}
                    <div class="contact">
                      <div class="c-left">
                        <div class="c-meio">{c.meio}</div>
                        <div class="muted">{formatDateShort(c.created_at)}</div>
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
    {/if}
  </main>
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
  .temp-block { background:transparent; }
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
</style>
