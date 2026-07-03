// Shared status vocabulary. Kept dependency-free so both server and client
// code can import it.
export const COMPONENT_STATUSES = [
  "operational",
  "degraded",
  "partial_outage",
  "major_outage",
  "maintenance",
] as const;

export type ComponentStatus = (typeof COMPONENT_STATUSES)[number];

export const INCIDENT_STATUSES = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const SEVERITIES = ["minor", "major", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

const SEVERITY_RANK: Record<ComponentStatus, number> = {
  operational: 0,
  maintenance: 1,
  degraded: 2,
  partial_outage: 3,
  major_outage: 4,
};

export const STATUS_LABELS: Record<ComponentStatus, string> = {
  operational: "Operational",
  degraded: "Degraded performance",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
  maintenance: "Under maintenance",
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

export function overallStatus(statuses: ComponentStatus[]): ComponentStatus {
  let worst: ComponentStatus = "operational";
  for (const status of statuses) {
    if (SEVERITY_RANK[status] > SEVERITY_RANK[worst]) worst = status;
  }
  return worst;
}

export const OVERALL_LABELS: Record<ComponentStatus, string> = {
  operational: "All systems operational",
  degraded: "Some systems degraded",
  partial_outage: "Partial system outage",
  major_outage: "Major system outage",
  maintenance: "Maintenance in progress",
};
