<script lang="ts">
	import { INCIDENT_STATUS_LABELS, INCIDENT_STATUSES, SEVERITIES } from '$lib/status';

	let { data, form } = $props();

	function formatTime(ts: number): string {
		return new Date(ts * 1000).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	const active = $derived(data.incidents.filter((i) => i.status !== 'resolved'));
	const resolved = $derived(data.incidents.filter((i) => i.status === 'resolved'));
</script>

<svelte:head>
	<title>Incidents · admin</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}
{#if form?.done}
	<p class="ok-note">{form.done}</p>
{/if}

<section>
	<h2>Open an incident</h2>
	<form method="POST" action="?/create">
		<label for="title">Title</label>
		<input id="title" name="title" required maxlength="200" />

		<label for="severity">Severity</label>
		<select id="severity" name="severity">
			{#each SEVERITIES as severity (severity)}
				<option value={severity}>{severity}</option>
			{/each}
		</select>

		<label for="components">Affected components (hold Ctrl or Cmd for several)</label>
		<select id="components" name="components" multiple size="4">
			{#each data.components as component (component.id)}
				<option value={component.id}>{component.name}</option>
			{/each}
		</select>

		<label for="body">Initial update (markdown: bold, italics, lists, links)</label>
		<textarea id="body" name="body" rows="4" required maxlength="5000"></textarea>

		<button type="submit">Open incident</button>
	</form>
</section>

{#each active as incident (incident.id)}
	<section>
		<h2>{incident.title}</h2>
		<p class="meta-line">
			{incident.severity} · {INCIDENT_STATUS_LABELS[incident.status as keyof typeof INCIDENT_STATUS_LABELS] ?? incident.status}
			· started {formatTime(incident.created_at)}
		</p>
		<form method="POST" action="?/update">
			<input type="hidden" name="incidentId" value={incident.id} />

			<label for="status-{incident.id}">New status</label>
			<select id="status-{incident.id}" name="status">
				{#each INCIDENT_STATUSES as status (status)}
					<option value={status} selected={status === incident.status}>
						{INCIDENT_STATUS_LABELS[status]}
					</option>
				{/each}
			</select>

			<label for="update-{incident.id}">Update text</label>
			<textarea id="update-{incident.id}" name="body" rows="3" required maxlength="5000"></textarea>

			<label for="postmortem-{incident.id}">Post-mortem (optional, saved when resolving)</label>
			<textarea id="postmortem-{incident.id}" name="postmortem" rows="3" maxlength="20000"></textarea>

			<button type="submit">Post update</button>
		</form>
	</section>
{/each}

{#if resolved.length > 0}
	<section>
		<h2>Resolved</h2>
		<table>
			<thead>
				<tr><th>Title</th><th>Severity</th><th>Resolved</th><th></th></tr>
			</thead>
			<tbody>
				{#each resolved as incident (incident.id)}
					<tr>
						<td>{incident.title}</td>
						<td>{incident.severity}</td>
						<td>{incident.resolved_at ? formatTime(incident.resolved_at) : ''}</td>
						<td>
							<form method="POST" action="?/remove" class="inline-form">
								<input type="hidden" name="id" value={incident.id} />
								<button type="submit" class="danger">Delete</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/if}

<style>
	.meta-line {
		color: var(--text-muted);
		font-size: 0.85rem;
		margin: 0 0 0.5rem;
	}
</style>
