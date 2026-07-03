<script lang="ts">
	import { COMPONENT_STATUSES, STATUS_LABELS } from '$lib/status';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Components · admin</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}
{#if form?.done}
	<p class="ok-note">{form.done}</p>
{/if}

<section>
	<h2>Add a component</h2>
	<form method="POST" action="?/create">
		<label for="new-name">Name</label>
		<input id="new-name" name="name" required maxlength="100" />
		<label for="new-desc">Description (optional)</label>
		<input id="new-desc" name="description" maxlength="300" />
		<button type="submit">Add component</button>
	</form>
</section>

{#each data.components as component (component.id)}
	<section>
		<form method="POST" action="?/update">
			<input type="hidden" name="id" value={component.id} />

			<label for="name-{component.id}">Name</label>
			<input id="name-{component.id}" name="name" value={component.name} required maxlength="100" />

			<label for="desc-{component.id}">Description</label>
			<input id="desc-{component.id}" name="description" value={component.description} maxlength="300" />

			<label for="status-{component.id}">Status (manual override, monitoring keeps updating it)</label>
			<select id="status-{component.id}" name="status">
				{#each COMPONENT_STATUSES as status (status)}
					<option value={status} selected={status === component.status}>{STATUS_LABELS[status]}</option>
				{/each}
			</select>

			<label for="order-{component.id}">Display order</label>
			<input
				id="order-{component.id}"
				name="display_order"
				type="number"
				min="0"
				max="9999"
				value={component.display_order}
			/>

			<button type="submit">Save</button>
		</form>
		<form method="POST" action="?/remove" class="inline-form">
			<input type="hidden" name="id" value={component.id} />
			<button type="submit" class="danger">Delete component and its history</button>
		</form>
	</section>
{/each}
