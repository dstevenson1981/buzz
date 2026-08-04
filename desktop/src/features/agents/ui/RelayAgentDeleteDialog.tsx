import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { deleteCloudRelayAgent } from "@/shared/api/tauriCloudAgents";
import type { RelayAgent } from "@/shared/api/types";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";

export function RelayAgentDeleteDialog({
  agent,
  onDeleted,
  onOpenChange,
  open,
}: {
  agent: RelayAgent | null;
  onDeleted: (pubkey: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function handleDelete() {
    if (!agent || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCloudRelayAgent(agent.pubkey);
      onDeleted(agent.pubkey);
      onOpenChange(false);
      toast.success(`${agent.name} was deleted.`);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to delete the cloud agent.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent data-testid="relay-agent-delete-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete cloud agent?</AlertDialogTitle>
          <AlertDialogDescription>
            Delete {agent?.name ?? "this agent"}, its cloud runtime, and its
            stored home volume. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <Button
            disabled={deleting}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={!agent || deleting}
            onClick={() => void handleDelete()}
            type="button"
            variant="destructive"
          >
            {deleting ? <LoaderCircle className="animate-spin" /> : null}
            Delete agent
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
