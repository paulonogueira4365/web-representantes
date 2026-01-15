<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { supabase } from "$lib/supabase";

  const props = $props<{ data: { id: string } }>();
  const representanteId = String(props.data.id);

  /* =====================
      TIPOS
  ===================== */
  type Otica = {
    id: string;
    nome: string;
    cidade: string;
    uf: string;
    telefone: string;
    responsavel: string;
    funil_etapa: string;
    status: string;
    observacao: string | null;
    link_google_maps: string | null;
    sgo_id: string | null;
    contatada: boolean;
    total_pedidos: number;
    receita: number;
  };

  type Contato = {
    id: string;
    status: string;
    meio: string;
    canal: string;
    created_at: string;
  };

  type Pedido = {
    id: string;
    tipo: "PAGO" | "BONIFICADO";
    valor: number | null;
    created_at: string;
    id_venda_sgo: string | null;
  };

  type Promocao = {
    validade_inicio: string;
    validade_fim: string;
    promocoes: { nome: string }[];
  };

  /* =====================
      STATE (Svelte 5)
  ===================== */
  let view = $state<"lista" | "detalhes">("lista");
  let filtroContato = $state<"todas" | "sem" | "com">("sem");
  let searchQuery = $state("");

  let oticas = $state<Otica[]>([]);
  let oticaSelecionada = $state<Otica | null>(null);
  let contatos = $state<Contato[]>([]);
  let pedidos = $state<Pedido[]>([]);
  let promocaoAtiva = $state<Promocao | null>(null);

  let carregandoLista = $state(true);
  let carregandoPedidos = $state(false);
  let salvandoContato = $state(false);

  /* =====================
      HELPERS
  ===================== */
  const formatDataBR = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString("pt-BR") : "—";

  /* =====================
      KPIs TOPO
  ===================== */
  let resumo = $derived.by(() => {
    const comPedido = oticas.filter(o => o.total_pedidos > 0);
    const receitaTotal = comPedido.reduce((t, o) => t + o.receita, 0);
    const ticketMedio =
      comPedido.length ? receitaTotal / comPedido.length : 0;

    return {
      oticasComPedido: comPedido.length,
      receitaTotal,
      ticketMedio
    };
  });

  /* =====================
      FILTRO + ORDEM
  ===================== */
  let oticasFiltradas = $derived.by(() => {
    const termo = searchQuery.toLowerCase();

    return oticas
      .filter(o => {
        const filtroOk =
          filtroContato === "todas" ||
          (filtroContato === "sem" && !o.contatada) ||
          (filtroContato === "com" && o.contatada);

        return (
          filtroOk &&
          (o.nome.toLowerCase().includes(termo) ||
            o.cidade.toLowerCase().includes(termo))
        );
      })
      .sort((a, b) => {
        if (a.contatada !== b.contatada) return a.contatada ? 1 : -1;
        return a.nome.localeCompare(b.nome);
      });
  });

  /* =====================
      DATA
  ===================== */
  async function carregarOticas() {
    carregandoLista = true;

    const { data: lista } = await supabase
      .from("vw_oticas_representante_cards")
      .select("*")
      .eq("representante_id", representanteId);

    const { data: contatosData } = await supabase
      .from("representante_otica_contato")
      .select("otica_id, contatada")
      .eq("representante_id", representanteId);

    const { data: pedidosData } = await supabase
      .from("pedidos")
      .select("otica_id, valor, tipo")
      .eq("status", "ATIVO");

    const mapContato = new Map(
      (contatosData ?? []).map(c => [c.otica_id, c.contatada])
    );

    const mapPedidos = new Map<string, { qtd: number; receita: number }>();
    for (const p of pedidosData ?? []) {
      if (p.tipo !== "PAGO" || !p.valor) continue;
      const cur = mapPedidos.get(p.otica_id) ?? { qtd: 0, receita: 0 };
      cur.qtd += 1;
      cur.receita += p.valor;
      mapPedidos.set(p.otica_id, cur);
    }

    oticas = (lista ?? []).map((o: any) => {
      const info = mapPedidos.get(o.id);
      return {
        ...o,
        contatada: mapContato.get(o.id) ?? false,
        total_pedidos: info?.qtd ?? 0,
        receita: info?.receita ?? 0
      };
    });

    carregandoLista = false;
  }

  async function abrirDetalhes(o: Otica) {
    view = "detalhes";
    oticaSelecionada = o;

    const { data: contatosData } = await supabase
      .from("contatos")
      .select("*")
      .eq("otica_id", o.id)
      .order("created_at", { ascending: false });

    contatos = contatosData ?? [];

    carregandoPedidos = true;

    const [{ data: pedidosData }, { data: promo }] = await Promise.all([
      supabase
        .from("pedidos")
        .select("*")
        .eq("otica_id", o.id)
        .eq("status", "ATIVO"),

      supabase
        .from("aplicacoes_promocao")
        .select("validade_inicio,validade_fim,promocoes(nome)")
        .eq("otica_id", o.id)
        .eq("status", "APLICADA")
        .limit(1)
    ]);

    pedidos = pedidosData ?? [];
    promocaoAtiva = promo?.[0] ?? null;
    carregandoPedidos = false;
  }

  async function marcarContato() {
    if (!oticaSelecionada) return;

    salvandoContato = true;

    await supabase.from("representante_otica_contato").upsert({
      representante_id: representanteId,
      otica_id: oticaSelecionada.id,
      contatada: true
    });

    await supabase.from("contatos").insert({
      otica_id: oticaSelecionada.id,
      meio: "MENSAGEM",
      canal: "PORTAL",
      status: "REALIZADO"
    });

    await carregarOticas();
    view = "lista";
    salvandoContato = false;
  }

  onMount(carregarOticas);
</script>

<!-- =====================
     TEMPLATE
===================== -->
<div class="wrp">
  {#if view === "lista"}
    <header class="header">
      <h1>Painel do Representante</h1>
      <button class="btn-ghost" onclick={() => goto("/")}>Sair</button>
    </header>

    <!-- KPIs -->
    <div class="kpis">
      <div class="kpi"><small>Óticas com pedidos</small><strong>{resumo.oticasComPedido}</strong></div>
      <div class="kpi"><small>Receita total</small><strong>R$ {resumo.receitaTotal.toFixed(2)}</strong></div>
      <div class="kpi"><small>Ticket médio</small><strong>R$ {resumo.ticketMedio.toFixed(2)}</strong></div>
    </div>

    <!-- Filtros -->
    <div class="filters">
      <input placeholder="Buscar ótica ou cidade…" bind:value={searchQuery} />
      <select bind:value={filtroContato}>
        <option value="sem">Sem contato</option>
        <option value="com">Com contato</option>
        <option value="todas">Todas</option>
      </select>
    </div>

    {#if carregandoLista}
      <p class="state">Carregando óticas...</p>
    {:else}
      <div class="list">
        {#each oticasFiltradas as o (o.id)}
          <button class="card" onclick={() => abrirDetalhes(o)}>
            <div>
              <div class="title">{o.nome}</div>
              <div class="sub">{o.cidade} • {o.uf}</div>
            </div>
            <div class="chevron">›</div>
          </button>
        {:else}
          <p class="state">Nenhuma ótica encontrada.</p>
        {/each}
      </div>
    {/if}

  {:else if oticaSelecionada}
    <!-- 🔥 DETALHES ORIGINAIS (MANTIDOS) -->
    <article class="details">
      <button class="btn-back" onclick={() => view = "lista"}>
        ← Voltar para lista
      </button>

      <h2>{oticaSelecionada.nome}</h2>

      <div class="grid">
        <div><b>Responsável</b><span>{oticaSelecionada.responsavel}</span></div>
        <div><b>Telefone</b><span>{oticaSelecionada.telefone}</span></div>
        <div><b>Cidade / UF</b><span>{oticaSelecionada.cidade} • {oticaSelecionada.uf}</span></div>
        <div><b>Etapa</b><span>{oticaSelecionada.funil_etapa}</span></div>
        <div><b>Status</b><span>{oticaSelecionada.status}</span></div>
        {#if oticaSelecionada.sgo_id}
          <div><b>SGO</b><span class="mono">{oticaSelecionada.sgo_id}</span></div>
        {/if}
      </div>

      <section class="panel">
        <h3>Receita</h3>
        <strong>R$ {oticaSelecionada.receita.toFixed(2)}</strong>
      </section>

      <section class="panel">
        <h3>Pedidos</h3>
        {#if carregandoPedidos}
          <p class="muted">Carregando pedidos...</p>
        {:else}
          {#each pedidos as p (p.id)}
            <div class="pedido-item">
              <span>{formatDataBR(p.created_at)}</span>
              <b>{p.valor ? `R$ ${p.valor.toFixed(2)}` : "—"}</b>
            </div>
          {:else}
            <p class="muted">Nenhum pedido</p>
          {/each}
        {/if}
      </section>

      <section class="panel">
        <button
          class="btn-primary"
          onclick={marcarContato}
          disabled={salvandoContato || oticaSelecionada.contatada}
        >
          {oticaSelecionada.contatada
            ? "CONTATO JÁ REGISTRADO"
            : salvandoContato
              ? "Salvando..."
              : "CONFIRMAR CONTATO"}
        </button>
      </section>

      <section class="panel">
        <h3>Histórico</h3>
        {#each contatos as c (c.id)}
          <div class="contact-item">
            <b>{c.status}</b>
            <span>{formatDataBR(c.created_at)}</span>
            <small>{c.meio} • {c.canal}</small>
          </div>
        {:else}
          <p class="muted">Sem contatos</p>
        {/each}
      </section>
    </article>
  {/if}
</div>



<style>
  :global(body){background:#f7f9fb;font-family:Inter,sans-serif}
  .wrp{padding:16px;max-width:540px;margin:auto}
  .header{display:flex;justify-content:space-between}
  .btn-ghost{background:#fff;border:1px solid #e2e8f0;padding:8px 12px;border-radius:8px}
  .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
  .kpi{background:#fff;padding:10px;border-radius:12px;text-align:center}
  .filters{display:flex;gap:8px;margin-bottom:12px}
  .filters input,.filters select{flex:1;padding:10px;border-radius:10px;border:1px solid #e2e8f0}
  .city{font-size:12px;color:#94a3b8;margin:12px 0 4px}
  .card{background:#fff;padding:12px;border-radius:12px;margin-bottom:6px;display:flex;justify-content:space-between}
  .title{font-weight:700}
  .sub,.meta{font-size:12px;color:#64748b}
  .btn-action{background:#0ea5e3;color:#fff;border:none;border-radius:8px;padding:8px;font-weight:700}
  .btn-action:disabled{background:#cbd5e1}
  .details{background:#fff;padding:16px;border-radius:16px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
  .grid b{font-size:11px;color:#94a3b8}
  .actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}
  .btn.call{background:#10b981}
  .btn.map{background:#6366f1}
  .btn{color:#fff;text-align:center;padding:10px;border-radius:10px;text-decoration:none;font-weight:700}
  .promo{background:#f0fdfa;padding:10px;border-radius:10px;margin:12px 0}
  .pedido{display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px}
  .obs{background:#f8fafc;padding:10px;border-radius:10px}
  .mono{font-family:monospace;color:#0ea5e3;font-weight:700}
  
.modal {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-card {
  background: #fff;
  padding: 24px;
  border-radius: 16px;
  width: 100%;
  max-width: 360px;
  text-align: center;
}

.modal-card h3 {
  margin-bottom: 6px;
}

.modal-card select {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  margin: 12px 0;
}

.btn-primary {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  background: #0ea5e3;
  color: #fff;
  font-weight: 800;
  border: none;
}

.btn-primary:disabled {
  opacity: 0.5;
}





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

