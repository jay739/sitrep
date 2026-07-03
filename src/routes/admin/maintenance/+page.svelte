<script lang="ts">
	let { data, form } = $props();

	function formatTime(ts: number): string {
		return new Date(ts * 1000).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Maintenance · admin</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}
{#if form?.done}
	<p class="ok-note">{form.done}</p>
{/if}

<section>
	<h2>Schedule maintenance</h2>
	<form method="POST" action="?/create">
		<label for="m-title">Title</label>
		<input id="m-title" name="title" required maxlength="200" />

		<label for="m-body">Details (markdown, optional)</label>
		<textarea id="m-body" name="body" rows="3" maxlength="5000"></textarea>

		<label for="m-start">Starts (server timezone)</label>
		<input id="m-start" name="starts_at" type="datetime-local" required />

		<label for="m-end">Ends (server timezone)</label>
		<input id="m-end" name="ends_at" type="datetime-local" required />

		<label for="m-components">Affected components</label>
		<select id="m-components" name="components" multiple size="4">
			{#each data.components as component (component.id)}
				<option value={component.id}>{component.name}</option>
			{/each}
		</select>

		<button type="submit">Schedule</button>
	</form>
</section>

{#if data.maintenances.length > 0}
	<section>
		<h2>Windows</h2>
		<table>
			<thead>
				<tr><th>Title</th><th>Window</th><th>Components</th><th></th></tr>
			</thead>
			<tbody>
				{#each data.maintenances as maintenance (maintenance.id)}
					<tr>
						<td>{maintenance.title}</td>
						<td>{formatTime(maintenance.starts_at)} to {formatTime(maintenance.ends_at)}</td>
						<td>{maintenance.component_names ?? 'none linked'}</td>
						<td>
							<form method="POST" action="?/remove" class="inline-form">
								<input type="hidden" name="id" value={maintenance.id} />
								<button type="submit" class="danger">Delete</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/if}
