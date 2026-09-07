import { labelForState, labelForVerdict } from "../lib/ui";
import type { ListingState, Verdict } from "../lib/types";

export function StateBadge({ state, technical = false }: { state: ListingState; technical?: boolean }) {
  return <span className={`state-badge state-${state.toLowerCase()}`}><span className="state-dot" />{technical ? state : labelForState(state)}</span>;
}

export function VerdictBadge({ verdict, technical = false }: { verdict: Verdict; technical?: boolean }) {
  return <span className={`verdict-badge verdict-${verdict.toLowerCase()}`}>{technical ? verdict : labelForVerdict(verdict)}</span>;
}
