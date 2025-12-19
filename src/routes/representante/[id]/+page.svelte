<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { supabase } from "$lib/supabase";

  /* =====================
     PROPS (Svelte 5)
  ===================== */
  const props = $props<{ data: { id: string } }>();
  const representanteId = props.data.id;

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
    origem: string;
    funil_etapa: string;
    liberada: boolean;
    status: string;
    observacao: string | null;
    link_google_maps: string | null;
    representante_nome: string;
    representante_id: string;
    created_at: string;
    contato_em: string | null;
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

  /* =====================
     STATE
  ===================== */
  let view = $state<"lista" | "detalhes">("lista");
  let oticas = $state<Otica[]>([]);
  let oticaSelecionada = $state<Otica | null>(null);
  let contatos = $state<Contato[]>([]);

  let carregandoLista = $state(true);
  let carregandoDetalhes = $state(false);
  let salvandoContato = $state(false);

  /* =====================
     HELPERS
  ===================== */
  function formatData(d?: string | null) {
    return d ? new Date(d).toLocaleString("pt-BR") : "—";
  }

  function isHoje(d?: string | null) {
    if (!d) return false;
    return d.slice(0, 10) === new Date().toISOString().slice(0, 10);
  }

  /* =====================
     LISTA
  ===================== */
 async function carregarOticas() {
  carregandoLista = true;

  const [{ data: oticasData }, { data: contatosRep }] = await Promise.all([
    supabase
      .from("vw_oticas_representante_cards")
      .select("*")
      .eq("representante_id", representanteId),

    supabase
      .from("contatos")
      .select("otica_id")
      .eq("origem", "ATIVO") // contato do representante
  ]);

  const contatoMap = new Set<string>();
  (contatosRep ?? []).forEach(c => contatoMap.add(c.otica_id));

  oticas = (oticasData ?? []).map((o: Otica) => ({
    ...o,
    pode_marcar_contato: !contatoMap.has(o.id)
  }));

  carregandoLista = false;
}

  /* =====================
     DETALHES
  ===================== */
  async function abrirDetalhes(o: Otica) {
  view = "detalhes";
  oticaSelecionada = o;
  carregandoDetalhes = true;

  const hoje = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("contatos")
    .select("id,status,meio,canal,origem,observacao,created_at")
    .eq("otica_id", o.id)
    .eq("origem", "ATIVO") // 👈 somente contatos do representante
    .gte("created_at", `${hoje}T00:00:00`)
    .lte("created_at", `${hoje}T23:59:59`);

  contatos = (data ?? []) as Contato[];

  // 👇 REGRA REAL
  oticaSelecionada = {
    ...o,
    pode_marcar_contato: contatos.length === 0
  };

  carregandoDetalhes = false;
}


  function voltar() {
    view = "lista";
    oticaSelecionada = null;
  }

  /* =====================
     MARCAR CONTATO
  ===================== */
 async function marcarContato() {
  if (!oticaSelecionada?.pode_marcar_contato) return;

  salvandoContato = true;

  const { error } = await supabase.from("contatos").insert({
  otica_id: oticaSelecionada.id,

  meio: "MENSAGEM",          // permitido
  canal: "SISTEMA",          // permitido
  origem: "ATIVO",           // permitido

  status: "REALIZADO",
  conta_comissao: true,      // 🔥 OBRIGATÓRIO PELO CHECK

  observacao: "Contato único do representante"
});



  if (!error) {
    oticaSelecionada = {
      ...oticaSelecionada,
      pode_marcar_contato: false
    };

    oticas = oticas.map(o =>
      o.id === oticaSelecionada!.id
        ? { ...o, pode_marcar_contato: false }
        : o
    );
  }

  salvandoContato = false;
}


  onMount(carregarOticas);
</script>

<!-- =====================
     TEMPLATE
===================== -->
<div class="wrp">
  <header class="header">
    <h1>Painel do Representante</h1>
    <button class="btn-ghost" onclick={() => goto("/")}>← Voltar</button>
  </header>

  {#if view === "lista"}
    {#if carregandoLista}
      <p class="state">Carregando óticas...</p>
    {:else}
      <div class="list">
        {#each oticas as o (o.id)}
          <button class="card" onclick={() => abrirDetalhes(o)}>
            <div>
              <div class="title">{o.nome}</div>
              <div class="sub">{o.cidade} • {o.uf}</div>
            </div>

            <span class={o.pode_marcar_contato ? "pill warn" : "pill ok"}>
              {o.pode_marcar_contato ? "Contato pendente" : "Contato realizado"}
            </span>
          </button>
        {/each}
      </div>
    {/if}
  {/if}

  {#if view === "detalhes" && oticaSelecionada}
    <article class="details">
      <h2>{oticaSelecionada.nome}</h2>

      <div class="grid">
        <div><b>Responsável</b><span>{oticaSelecionada.responsavel}</span></div>
        <div><b>Telefone</b><span>{oticaSelecionada.telefone}</span></div>
        <div><b>Cidade / UF</b><span>{oticaSelecionada.cidade} • {oticaSelecionada.uf}</span></div>
        <div><b>Origem</b><span>{oticaSelecionada.origem}</span></div>
        <div><b>Etapa do Funil</b><span>{oticaSelecionada.funil_etapa}</span></div>
        <div><b>Status</b><span>{oticaSelecionada.status}</span></div>
        <div><b>Cadastrada em</b><span>{formatData(oticaSelecionada.created_at)}</span></div>
      </div>

      {#if oticaSelecionada.observacao}
        <div class="obs-box">
          <b>Observações da Ótica</b>
          <p>{oticaSelecionada.observacao}</p>
        </div>
      {/if}

      {#if oticaSelecionada.link_google_maps}
        <a class="map" href={oticaSelecionada.link_google_maps} target="_blank">
          📍 Abrir no Google Maps
        </a>
      {/if}

      <section class="panel">
        {#if oticaSelecionada.pode_marcar_contato}
          <button class="btn-primary" onclick={marcarContato} disabled={salvandoContato}>
            {salvandoContato ? "Salvando..." : "Confirmar contato"}
          </button>
        {:else}
          <span class="pill ok">Contato já registrado</span>
        {/if}
      </section>

      <section class="panel">
        <h3>Histórico de Contatos</h3>

        {#if contatos.length === 0}
          <p class="muted">Nenhum contato registrado ainda.</p>
        {:else}
          {#each contatos as c (c.id)}
            <div class="contact">
              <b>{c.status}</b>
              <span>{formatData(c.created_at)}</span>
              <small>{c.meio} • {c.canal}</small>
              {#if c.observacao}
                <p>{c.observacao}</p>
              {/if}
            </div>
          {/each}
        {/if}
      </section>

      <button class="btn-ghost" onclick={voltar}>← Voltar para lista</button>
    </article>
  {/if}
</div>

<style>
  :global(:root) {
    --bg: #f7f9fb;
    --card: #fff;
    --muted: #64748b;
    --accent: #0ea5a3;
    --shadow: 0 6px 20px rgba(2,6,23,.06);
  }

  .wrp { min-height:100vh; padding:24px; background:var(--bg); }
  .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }

  .list { display:grid; gap:12px; }
  .card {
    all:unset;
    background:var(--card);
    padding:16px;
    border-radius:14px;
    box-shadow:var(--shadow);
    display:flex;
    justify-content:space-between;
    cursor:pointer;
  }

  .title { font-weight:700; }
  .sub { font-size:13px; color:var(--muted); }

  .pill { padding:6px 10px; border-radius:999px; font-size:12px; font-weight:700; }
  .pill.ok { background:#e6fffa; color:#0e918c; }
  .pill.warn { background:#fff7e6; color:#b36b00; }

  .details { background:var(--card); padding:18px; border-radius:14px; box-shadow:var(--shadow); }
  .grid { display:grid; gap:10px; margin:12px 0; }
  .grid div { display:flex; flex-direction:column; font-size:14px; }

  .obs-box { margin-top:12px; background:#f0fdfa; padding:12px; border-radius:10px; }
  .panel { margin-top:18px; }

  .contact {
    background:#fff;
    border:1px solid #e6eef3;
    padding:10px;
    border-radius:10px;
    margin-bottom:8px;
    font-size:13px;
  }

  .btn-primary { background:var(--accent); color:#fff; padding:10px 14px; border:none; border-radius:10px; }
  .btn-ghost { background:#fff; padding:10px 14px; border-radius:10px; border:none; }

  .muted { color:var(--muted); font-size:13px; }
</style>
