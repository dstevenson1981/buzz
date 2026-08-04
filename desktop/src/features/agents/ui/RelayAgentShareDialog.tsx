import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import type { CloudRelayAgentConfiguration } from "@/shared/api/cloudAgentTypes";
import {
  encodeCloudAgentSnapshotForSend,
  exportCloudAgentSnapshot,
  getCloudRelayAgent,
} from "@/shared/api/tauriCloudAgents";
import type { RelayAgent } from "@/shared/api/types";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { SnapshotShareDialog } from "./PersonaShareDialog";

export function RelayAgentShareDialog({
  agent,
  onOpenChange,
  open,
}: {
  agent: RelayAgent | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [configuration, setConfiguration] =
    React.useState<CloudRelayAgentConfiguration | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !agent) return;
    let cancelled = false;
    setConfiguration(null);
    setError(null);
    void getCloudRelayAgent(agent.pubkey)
      .then((next) => {
        if (!cancelled) setConfiguration(next);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to prepare this agent for sharing.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [agent, open]);

  if (!configuration) {
    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent data-testid="relay-agent-share-loading-dialog">
          <DialogHeader>
            <DialogTitle>Share {agent?.name ?? "cloud agent"}</DialogTitle>
            <DialogDescription className="sr-only">
              Prepare a reusable agent snapshot without cloud credentials.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <div className="flex min-h-40 items-center justify-center">
              <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  const snapshotInput = {
    name: configuration.name,
    runtime: configuration.runtime,
    model: configuration.model,
    systemPrompt: configuration.systemPrompt,
    avatarUrl: null,
  };

  return (
    <SnapshotShareDialog
      displayName={configuration.name}
      encodeSnapshot={() => encodeCloudAgentSnapshotForSend(snapshotInput)}
      hasMemoryOptions={false}
      isPending={false}
      onExport={() => {
        void exportCloudAgentSnapshot(snapshotInput)
          .then((saved) => {
            if (saved) toast.success(`Exported ${configuration.name}`);
          })
          .catch(() => toast.error("Failed to export the agent."));
      }}
      onOpenChange={onOpenChange}
      open={open}
      snapshotKind="agent"
      testIdPrefix="relay-agent-share"
    />
  );
}
