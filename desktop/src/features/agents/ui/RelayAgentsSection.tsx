import { useUsersBatchQuery } from "@/features/profile/hooks";
import type { RelayAgent } from "@/shared/api/types";
import { normalizePubkey } from "@/shared/lib/pubkey";
import { IdentityCardSkeleton } from "@/shared/ui/identity-card-skeleton";
import { AgentIdentityCard } from "./AgentIdentityCard";

type RelayAgentCardsProps = {
  relayAgents: RelayAgent[];
  isLoading: boolean;
  /** Desktop-managed pubkeys — already rendered as persona cards, so excluded here. */
  managedPubkeys: Set<string>;
  onOpenProfile: (pubkey: string) => void;
};

/**
 * Cards for agents that live outside this desktop — headless buzz-acp
 * harnesses (e.g. Docker containers or host services) that publish a
 * kind:10100 directory entry. Rendered inside the unified agents grid via
 * UnifiedAgentsSection's extraCards slot so the whole team reads as one
 * roster; the only real difference is that these can't be started or stopped
 * from here, which the "runs elsewhere" model label conveys.
 */
export function RelayAgentCards({
  relayAgents,
  isLoading,
  managedPubkeys,
  onOpenProfile,
}: RelayAgentCardsProps) {
  const externalAgents = relayAgents.filter(
    (agent) => !managedPubkeys.has(normalizePubkey(agent.pubkey)),
  );

  const profilesQuery = useUsersBatchQuery(
    externalAgents.map((agent) => agent.pubkey),
    { enabled: externalAgents.length > 0 },
  );
  const profiles = profilesQuery.data?.profiles ?? {};

  if (isLoading && externalAgents.length === 0) {
    return (
      <IdentityCardSkeleton
        footerSubtitleWidthClass="w-14"
        footerTitleWidthClass="w-24"
      />
    );
  }

  return (
    <>
      {externalAgents.map((agent) => {
        const profile = profiles[agent.pubkey.toLowerCase()];
        const label = profile?.displayName?.trim() || agent.name || agent.pubkey;
        return (
          <AgentIdentityCard
            key={agent.pubkey}
            ariaLabel={`Open profile for ${label}`}
            avatarUrl={profile?.avatarUrl ?? null}
            dataTestId={`relay-agent-card-${agent.pubkey}`}
            label={label}
            modelLabel={agent.agentType ?? "runs elsewhere"}
            onClick={() => onOpenProfile(agent.pubkey)}
          />
        );
      })}
    </>
  );
}
