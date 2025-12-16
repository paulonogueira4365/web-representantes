<script lang="ts">
	import "../app.css";
	import favicon from "$lib/assets/favicon.svg";

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />

	<meta
		name="viewport"
		content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
	/>
	<meta name="theme-color" content="#0ea5a3" />

	<title>UPLAB • Representantes</title>
	<meta
		name="description"
		content="Painel exclusivo dos representantes UPLAB"
	/>
</svelte:head>

<div class="layout-root">
	{@render children()}
</div>

<style>
/* =========================
   GLOBAL (CORRETO SVELTE 5)
========================= */
:global(html),
:global(body) {
	margin: 0;
	padding: 0;
	background: var(--bg);
	color: var(--text);
	font-family: Inter, system-ui, -apple-system;
}

/* =========================
   VARIÁVEIS
========================= */
:global(:root) {
	--bg: #f7f9fb;
	--card: #ffffff;
	--text: #0f172a;
	--muted: #64748b;
	--accent: #0ea5a3;

	--radius: 14px;
	--radius-lg: 18px;

	--shadow-sm: 0 2px 6px rgba(0, 0, 0, 0.04);
	--shadow: 0 6px 20px rgba(2, 6, 23, 0.08);
}

/* =========================
   BASE
========================= */
* {
	box-sizing: border-box;
	-webkit-tap-highlight-color: transparent;
}

.layout-root {
	min-height: 100vh;
	background: var(--bg);
	padding-bottom: 32px;
}

/* =========================
   UTILITÁRIOS
========================= */
:global(.muted) {
	color: var(--muted);
}

:global(.btn-primary) {
	all: unset;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 14px 16px;
	border-radius: var(--radius);
	background: linear-gradient(180deg, #0fb7b1, #0ea5a3);
	color: #ffffff;
	font-weight: 700;
	cursor: pointer;
	box-shadow: var(--shadow);
}

:global(.btn-primary:active) {
	transform: scale(0.97);
}

:global(.btn-ghost) {
	all: unset;
	color: var(--accent);
	font-weight: 600;
	cursor: pointer;
}
</style>
