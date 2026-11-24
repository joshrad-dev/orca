// Codex tokens often omit workspace_name; the saved workspace label then names the token's plan.
const PLAN_WORKSPACE_ENTRIES = [
  ['free', 'Personal (Free)', 'Free'],
  ['go', 'Personal (Go)', 'Go'],
  ['plus', 'Personal (Plus)', 'Plus'],
  ['pro', 'Personal (Pro)', 'Pro'],
  ['team', 'Team', 'Team'],
  ['business', 'Business', 'Business'],
  ['enterprise', 'Enterprise', 'Enterprise'],
  ['edu', 'Education', 'Education']
] as const

const PLAN_WORKSPACE_LABELS = new Map<string, string>(
  PLAN_WORKSPACE_ENTRIES.map(([plan, workspace]) => [plan, workspace])
)

const WORKSPACE_TO_PLAN_LABELS = new Map<string, string>(
  PLAN_WORKSPACE_ENTRIES.map(([, workspace, shortLabel]) => [workspace, shortLabel])
)

export function codexPlanWorkspaceLabel(planType: string | null | undefined): string | null {
  return (planType && PLAN_WORKSPACE_LABELS.get(planType.toLowerCase())) || null
}

/** A label that may stand for a plan rather than a workspace; a saved label cannot say which. */
export function isCodexPlanWorkspaceLabel(label: string | null | undefined): boolean {
  return WORKSPACE_TO_PLAN_LABELS.has(label?.trim() ?? '')
}

/** Extracts the short subscription label (e.g. "Plus", "Pro", "Team") when a workspace label encodes one. */
export function codexPlanLabelFromWorkspaceLabel(label: string | null | undefined): string | null {
  return (label && WORKSPACE_TO_PLAN_LABELS.get(label.trim())) || null
}
