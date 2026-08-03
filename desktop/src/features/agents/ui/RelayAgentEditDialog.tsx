import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import {
  getRelayAgentConfiguration,
  updateRelayAgentConfiguration,
} from "@/features/agents/relayAgentControl";
import type { RelayAgent, RelayAgentConfiguration } from "@/shared/api/types";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { AgentDropdownSelect } from "./agentConfigControls";

export function relayRuntimeLabel(runtime: string): string {
  switch (runtime.trim().toLowerCase()) {
    case "claude-agent-acp":
    case "claude-code-acp":
    case "claude-code":
      return "Claude Code";
    case "codex-acp":
    case "codex":
      return "Codex";
    case "goose":
      return "Goose";
    default:
      return runtime;
  }
}

export function RelayAgentEditDialog({
  agent,
  onOpenChange,
  onSaved,
  open,
}: {
  agent: RelayAgent | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  open: boolean;
}) {
  const [configuration, setConfiguration] =
    React.useState<RelayAgentConfiguration | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open || !agent) return;
    let cancelled = false;
    setConfiguration(null);
    setError(null);
    setLoading(true);
    void getRelayAgentConfiguration(agent.pubkey)
      .then((next) => {
        if (!cancelled) setConfiguration(next);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to load the relay agent configuration.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agent, open]);

  async function handleSave() {
    if (!agent || !configuration || saving) return;
    setError(null);
    setSaving(true);
    try {
      const result = await updateRelayAgentConfiguration(agent.pubkey, {
        runtime: configuration.runtime,
        systemPrompt: configuration.systemPrompt,
        model: configuration.model?.trim() || null,
      });
      onOpenChange(false);
      onSaved();
      toast.success(
        result.restartRequired
          ? `${agent.name} saved and is restarting.`
          : `${agent.name} is up to date.`,
      );
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to update the relay agent.",
      );
    } finally {
      setSaving(false);
    }
  }

  const runtimeOptions = (configuration?.allowedRuntimes ?? []).map(
    (runtime) => ({
      label: relayRuntimeLabel(runtime),
      value: runtime,
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto"
        data-testid="relay-agent-edit-dialog"
      >
        <DialogHeader>
          <DialogTitle>Edit {agent?.name ?? "relay agent"}</DialogTitle>
          <DialogDescription className="sr-only">
            Edit this relay agent&apos;s runtime, model, and instructions.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center">
            <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : configuration ? (
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="relay-agent-runtime"
              >
                Runtime
              </label>
              <AgentDropdownSelect
                id="relay-agent-runtime"
                onValueChange={(runtime) =>
                  setConfiguration((current) =>
                    current ? { ...current, runtime } : current,
                  )
                }
                options={runtimeOptions}
                value={configuration.runtime}
              />
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="relay-agent-model"
              >
                Model
              </label>
              <Input
                id="relay-agent-model"
                onChange={(event) =>
                  setConfiguration((current) =>
                    current
                      ? { ...current, model: event.target.value }
                      : current,
                  )
                }
                placeholder="Harness default"
                value={configuration.model ?? ""}
              />
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="relay-agent-instructions"
              >
                Agent instructions
              </label>
              <Textarea
                className="min-h-64 resize-y"
                id="relay-agent-instructions"
                onChange={(event) =>
                  setConfiguration((current) =>
                    current
                      ? { ...current, systemPrompt: event.target.value }
                      : current,
                  )
                }
                value={configuration.systemPrompt}
              />
            </div>
          </div>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button
            disabled={saving}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={!configuration || loading || saving}
            onClick={() => void handleSave()}
            type="button"
          >
            {saving ? <LoaderCircle className="animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
