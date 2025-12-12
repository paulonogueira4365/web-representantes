<script lang="ts">
	import "../app.css"; // mantém compatibilidade (mesmo sem Tailwind)
	import favicon from "$lib/assets/favicon.svg";

	let { children } = $props();
</script>

<svelte:head>
	<!-- Ícone -->
	<link rel="icon" href={favicon} />

	<!-- Meta padrão -->
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="theme-color" content="#0ea5a3" />

	<!-- SEO básico -->
	<title>UPLAB • Representantes</title>
	<meta name="description" content="Painel exclusivo dos representantes UPLAB" />
</svelte:head>

<div class="layout-root">
	{@render children()}
</div>

<style>
	/* ============================================
	   VARIÁVEIS DO TEMA WHITE PRO
	   ============================================ */
	:global(:root) {
		--bg: #f7f9fb;
		--card: #ffffff;
		--text: #0f172a;
		--muted: #64748b;
		--accent: #0ea5a3;
		--radius: 14px;
		--shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
	}

	/* ============================================
	   LAYOUT BASE
	   ============================================ */
	.layout-root {
		min-height: 100vh;
		background: var(--bg);
		color: var(--text);
		font-family: Inter, system-ui, sans-serif;
		padding-bottom: 40px;
		animation: fadeIn 0.3s ease-out;
	}

	/* ============================================
	   ANIMAÇÕES
	   ============================================ */
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* ============================================
	   SCROLLBAR PREMIUM
	   ============================================ */
	:global(::-webkit-scrollbar) {
		width: 8px;
	}
	:global(::-webkit-scrollbar-track) {
		background: transparent;
	}
	:global(::-webkit-scrollbar-thumb) {
		background: #d7dee7;
		border-radius: 999px;
	}
</style>
