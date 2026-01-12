<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { supabase } from "$lib/supabase";
  import { browser } from "$app/environment";

  /* =====================
      PROPS
  ===================== */
  const props = $props<{ data: { id: string } }>();
  const representanteId = props.data.id;

  /* =====================
      TIPOS
  ===================== */
  type Representante = {
    id: string;
    nome: string;
    push_active: boolean;
  };

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
    pode_marcar_contato: boolean;
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

  /* =====================
      STATE
  ===================== */
  let view = $state<"lista" | "detalhes">("lista");

  let representantes = $state<Representante[]>([]);
  let representanteSelecionado = $state<string | null>(null);
  let modalIdentificacaoOpen = $state(true);

  let oticasOriginal = $state<Otica[]>([]);
  let oticaSelecionada = $state<Otica | null>(null);
  let contatos = $state<Contato[]>([]);
  let pedidos = $state<Pedido[]>([]);
  let receitaTotal = $state(0);

  let carregandoLista = $state(true);
  let carregandoDetalhes = $state(false);
  let carregandoPedidos = $state(false);
  let salvandoContato = $state(false);

  let oneSignal: any = null;

  /* =====================
      HELPERS
  ===================== */
  const formatDataBR = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString("pt-BR") : "—";

  /* =====================
      INIT
  ===================== */
  onMount(async () => {
    await carregarRepresentantes();
    await carregarOticas();
  });

  /* =====================
      NOTIFICAÇÃO (MODELO NOVO)
  ===================== */
  async function confirmarIdentidade() {
  if (!browser || !representanteSelecionado) return;

  /* =====================
     1️⃣ PERMISSÃO NATIVA
  ===================== */
  let permission = getNotificationPermission();

  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    alert("É necessário permitir notificações para continuar.");
    return;
  }

  /* =====================
     2️⃣ INIT ONESIGNAL
  ===================== */
  const mod = await import("react-onesignal");
  oneSignal = mod.default;

  await oneSignal.init({
    appId: "5f714a7b-1f68-495e-a56d-8cbc137d8f4b",
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: false }
  });

  /* =====================
     3️⃣ PROTEÇÃO ANTI DUPLICAÇÃO
  ===================== */
  const currentExternalId =
    await oneSignal.User?.getExternalId?.();

  if (currentExternalId && currentExternalId !== representanteSelecionado) {
    // 🔥 estava vinculado a outro representante
    await oneSignal.logout();
  }

  /* =====================
     4️⃣ LOGIN DEFINITIVO
  ===================== */
  await oneSignal.login(representanteSelecionado);

  /* =====================
     5️⃣ SALVA NO BANCO
  ===================== */
  await supabase
    .from("representantes")
    .update({ push_active: true })
    .eq("id", representanteSelecionado);

  modalIdentificacaoOpen = false;
}

function getNotificationPermission(): NotificationPermission {
  return Notification.permission;
}



  /* =====================
      DADOS
  ===================== */
  async function carregarRepresentantes() {
    const { data } = await supabase
      .from("representantes")
      .select("id, nome, push_active")
      .order("nome");

    representantes = data ?? [];
  }

  async function carregarOticas() {
    carregandoLista = true;

    const { data } = await supabase
      .from("vw_oticas_representante_cards")
      .select("*")
      .eq("representante_id", representanteId);

    oticasOriginal = data ?? [];
    carregandoLista = false;
  }

  async function abrirDetalhes(o: Otica) {
    view = "detalhes";
    oticaSelecionada = o;
    carregandoDetalhes = true;

    const { data: contatosData } = await supabase
      .from("contatos")
      .select("*")
      .eq("otica_id", o.id)
      .order("created_at", { ascending: false });

    contatos = contatosData ?? [];

    carregandoPedidos = true;

    const { data: pedidosData } = await supabase
      .from("pedidos")
      .select("*")
      .eq("otica_id", o.id)
      .eq("status", "ATIVO");

    pedidos = pedidosData ?? [];
    receitaTotal = pedidos.reduce(
      (t, p) => (p.tipo === "PAGO" && p.valor ? t + p.valor : t),
      0
    );

    carregandoPedidos = false;
    carregandoDetalhes = false;
  }

  async function marcarContato() {
    if (!oticaSelecionada) return;

    salvandoContato = true;

    await supabase.from("contatos").insert({
      otica_id: oticaSelecionada.id,
      meio: "MENSAGEM",
      canal: "SISTEMA",
      status: "REALIZADO"
    });

    await carregarOticas();
    view = "lista";
    salvandoContato = false;
  }

  onMount(async () => {
  if (!browser) return;

  if (Notification.permission === "granted" && representanteId) {
    const mod = await import("react-onesignal");
    oneSignal = mod.default;

    await oneSignal.init({ appId: "5f714a7b-1f68-495e-a56d-8cbc137d8f4b" });
    await oneSignal.login(representanteId);
  }
});

</script>


<!-- TEMPLATE (HTML + CSS permanece o mesmo que você já tem) -->


<div class="wrp">
  {#if view === "lista"}
    <header class="header">
      <h1>Painel do Representante</h1>
      <button class="btn-ghost" onclick={() => goto("/")}>Sair</button>
    </header>

    {#if carregandoLista}
      <p class="state">Carregando óticas...</p>
    {:else}
      <div class="list">
        {#each oticasOriginal as o (o.id)}
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
        <strong>R$ {receitaTotal.toFixed(2)}</strong>
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
          disabled={salvandoContato}
        >
          {salvandoContato ? "Salvando..." : "CONFIRMAR CONTATO"}
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

{#if modalIdentificacaoOpen}
  <div class="modal">
    <div class="modal-card">
      <h3>Identifique-se</h3>
      <p class="muted">Selecione seu nome</p>

      <select bind:value={representanteSelecionado}>
        <option value="">Selecione</option>
        {#each representantes as r}
          <option value={r.id}>{r.nome}</option>
        {/each}
      </select>

      <button
        class="btn-primary"
        disabled={!representanteSelecionado}
        onclick={confirmarIdentidade}
      >
        Confirmar
      </button>
    </div>
  </div>
{/if}


<style>
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