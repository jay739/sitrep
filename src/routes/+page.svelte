<script lang="ts">
	import {
		STATUS_LABELS,
		OVERALL_LABELS,
		INCIDENT_STATUS_LABELS,
		type ComponentStatus
	} from '$lib/status';

	let { data } = $props();

	const statusClass: Record<ComponentStatus, string> = {
		operational: 'ok',
		degraded: 'warn',
		partial_outage: 'partial',
		major_outage: 'major',
		maintenance: 'maint'
	};

	function formatTime(ts: number): string {
		return new Date(ts * 1000).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			timeZoneName: 'short'
		});
	}

	function uptimeSummary(days: Array<{ uptime: number | null }>): string {
		const known = days.filter((d) => d.uptime !== null) as Array<{ uptime: number }>;
		if (known.length === 0) return 'no data yet';
		const avg = known.reduce((sum, d) => sum + d.uptime, 0) / known.length;
		return `${(avg * 100).toFixed(2)}% uptime`;
	}
</script>

<svelte:head>
	<title>{data.siteName}</title>
	<meta http-equiv="refresh" content="60" />
	<link rel="alternate" type="application/rss+xml" title="{data.siteName} incidents" href="/feed.xml" />
</svelte:head>

<main>
	<header>
		<h1>{data.siteName}</h1>
		<a class="rss" href="/feed.xml">RSS</a>
	</header>

	{#if !data.ok}
		<section class="banner major" aria-live="polite">
			<h2>Status information is temporarily unavailable</h2>
			<p>This page could not load its data. It refreshes automatically every minute.</p>
		</section>
	{:else}
		<section class="banner {statusClass[data.overall]}" aria-live="polite">
			<h2>{OVERALL_LABELS[data.overall]}</h2>
		</section>

		{#if data.activeIncidents.length > 0}
			<section aria-label="Active incidents">
				{#each data.activeIncidents as incident (incident.id)}
					<article class="incident sev-{incident.severity}">
						<h3>{incident.title}</h3>
						<p class="meta">
							{incident.severity} · started {formatTime(incident.created_at)}
						</p>
						<ol class="updates">
							{#each data.updatesByIncident[incident.id] ?? [] as update}
								<li>
									<span class="update-status">{INCIDENT_STATUS_LABELS[update.status]}</span>
									<span class="update-time">{formatTime(update.created_at)}</span>
									<!-- html rendered by the server-side escaping markdown renderer -->
									<div class="update-body">{@html update.html}</div>
								</li>
							{/each}
						</ol>
					</article>
				{/each}
			</section>
		{/if}

		{#if data.maintenances.length > 0}
			<section aria-label="Scheduled maintenance">
				{#each data.maintenances as maintenance (maintenance.id)}
					<article class="incident maint-card">
						<h3>{maintenance.title}</h3>
						<p class="meta">
							{formatTime(maintenance.starts_at)} to {formatTime(maintenance.ends_at)}
						</p>
						<div class="update-body">{@html maintenance.html}</div>
					</article>
				{/each}
			</section>
		{/if}

		<section aria-label="Components">
			{#if data.components.length === 0}
				<article class="empty">
					<h3>No components yet</h3>
					<p>
						Point an Uptime Kuma webhook at this page's ingest URL, or add components in the
						admin area, and they will appear here.
					</p>
				</article>
			{:else}
				<ul class="components">
					{#each data.components as component (component.id)}
						{@const days = data.uptimeByComponent[component.id] ?? []}
						<li>
							<div class="component-row">
								<span class="dot {statusClass[component.status]}" aria-hidden="true"></span>
								<span class="component-name">{component.name}</span>
								<span class="component-status {statusClass[component.status]}">
									{STATUS_LABELS[component.status]}
								</span>
							</div>
							{#if component.description}
								<p class="component-desc">{component.description}</p>
							{/if}
							<div
								class="uptime-bars"
								role="img"
								aria-label="{data.uptimeDays}-day uptime history, {uptimeSummary(days)}"
							>
								{#each days as day (day.day)}
									<span
										class="bar"
										class:up={day.uptime !== null && day.uptime >= 0.999}
										class:partial={day.uptime !== null && day.uptime < 0.999 && day.uptime >= 0.9}
										class:down={day.uptime !== null && day.uptime < 0.9}
										title="{day.day}: {day.uptime === null
											? 'no data'
											: `${(day.uptime * 100).toFixed(2)}%`}"
									></span>
								{/each}
							</div>
							<p class="uptime-summary">{data.uptimeDays} days · {uptimeSummary(days)}</p>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		{#if data.recentResolved.length > 0}
			<section aria-label="Past incidents">
				<h2 class="section-title">Past incidents</h2>
				{#each data.recentResolved as incident (incident.id)}
					<article class="incident resolved">
						<h3>{incident.title}</h3>
						<p class="meta">
							{incident.severity} · resolved {incident.resolved_at
								? formatTime(incident.resolved_at)
								: ''}
						</p>
					</article>
				{/each}
			</section>
		{/if}

		<footer>
			<p>Updated {formatTime(data.generatedAt)} · refreshes every minute</p>
		</footer>
	{/if}
</main>

<style>
	main {
		max-width: 720px;
		margin: 0 auto;
		padding: 2rem 1rem 4rem;
	}

	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 1.5rem;
	}

	header h1 {
		font-size: 1.25rem;
		margin: 0;
	}

	.rss {
		font-size: 0.8rem;
		color: var(--text-faint);
	}

	/* Tinted card with ink text instead of white-on-saturated-color: the
	   status hue rides the wash, dot, and left border while the words stay
	   readable in both themes (white on the warning yellow fails contrast). */
	.banner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		border-left-width: 4px;
		padding: 1rem 1.25rem;
		margin-bottom: 1.5rem;
	}

	.banner h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.banner p {
		margin: 0.5rem 0 0;
		color: var(--text-muted);
	}

	.banner::before {
		content: '';
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.banner.ok {
		background: color-mix(in srgb, var(--status-operational) 10%, var(--surface));
		border-left-color: var(--status-operational);
	}
	.banner.ok::before {
		background: var(--status-operational);
	}
	.banner.warn {
		background: color-mix(in srgb, var(--status-degraded) 12%, var(--surface));
		border-left-color: var(--status-degraded);
	}
	.banner.warn::before {
		background: var(--status-degraded);
	}
	.banner.partial {
		background: color-mix(in srgb, var(--status-partial) 12%, var(--surface));
		border-left-color: var(--status-partial);
	}
	.banner.partial::before {
		background: var(--status-partial);
	}
	.banner.major {
		background: color-mix(in srgb, var(--status-major) 10%, var(--surface));
		border-left-color: var(--status-major);
	}
	.banner.major::before {
		background: var(--status-major);
	}
	.banner.maint {
		background: color-mix(in srgb, var(--status-maintenance) 10%, var(--surface));
		border-left-color: var(--status-maintenance);
	}
	.banner.maint::before {
		background: var(--status-maintenance);
	}

	.incident {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 1rem 1.25rem;
		margin-bottom: 1rem;
	}

	.incident h3 {
		margin: 0;
		font-size: 1rem;
	}

	.meta {
		color: var(--text-muted);
		font-size: 0.85rem;
		margin: 0.25rem 0 0;
	}

	.updates {
		list-style: none;
		margin: 0.75rem 0 0;
		padding: 0;
	}

	.updates li {
		border-top: 1px solid var(--border);
		padding: 0.6rem 0;
	}

	.update-status {
		font-weight: 600;
		font-size: 0.85rem;
	}

	.update-time {
		color: var(--text-muted);
		font-size: 0.8rem;
		margin-left: 0.5rem;
	}

	.update-body :global(p) {
		margin: 0.35rem 0 0;
		font-size: 0.92rem;
	}

	.update-body :global(ul) {
		margin: 0.35rem 0 0;
		padding-left: 1.25rem;
		font-size: 0.92rem;
	}

	.components {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.components li {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.9rem 1.25rem;
		margin-bottom: 0.6rem;
	}

	.component-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.component-name {
		font-weight: 600;
		flex: 1;
	}

	.component-desc {
		color: var(--text-muted);
		font-size: 0.85rem;
		margin: 0.15rem 0 0 1.35rem;
	}

	/* Text wears ink tokens; the dot beside it carries the status color, so
	   meaning never rides on a sub-3:1 color alone. */
	.component-status {
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.dot {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.dot.ok {
		background: var(--status-operational);
	}
	.dot.warn {
		background: var(--status-degraded);
	}
	.dot.partial {
		background: var(--status-partial);
	}
	.dot.major {
		background: var(--status-major);
	}
	.dot.maint {
		background: var(--status-maintenance);
	}

	.uptime-bars {
		display: flex;
		gap: 2px;
		margin-top: 0.6rem;
		height: 2rem;
		align-items: stretch;
	}

	.bar {
		flex: 1;
		border-radius: 2px;
		background: var(--status-nodata);
		min-width: 2px;
	}

	.bar:hover {
		outline: 2px solid var(--ring);
		outline-offset: 1px;
	}

	.bar.up {
		background: var(--status-operational);
	}

	.bar.partial {
		background: var(--status-degraded);
	}

	.bar.down {
		background: var(--status-major);
	}

	.uptime-summary {
		color: var(--text-faint);
		font-size: 0.78rem;
		margin: 0.35rem 0 0;
		font-variant-numeric: tabular-nums;
	}

	.section-title {
		font-size: 1rem;
		margin: 2rem 0 0.75rem;
	}

	.empty {
		background: var(--surface);
		border: 1px dashed var(--border);
		border-radius: var(--radius);
		padding: 1.5rem;
		text-align: center;
		color: var(--text-muted);
	}

	.empty h3 {
		margin: 0 0 0.5rem;
		color: var(--text);
	}

	footer {
		margin-top: 2.5rem;
		text-align: center;
		color: var(--text-muted);
		font-size: 0.8rem;
	}
</style>
