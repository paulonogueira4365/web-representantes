<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { supabase } from "$lib/supabase";

  /* =====================
      PROPS & TYPES
  ===================== */
  const props = $props<{ data: { id: string } }>();
  const representanteId = props.data.id;

  type Otica = {
    id: string; nome: string; cidade: string; uf: string; telefone: string;
    responsavel: string; origem: string; funil_etapa: string; liberada: boolean;
    status: string; observacao: string | null; link_google_maps: string | null;
    created_at: string; sgo_id: string | null; pode_marcar_contato: boolean;
  };

  type Contato = {
    id: string; status: string; meio: string; canal: string;
    origem: string; observacao: string | null; created_at: string;
  };

  /* =====================
      STATE
  ===================== */
  let view = $state<"lista" | "detalhes">("lista");
  let activeTab = $state<"pendentes" | "concluidas">("pendentes");
  let searchQuery = $state("");
  
  let oticasOriginal = $state<Otica[]>([]);
  let oticaSelecionada = $state<Otica | null>(null);
  let contatos = $state<Contato[]>([]);

  let carregandoLista = $state(true);
  let carregandoDetalhes = $state(false);
  let salvandoContato = $state(false);
  let aplicacaoPromocaoAtiva = $state<any | null>(null);

  /* =====================
      HELPERS
  ===================== */
  const formatData = (d?: string | null) => d ? new Date(d).toLocaleString("pt-BR") : "—";
  const formatDataBR = (d?: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

  /* =====================
      LÓGICA DE FILTRO & AGRUPAMENTO
  ===================== */
  let gruposExibidos = $derived.by(() => {
    let filtradas = oticasOriginal.filter(o => {
      const statusMatch = activeTab === "pendentes" ? o.pode_marcar_contato : !o.pode_marcar_contato;
      const searchMatch = o.nome.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          o.cidade.toLowerCase().includes(searchQuery.toLowerCase());
      return statusMatch && searchMatch;
    });

    const grupos: Record<string, Otica[]> = {};
    filtradas.forEach(o => {
      if (!grupos[o.cidade]) grupos[o.cidade] = [];
      grupos[o.cidade].push(o);
    });

    return Object.keys(grupos).sort().map(cidade => ({
      nome: cidade,
      itens: grupos[cidade].sort((a, b) => a.nome.localeCompare(b.nome))
    }));
  });

  /* =====================
      AÇÕES
  ===================== */
  async function carregarOticas() {
    carregandoLista = true;
    const [{ data: oticasData }, { data: contatosRep }] = await Promise.all([
      supabase.from("vw_oticas_representante_cards").select("*").eq("representante_id", representanteId),
      supabase.from("contatos").select("otica_id").eq("origem", "ATIVO")
    ]);

    const contatoMap = new Set(contatosRep?.map(c => c.otica_id) ?? []);
    oticasOriginal = (oticasData ?? []).map((o: any) => ({
      ...o,
      pode_marcar_contato: !contatoMap.has(o.id)
    }));
    carregandoLista = false;
  }

  async function abrirDetalhes(o: Otica) {
    view = "detalhes";
    oticaSelecionada = o;
    carregandoDetalhes = true;
    const hoje = new Date().toISOString().slice(0, 10);

    const { data: contatosData } = await supabase
      .from("contatos")
      .select("*")
      .eq("otica_id", o.id)
      .eq("origem", "ATIVO")
      .order("created_at", { ascending: false });

    contatos = (contatosData ?? []) as Contato[];

    const { data: appsPromo } = await supabase
      .from("aplicacoes_promocao")
      .select("*, promocoes(*)")
      .eq("otica_id", o.id)
      .eq("status", "APLICADA")
      .limit(1);

    aplicacaoPromocaoAtiva = appsPromo?.[0] ?? null;
    carregandoDetalhes = false;
  }

  async function marcarContato() {
    if (!oticaSelecionada?.pode_marcar_contato) return;
    salvandoContato = true;

    const { error } = await supabase.from("contatos").insert({
      otica_id: oticaSelecionada.id,
      meio: "MENSAGEM", canal: "SISTEMA", origem: "ATIVO",
      status: "REALIZADO", conta_comissao: true,
      observacao: "Contato realizado via Painel do Representante"
    });

    if (!error) {
      oticaSelecionada.pode_marcar_contato = false;
      await carregarOticas();
      view = "lista";
    }
    salvandoContato = false;
  }

  onMount(carregarOticas);
</script>

<div class="wrp">
  {#if view === "lista"}
    <header class="header">
      <h1>Painel do Representante</h1>
      <button class="btn-ghost" onclick={() => goto("/")}>Sair</button>
    </header>

    <div class="search-box">
      <input type="text" placeholder="Buscar ótica ou cidade..." bind:value={searchQuery} />
    </div>

    <nav class="tabs">
      <button class:active={activeTab === "pendentes"} onclick={() => activeTab = "pendentes"}>
        PENDENTES <span>({oticasOriginal.filter(o => o.pode_marcar_contato).length})</span>
      </button>
      <button class:active={activeTab === "concluidas"} onclick={() => activeTab = "concluidas"}>
        CONTATADAS <span>({oticasOriginal.filter(o => !o.pode_marcar_contato).length})</span>
      </button>
    </nav>

    {#if carregandoLista}
      <p class="state">Carregando óticas...</p>
    {:else}
      <div class="list">
        {#each gruposExibidos as grupo}
          <div class="city-group">
            <h2 class="city-label">{grupo.nome}</h2>
            {#each grupo.itens as o}
              <button class="card" onclick={() => abrirDetalhes(o)}>
                <div>
                  <div class="title">{o.nome}</div>
                  <div class="sub">{o.responsavel} • {o.telefone}</div>
                </div>
                <div class="chevron">›</div>
              </button>
            {/each}
          </div>
        {:else}
          <p class="state">Nenhuma ótica encontrada.</p>
        {/each}
      </div>
    {/if}

  {:else if oticaSelecionada}
    <article class="details">
      <button class="btn-back" onclick={() => view = "lista"}>← Voltar para lista</button>
      
      <h2>{oticaSelecionada.nome}</h2>

      <div class="grid">
        <div><b>Responsável</b><span>{oticaSelecionada.responsavel}</span></div>
        <div><b>Telefone</b><span>{oticaSelecionada.telefone}</span></div>
        {#if oticaSelecionada.sgo_id}
          <div><b>SGO ID</b><span class="mono">{oticaSelecionada.sgo_id}</span></div>
        {/if}
        <div><b>Cidade / UF</b><span>{oticaSelecionada.cidade} • {oticaSelecionada.uf}</span></div>
        <div><b>Etapa do Funil</b><span>{oticaSelecionada.funil_etapa}</span></div>
        <div><b>Status</b><span>{oticaSelecionada.status}</span></div>
      </div>

      {#if oticaSelecionada.observacao}
        <div class="obs-box">
          <b>Observações da Ótica</b>
          <p>{oticaSelecionada.observacao}</p>
        </div>
      {/if}

      <div class="quick-actions">
        <a class="action-btn call" href="tel:{oticaSelecionada.telefone}">📞 Ligar</a>
        {#if oticaSelecionada.link_google_maps}
          <a class="action-btn map" href={oticaSelecionada.link_google_maps} target="_blank">📍 Maps</a>
        {/if}
      </div>

      <section class="panel">
        {#if oticaSelecionada.pode_marcar_contato}
          <button class="btn-primary" onclick={marcarContato} disabled={salvandoContato}>
            {salvandoContato ? "Salvando..." : "CONFIRMAR CONTATO"}
          </button>
        {:else}
          <div class="pill-ok-full">✓ Contato já registrado</div>
        {/if}
      </section>

      <section class="panel">
        <h3>Histórico de Contatos</h3>
        {#if contatos.length === 0}
          <p class="muted">Nenhum contato registrado.</p>
        {:else}
          {#each contatos as c (c.id)}
            <div class="contact-item">
              <b>{c.status}</b>
              <span>{formatData(c.created_at)}</span>
              <small>{c.meio} • {c.canal}</small>
            </div>
          {/each}
        {/if}
      </section>

      {#if aplicacaoPromocaoAtiva}
        <section class="panel promo-panel">
          <h3 class="promo-title">🎯 CONDIÇÕES NEGOCIADAS</h3>
          <div class="promo-box">
            <strong>{aplicacaoPromocaoAtiva.promocoes.nome}</strong>
            <div class="promo-validade">
              <small class="label">Validade</small>
              <strong>{formatDataBR(aplicacaoPromocaoAtiva.validade_inicio)} → {formatDataBR(aplicacaoPromocaoAtiva.validade_fim)}</strong>
            </div>
            {#if aplicacaoPromocaoAtiva.promocoes.beneficios?.length}
              <div class="beneficios">
                {#each aplicacaoPromocaoAtiva.promocoes.beneficios as b}
                  <div class="beneficio-item">🎁 {b.label}</div>
                {/each}
              </div>
            {/if}
            {#if aplicacaoPromocaoAtiva.checklist}
              <div class="checklist">
                {#each Object.entries(aplicacaoPromocaoAtiva.checklist) as [k, v]}
                  <span class="pill {v ? 'ok' : 'warn'}">
                    {k === 'sgo_registrado' ? 'CADASTRADO NO SGO' : k.replaceAll('_',' ')}
                  </span>
                {/each}
              </div>
            {/if}
          </div>
        </section>
      {/if}
    </article>
  {/if}
</div>

<style>
  :global(body) { background: #f7f9fb; font-family: 'Inter', sans-serif; margin: 0; }
  .wrp { padding: 16px; max-width: 500px; margin: 0 auto; }
  
  /* HEADER & NAV */
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .header h1 { font-size: 18px; font-weight: 800; }
  .btn-ghost { background: #fff; padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12px; font-weight: 700; }
  
  .search-box input { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 12px; box-sizing: border-box; }

  .tabs { display: flex; gap: 4px; background: #e2e8f0; padding: 4px; border-radius: 12px; margin-bottom: 16px; }
  .tabs button { flex: 1; border: none; padding: 10px; border-radius: 9px; font-size: 11px; font-weight: 800; color: #64748b; background: none; }
  .tabs button.active { background: #fff; color: #0ea5e3; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

  /* LISTA */
  .city-group { margin-bottom: 16px; }
  .city-label { font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; margin-bottom: 6px; padding-left: 4px; }
  .card { all: unset; background: #fff; padding: 14px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; width: 100%; box-sizing: border-box; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
  .title { font-weight: 700; font-size: 14px; }
  .sub { font-size: 12px; color: #64748b; }
  .chevron { color: #cbd5e1; font-size: 18px; }

  /* DETALHES */
  .details { background: #fff; padding: 20px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
  .btn-back { background: none; border: none; color: #0ea5e3; font-weight: 800; font-size: 13px; margin-bottom: 12px; padding: 0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
  .grid div { display: flex; flex-direction: column; font-size: 13px; }
  .grid b { font-size: 11px; text-transform: uppercase; color: #94a3b8; }
  
  .obs-box { background: #f0fdfa; padding: 12px; border-radius: 10px; margin: 12px 0; font-size: 13px; }
  .panel { margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
  .panel h3 { font-size: 15px; margin-bottom: 12px; }

  .quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 16px 0; }
  .action-btn { text-align: center; padding: 12px; border-radius: 10px; color: #fff; text-decoration: none; font-weight: 800; font-size: 13px; }
  .action-btn.call { background: #10b981; }
  .action-btn.map { background: #6366f1; }

  .btn-primary { width: 100%; background: #0ea5e3; color: #fff; border: none; padding: 16px; border-radius: 12px; font-weight: 800; }
  .pill-ok-full { background: #dcfce7; color: #166534; padding: 14px; border-radius: 12px; text-align: center; font-weight: 700; }

  /* HISTÓRICO & PROMO */
  .contact-item { background: #f8fafc; padding: 10px; border-radius: 8px; margin-bottom: 8px; font-size: 12px; }
  .promo-box { border: 2px dashed #e2e8f0; padding: 16px; border-radius: 12px; margin-top: 10px; }
  .beneficios { margin: 10px 0; display: flex; flex-direction: column; gap: 4px; }
  .beneficio-item { font-size: 13px; font-weight: 700; }
  .pill { padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; margin-right: 4px; }
  .pill.ok { background: #dcfce7; color: #166534; }
  .pill.warn { background: #fef3c7; color: #92400e; }
  
  .mono { font-family: monospace; color: #0ea5e3; font-weight: bold; }
  .muted { color: #94a3b8; font-size: 12px; }
</style>