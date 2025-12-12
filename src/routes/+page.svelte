<script lang="ts">
	import { supabase } from "$lib/supabase";
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";

	type Representante = {
		id: string;
		nome: string;
	};

	let representantes: Representante[] = [];
	let carregando = true;
	let erro: string | null = null;

	async function carregarRepresentantes() {
		carregando = true;
		erro = null;

		try {
			const { data, error } = await supabase
				.from("representantes")
				.select("id, nome")
				.order("nome", { ascending: true });

			if (error) {
				console.error(error);
				erro = error.message;
				representantes = [];
			} else {
				representantes = data ?? [];
			}
		} catch (e) {
			console.error(e);
			erro = "Erro inesperado";
			representantes = [];
		}

		carregando = false;
	}

	onMount(() => {
		carregarRepresentantes();
	});

	function abrirPainel(id: string) {
		goto(`/representante/${id}`);
	}

	function handleKey(ev: KeyboardEvent, id: string) {
		if (ev.key === "Enter" || ev.key === " ") {
			ev.preventDefault();
			abrirPainel(id);
		}
	}
</script>

<div class="root">
	<div class="logo-wrap">
		<img src="/uplab-logo.jpg" alt="UPLAB" class="logo" />
	</div>

	<h1 class="title">Portal UPLAB</h1>
	<p class="subtitle">Acesse seu painel de representante</p>

	{#if carregando}
		<div class="state">Carregando representantes...</div>
	{:else if erro}
		<div class="state error">Erro: {erro}</div>
	{:else}
		<div class="list">
			{#each representantes as rep (rep.id)}
				<div
					class="card"
					role="button"
					tabindex="0"
					on:click={() => abrirPainel(rep.id)}
					on:keydown={(e) => handleKey(e, rep.id)}
				>
					<span class="name">{rep.nome}</span>
					<span class="caret">›</span>
				</div>
			{/each}

			{#if representantes.length === 0}
				<div class="state">Nenhum representante encontrado.</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	:global(:root) {
		--bg: #f7f9fb;
		--card: #ffffff;
		--muted: #64748b;
		--accent: #0ea5a3;
		--radius: 12px;
		--shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
	}

	.root {
		min-height: 100vh;
		padding: 40px 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
		background: var(--bg);
		font-family: Inter, sans-serif;
	}

	.logo-wrap {
		background: var(--card);
		padding: 16px;
		border-radius: var(--radius);
		border: 1px solid #e2e8f0;
		box-shadow: var(--shadow);
		margin-bottom: 14px;
	}

	.logo {
		width: 70px;
	}

	.title {
		margin: 10px 0 4px;
		font-size: 28px;
		font-weight: 700;
		color: #0f172a;
	}

	.subtitle {
		color: var(--muted);
		font-size: 15px;
		margin-bottom: 24px;
	}

	.state {
		color: var(--muted);
		margin-top: 18px;
		font-size: 15px;
	}

	.state.error {
		color: #c62828;
	}

	.list {
		width: 100%;
		max-width: 450px;
		display: grid;
		gap: 12px;
	}

	.card {
		background: var(--card);
		border: 1px solid #e2e8f0;
		padding: 16px 18px;
		border-radius: var(--radius);
		display: flex;
		justify-content: space-between;
		align-items: center;
		box-shadow: var(--shadow);
		cursor: pointer;
		transition: 0.15s;
	}

	.card:hover {
		transform: translateY(-3px);
	}

	.name {
		font-size: 18px;
		font-weight: 600;
		color: #0f172a;
	}

	.caret {
		font-size: 22px;
		color: var(--muted);
	}
</style>
