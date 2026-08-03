import { useUsersBatchQuery } from "@/features/profile/hooks";
import { useIdentityQuery } from "@/shared/api/hooks";
import type { RelayAgent } from "@/shared/api/types";
import { normalizePubkey } from "@/shared/lib/pubkey";
import { IdentityCardSkeleton } from "@/shared/ui/identity-card-skeleton";
import { SectionHeader } from "@/shared/ui/PageHeader";
import { AgentIdentityCard } from "./AgentIdentityCard";
import { RelayAgentActionsMenu } from "./RelayAgentActionsMenu";
import { AGENT_CARD_GRID_COLUMNS_CLASS } from "./UnifiedAgentsSection";

const CARD_COLUMN_CLASS = "w-full";
const CARD_GRID_CLASS = `${CARD_COLUMN_CLASS} ${AGENT_CARD_GRID_COLUMNS_CLASS} grid justify-start gap-3`;

type RelayAgentsSectionProps = {
  relayAgents: RelayAgent[];
  isLoading: boolean;
  /** Desktop-managed pubkeys — already rendered above, so excluded here. */
  managedPubkeys: Set<string>;
  onOpenProfile: (pubkey: string) => void;
  onEdit: (agent: RelayAgent) => void;
};

/**
 * Cards for agents that live outside this desktop: headless buzz-acp harnesses
 * (for example, Docker containers) that publish a kind:10100 directory entry.
 * Owners can edit hosts that advertise remote configuration support; lifecycle
 * remains controlled by the host. Clicking a card opens its profile panel.
 */
export function RelayAgentsSection({
  relayAgents,
  isLoading,
  managedPubkeys,
  onOpenProfile,
  onEdit,
}: RelayAgentsSectionProps) {
  const externalAgents = relayAgents.filter(
    (agent) => !managedPubkeys.has(normalizePubkey(agent.pubkey)),
  );

  const profilesQuery = useUsersBatchQuery(
    externalAgents.map((agent) => agent.pubkey),
    { enabled: externalAgents.length > 0 },
  );
  const profiles = profilesQuery.data?.profiles ?? {};
  const identityQuery = useIdentityQuery();
  const currentPubkey = identityQuery.data?.pubkey;

  if (!isLoading && externalAgents.length === 0) {
    return null;
  }

  return (
    <section className="relative space-y-4" data-testid="agents-relay-agents">
      <div className={CARD_COLUMN_CLASS}>
        <SectionHeader
          title="Relay agents"
          description="Agents connected to your community from outside this app."
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
            const ownerPubkey = profile?.ownerPubkey ?? agent.ownerPubkey;
            const canConfigure =
              Boolean(currentPubkey) &&
              Boolean(ownerPubkey) &&
              normalizePubkey(ownerPubkey ?? "") ===
                normalizePubkey(currentPubkey ?? "") &&
              agent.capabilities.includes("remote-config-v1");
            return (
              <AgentIdentityCard
                actions={
                  canConfigure ? (
                    <RelayAgentActionsMenu agent={agent} onEdit={onEdit} />
                  ) : null
                }
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
