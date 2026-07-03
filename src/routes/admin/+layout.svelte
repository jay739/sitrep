<script lang="ts">
	import { page } from '$app/state';

	let { data, children } = $props();

	const links = [
		['/admin', 'Incidents'],
		['/admin/components', 'Components'],
		['/admin/sources', 'Sources'],
		['/admin/maintenance', 'Maintenance']
	] as const;
</script>

<div class="admin">
	{#if data.admin}
		<nav>
			<span class="brand">sitrep admin</span>
			{#each links as [href, label] (href)}
				<a href={href} class:active={page.url.pathname === href}>{label}</a>
			{/each}
			<a href="/" data-sveltekit-reload>View status page</a>
			<form method="POST" action="/admin?/logout">
				<button type="submit">Log out</button>
			</form>
		</nav>
	{/if}
	{@render children()}
</div>

<style>
	.admin {
		max-width: 860px;
		margin: 0 auto;
		padding: 1.5rem 1rem 4rem;
	}

	nav {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.brand {
		font-weight: 700;
	}

	nav a.active {
		font-weight: 600;
		text-decoration: underline;
	}

	nav form {
		margin-left: auto;
	}

	.admin :global(section) {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 1rem 1.25rem;
		margin-bottom: 1.25rem;
	}

	.admin :global(h2) {
		font-size: 1.05rem;
		margin: 0 0 0.75rem;
	}

	.admin :global(label) {
		display: block;
		font-size: 0.85rem;
		font-weight: 600;
		margin: 0.6rem 0 0.2rem;
	}

	.admin :global(input),
	.admin :global(textarea),
	.admin :global(select) {
		width: 100%;
		max-width: 28rem;
		padding: 0.45rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
		color: var(--text);
		font: inherit;
	}

	.admin :global(button) {
		margin-top: 0.75rem;
		padding: 0.45rem 1rem;
		border: none;
		border-radius: 6px;
		background: var(--accent);
		color: #fff;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.admin :global(button.danger) {
		background: var(--status-major);
	}

	.admin :global(button.subtle) {
		background: transparent;
		color: var(--text-muted);
		border: 1px solid var(--border);
	}

	.admin :global(.error) {
		color: var(--status-major);
		font-size: 0.9rem;
		margin: 0.5rem 0 0;
	}

	.admin :global(.ok-note) {
		color: var(--status-operational);
		font-size: 0.9rem;
		margin: 0.5rem 0 0;
	}

	.admin :global(table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.admin :global(th),
	.admin :global(td) {
		text-align: left;
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid var(--border);
		vertical-align: top;
	}

	.admin :global(.inline-form) {
		display: inline;
	}

	.admin :global(.inline-form button) {
		margin-top: 0;
		padding: 0.25rem 0.6rem;
		font-size: 0.8rem;
	}
</style>
