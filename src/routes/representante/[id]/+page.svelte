<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { supabase } from "$lib/supabase";
  import { browser } from "$app/environment";

  /* =====================
      PROPS & TYPES
  ===================== */
  const props = $props<{ data: { id: string } }>();
  const representanteId = props.data.id;

  type Otica = {
    id: string;
    nome: string;
    cidade: string;
    uf: string;
    telefone: string;
    responsavel: string;
    origem: string;
    funil_etapa: string;
    liberada: boolean;
    status: string;
    observacao: string | null;
    link_google_maps: string | null;
    created_at: string;
    sgo_id: string | null;
    pode_marcar_contato: boolean;
  };

  type Contato = {
    id: string;
    status: string;
    meio: string;
    canal: string;
    origem: string;
    observacao: string | null;
    created_at: string;
  };

  type Pedido = {
    id: string;
    tipo: "PAGO" | "BONIFICADO";
    status: "ATIVO" | "CANCELADO";
    valor: number | null;
    created_at: string;
    id_venda_sgo: string | null;
  };

  /* =====================
      STATE (RUNES)
  ===================== */
  let view = $state<"lista" | "detalhes">("lista");
  let activeTab = $state<"pendentes" | "concluidas">("pendentes");
  let searchQuery = $state("");

  let oticasOriginal = $state<Otica[]>([]);
  let oticaSelecionada = $state<Otica | null>(null);
  let contatos = $state<Contato[]>([]);

  let pedidos = $state<Pedido[]>([]);
  let receitaTotal = $state(0);

  let carregandoLista = $state(true);
  let carregandoDetalhes = $state(false);
  let carregandoPedidos = $state(false);
  let salvandoContato = $state(false);

  let aplicacaoPromocaoAtiva = $state<any | null>(null);

  /* =====================
      NOTIFICAÇÃO
  ===================== */
  let oneSignalInstance = $state<any>(null);
  let exibirBannerNotificacao = $state(false);
  let isOneSignalInitialized = false;

  /* =====================
      HELPERS
  ===================== */
  const formatData = (d?: string | null) =>
    d ? new Date(d).toLocaleString("pt-BR") : "—";

  const formatDataBR = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString("pt-BR") : "—";

  /* =====================
      FILTRO
  ===================== */
  let gruposExibidos = $derived.by(() => {
    const filtradas = oticasOriginal.filter(o => {
      const statusMatch =
        activeTab === "pendentes"
          ? o.pode_marcar_contato
          : !o.pode_marcar_contato;

      const searchMatch =
        o.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.cidade.toLowerCase().includes(searchQuery.toLowerCase());

      return statusMatch && searchMatch;
    });

    const grupos: Record<string, Otica[]> = {};
    filtradas.forEach(o => {
      grupos[o.cidade] ??= [];
      grupos[o.cidade].push(o);
    });

    return Object.keys(grupos).sort().map(cidade => ({
      nome: cidade,
      itens: grupos[cidade].sort((a, b) =>
        a.nome.localeCompare(b.nome)
      )
    }));
  });

  /* =====================
      AÇÕES
  ===================== */
  async function carregarOticas() {
    carregandoLista = true;
    try {
      const [{ data: oticas }, { data: contatosRep }] = await Promise.all([
        supabase
          .from("vw_oticas_representante_cards")
          .select("*")
          .eq("representante_id", representanteId),
        supabase
          .from("contatos")
          .select("otica_id")
          .eq("origem", "ATIVO")
      ]);

      const contatoMap = new Set(contatosRep?.map(c => c.otica_id) ?? []);

      oticasOriginal = (oticas ?? []).map((o: any) => ({
        ...o,
        pode_marcar_contato: !contatoMap.has(o.id)
      }));
    } finally {
      carregandoLista = false;
    }
  }

  async function initOneSignal() {
    if (!browser || isOneSignalInitialized) return;
    isOneSignalInitialized = true;

    const mod = await import("react-onesignal");
    oneSignalInstance = mod.default;

    await oneSignalInstance.init({
      appId: "5f714a7b-1f68-495e-a56d-8cbc137d8f4b",
      allowLocalhostAsSecureOrigin: true,
      notifyButton: { enable: false }
    });

    await oneSignalInstance.login(representanteId);

    const { data: rep } = await supabase
      .from("representantes")
      .select("push_active")
      .eq("id", representanteId)
      .single();

    if (!rep?.push_active) exibirBannerNotificacao = true;
  }

  async function ativarNotificacoes() {
    await oneSignalInstance.Notifications.requestPermission();
    await oneSignalInstance.login(representanteId);

    await supabase
      .from("representantes")
      .update({ push_active: true })
      .eq("id", representanteId);

    exibirBannerNotificacao = false;
  }

  async function abrirDetalhes(o: Otica) {
    view = "detalhes";
    oticaSelecionada = o;
    carregandoDetalhes = true;

    const { data: contatosData } = await supabase
      .from("contatos")
      .select("*")
      .eq("otica_id", o.id)
      .eq("origem", "ATIVO")
      .order("created_at", { ascending: false });

    contatos = contatosData ?? [];

    carregandoPedidos = true;

    const { data: pedidosData } = await supabase
      .from("pedidos")
      .select("id, tipo, status, valor, created_at, id_venda_sgo")
      .eq("otica_id", o.id)
      .eq("status", "ATIVO")
      .order("created_at", { ascending: false });

    pedidos = pedidosData ?? [];

    receitaTotal = pedidos.reduce(
      (t, p) => (p.tipo === "PAGO" && p.valor ? t + p.valor : t),
      0
    );

    carregandoPedidos = false;

    const { data: promo } = await supabase
      .from("aplicacoes_promocao")
      .select("*, promocoes(*)")
      .eq("otica_id", o.id)
      .eq("status", "APLICADA")
      .limit(1);

    aplicacaoPromocaoAtiva = promo?.[0] ?? null;
    carregandoDetalhes = false;
  }

  async function marcarContato() {
    if (!oticaSelecionada?.pode_marcar_contato) return;

    salvandoContato = true;
    await supabase.from("contatos").insert({
      otica_id: oticaSelecionada.id,
      meio: "MENSAGEM",
      canal: "SISTEMA",
      origem: "ATIVO",
      status: "REALIZADO",
      conta_comissao: true
    });

    await carregarOticas();
    view = "lista";
    salvandoContato = false;
  }

  onMount(async () => {
    carregarOticas();
    await initOneSignal();
  });
</script>

<!-- TEMPLATE (HTML + CSS permanece o mesmo que você já tem) -->


<div class="wrp">
  {#if exibirBannerNotificacao}
    <div class="banner-alerta">
      <div class="banner-content">
        <span class="icon">🔔</span>
        <div>
          <strong>Ative as notificações</strong>
          <p>Seja avisado assim que uma nova ótica for liberada.</p>
        </div>
      </div>
      <button onclick={ativarNotificacoes}>ATIVAR AGORA</button>
    </div>
  {/if}

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
        </div> <!-- FECHA .grid -->


        
 <!-- RECEITA DA ÓTICA -->
<section class="panel receita-panel">
  <h3>Receita da Ótica</h3>
  <div class="receita-box">
    <span>Total faturado</span>
    <strong>R$ {receitaTotal.toFixed(2)}</strong>
  </div>
</section>

<!-- PEDIDOS DA ÓTICA -->
<section class="panel">
  <h3>Pedidos da Ótica</h3>

  {#if carregandoPedidos}
    <p class="muted">Carregando pedidos...</p>

  {:else if pedidos.length === 0}
    <p class="muted">Nenhum pedido encontrado.</p>

  {:else}
    {#each pedidos as p (p.id)}
      <div class="pedido-item">
        <div class="pedido-top">
          <strong>
            {#if p.id_venda_sgo}
              SGO #{p.id_venda_sgo}
            {:else}
              Pedido interno
            {/if}
          </strong>
          <span class="status">{p.tipo}</span>
        </div>

        <div class="pedido-info">
          <span>{formatDataBR(p.created_at)}</span>
          <b>{p.valor ? `R$ ${p.valor.toFixed(2)}` : "—"}</b>
        </div>
      </div>
    {/each}
  {/if}
</section>




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
        <strong>
          {formatDataBR(aplicacaoPromocaoAtiva.validade_inicio)}
          →
          {formatDataBR(aplicacaoPromocaoAtiva.validade_fim)}
        </strong>
      </div>
    </div>
  </section>
{/if}
    </article>
  {/if}
</div>


<style>
  :global(body) { background: #f7f9fb; font-family: 'Inter', sans-serif; margin: 0; }
  .wrp { padding: 16px; max-width: 500px; margin: 0 auto; }
  
  /* ESTILO BANNER DESTAQUE */
  .banner-alerta {
    background: linear-gradient(135deg, #0ea5e3 0%, #0284c7 100%);
    color: white;
    padding: 16px;
    border-radius: 16px;
    margin-bottom: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 10px 15px -3px rgba(14, 165, 227, 0.3);
  }
  .banner-content { display: flex; align-items: center; gap: 12px; }
  .banner-content .icon { font-size: 24px; background: rgba(255, 255, 255, 0.2); padding: 8px; border-radius: 12px; }
  .banner-content strong { display: block; font-size: 14px; }
  .banner-content p { margin: 0; font-size: 12px; opacity: 0.9; }
  .banner-alerta button { background: white; color: #0ea5e3; border: none; padding: 10px; border-radius: 10px; font-weight: 800; font-size: 12px; cursor: pointer; }

  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .header h1 { font-size: 18px; font-weight: 800; }
  .btn-ghost { background: #fff; padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12px; font-weight: 700; cursor: pointer; }
  .search-box input { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 12px; box-sizing: border-box; }
  .tabs { display: flex; gap: 4px; background: #e2e8f0; padding: 4px; border-radius: 12px; margin-bottom: 16px; }
  .tabs button { flex: 1; border: none; padding: 10px; border-radius: 9px; font-size: 11px; font-weight: 800; color: #64748b; background: none; cursor: pointer; }
  .tabs button.active { background: #fff; color: #0ea5e3; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
  .city-group { margin-bottom: 16px; }
  .city-label { font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; margin-bottom: 6px; padding-left: 4px; }
  .card { all: unset; background: #fff; padding: 14px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; width: 100%; box-sizing: border-box; box-shadow: 0 1px 3px rgba(0,0,0,0.02); cursor: pointer; }
  .title { font-weight: 700; font-size: 14px; }
  .sub { font-size: 12px; color: #64748b; }
  .chevron { color: #cbd5e1; font-size: 18px; }
  .details { background: #fff; padding: 20px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
  .btn-back { background: none; border: none; color: #0ea5e3; font-weight: 800; font-size: 13px; margin-bottom: 12px; padding: 0; cursor: pointer; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
  .grid div { display: flex; flex-direction: column; font-size: 13px; }
  .grid b { font-size: 11px; text-transform: uppercase; color: #94a3b8; }
  .obs-box { background: #f0fdfa; padding: 12px; border-radius: 10px; margin: 12px 0; font-size: 13px; }
  .panel { margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
  .panel h3 { font-size: 15px; margin-bottom: 8px; }
  .quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 16px 0; }
  .action-btn { text-align: center; padding: 12px; border-radius: 10px; color: #fff; text-decoration: none; font-weight: 800; font-size: 13px; }
  .action-btn.call { background: #10b981; }
  .action-btn.map { background: #6366f1; }
  .btn-primary { width: 100%; background: #0ea5e3; color: #fff; border: none; padding: 16px; border-radius: 12px; font-weight: 800; cursor: pointer; }
  .btn-primary:disabled { opacity: 0.5; }
  .pill-ok-full { background: #dcfce7; color: #166534; padding: 14px; border-radius: 12px; text-align: center; font-weight: 700; }
  .contact-item { background: #f8fafc; padding: 10px; border-radius: 8px; margin-bottom: 8px; font-size: 12px; }
  .mono { font-family: monospace; color: #0ea5e3; font-weight: bold; }
  .muted { color: #64748b; font-size: 12px; margin-bottom: 12px; }

  .pedido-item {
  background: #f8fafc;
  padding: 12px;
  border-radius: 10px;
  margin-bottom: 8px;
  font-size: 13px;
}

.pedido-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.pedido-top .status {
  font-size: 11px;
  font-weight: 800;
  color: #0ea5e3;
  background: #e0f2fe;
  padding: 4px 8px;
  border-radius: 999px;
}

.pedido-info {
  display: flex;
  justify-content: space-between;
  color: #64748b;
}

</style>