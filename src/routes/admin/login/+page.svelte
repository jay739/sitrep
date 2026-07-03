<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head>
	<title>Admin login</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
	<h1>Admin login</h1>
	{#if !data.configured}
		<p class="error">
			ADMIN_PASSWORD is not set on the server, so the admin area is disabled. Set it and restart.
		</p>
	{:else}
		<form method="POST">
			<label for="password">Password</label>
			<input id="password" name="password" type="password" autocomplete="current-password" required />
			{#if form?.error}
				<p class="error">{form.error}</p>
			{/if}
			<button type="submit">Log in</button>
		</form>
	{/if}
</main>

<style>
	main {
		max-width: 24rem;
		margin: 4rem auto;
	}

	h1 {
		font-size: 1.2rem;
	}

	input {
		width: 100%;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
	}

	label {
		display: block;
		font-size: 0.85rem;
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	button {
		margin-top: 0.9rem;
		padding: 0.5rem 1.2rem;
		border: none;
		border-radius: 6px;
		background: var(--accent);
		color: #fff;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.error {
		color: var(--status-major);
		font-size: 0.9rem;
	}
</style>
