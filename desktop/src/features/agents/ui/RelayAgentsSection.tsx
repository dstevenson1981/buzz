import { useUsersBatchQuery } from "@/features/profile/hooks";
import type { RelayAgent } from "@/shared/api/types";
import { normalizePubkey } from "@/shared/lib/pubkey";
import { IdentityCardSkeleton } from "@/shared/ui/identity-card-skeleton";
import { SectionHeader } from "@/shared/ui/PageHeader";
import { AgentIdentityCard } from "./AgentIdentityCard";
import { AGENT_CARD_GRID_COLUMNS_CLASS } from "./UnifiedAgentsSection";

const CARD_COLUMN_CLASS = "w-full";
const CARD_GRID_CLASS = `${CARD_COLUMN_CLASS} ${AGENT_CARD_GRID_COLUMNS_CLASS} grid justify-start gap-3`;

type RelayAgentsSectionProps = {
  relayAgents: RelayAgent[];
  isLoading: boolean;
  /** Desktop-managed pubkeys — already rendered above, so excluded here. */
  managedPubkeys: Set<string>;
  onOpenProfile: (pubkey: string) => void;
};

/**
 * Read-only cards for agents that live outside this desktop — headless
 * buzz-acp harnesses (e.g. Docker containers) that publish a kind:10100
 * directory entry. They can't be started or stopped from here; their runtime
 * belongs to wherever they're hosted. Clicking a card opens the profile
 * panel, which the surrounding AgentsScreen already renders.
 */
export function RelayAgentsSection({
  relayAgents,
  isLoading,
  managedPubkeys,
  onOpenProfile,
}: RelayAgentsSectionProps) {
  const externalAgents = relayAgents.filter(
    (agent) => !managedPubkeys.has(normalizePubkey(agent.pubkey)),
  );

  const profilesQuery = useUsersBatchQuery(
    externalAgents.map((agent) => agent.pubkey),
    { enabled: externalAgents.length > 0 },
  );
  const profiles = profilesQuery.data?.profiles ?? {};

  if (!isLoading && externalAgents.length === 0) {
    return null;
  }

  return (
    <section className="relative space-y-4" data-testid="agents-relay-agents">
      <div className={CARD_COLUMN_CLASS}>
        <SectionHeader
          title="Relay agents"
          description="Agents connected to your community from outside this app. Managed where they run."
        />
      </div>

      {isLoading && externalAgents.length === 0 ? (
        <div className={CARD_GRID_CLASS}>
          <IdentityCardSkeleton
            footerSubtitleWidthClass="w-14"
            footerTitleWidthClass="w-24"
          />
        </div>
      ) : (
        <div className={CARD_GRID_CLASS}>
          {externalAgents.map((agent) => {
            const profile = profiles[agent.pubkey.toLowerCase()];
            const label =
              profile?.displayName?.trim() || agent.name || agent.pubkey;
            return (
              <AgentIdentityCard
                key={agent.pubkey}
                ariaLabel={`Open profile for ${label}`}
                avatarUrl={profile?.avatarUrl ?? null}
                dataTestId={`relay-agent-card-${agent.pubkey}`}
                label={label}
                modelLabel={agent.agentType}
                onClick={() => onOpenProfile(agent.pubkey)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
