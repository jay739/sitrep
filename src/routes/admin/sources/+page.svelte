<script lang="ts">
	import { page } from '$app/state';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Sources · admin</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}
{#if form?.done}
	<p class="ok-note">{form.done}</p>
{/if}

<section>
	<h2>Add an ingest source</h2>
	<p class="hint">
		Each source gets its own secret webhook URL. In Uptime Kuma, add a Webhook notification
		with that URL, content type application/json, and attach it to your monitors.
	</p>
	<form method="POST" action="?/create">
		<label for="src-name">Name</label>
		<input id="src-name" name="name" required maxlength="100" placeholder="e.g. Homelab Kuma" />
		<label for="src-kind">Kind</label>
		<select id="src-kind" name="kind">
			<option value="kuma">Uptime Kuma</option>
		</select>
		<button type="submit">Create source</button>
	</form>
</section>

{#each data.sources as source (source.id)}
	<section>
		<h2>{source.name}</h2>
		<p class="hint">
			{source.kind} · {source.bound} bound monitor{source.bound === 1 ? '' : 's'} ·
			auto-create components: {source.auto_create ? 'on' : 'off'}
		</p>
		<label for="url-{source.id}">Webhook URL (secret, treat like a password)</label>
		<input
			id="url-{source.id}"
			readonly
			value="{page.url.origin}/api/ingest/{source.kind}/{source.token}"
			onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
		/>
		<form method="POST" action="?/toggleAuto" class="inline-form">
			<input type="hidden" name="id" value={source.id} />
			<button type="submit" class="subtle">
				Turn auto-create {source.auto_create ? 'off' : 'on'}
			</button>
		</form>
		<form method="POST" action="?/remove" class="inline-form">
			<input type="hidden" name="id" value={source.id} />
			<button type="submit" class="danger">Delete source</button>
		</form>
	</section>
{/each}

<style>
	.hint {
		color: var(--text-muted);
		font-size: 0.85rem;
		margin: 0 0 0.5rem;
	}
</style>
