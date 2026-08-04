import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import {
  createCloudRelayAgent,
  getCloudRelayAgent,
  getCloudAgentProvisioningConfig,
} from "@/shared/api/tauriCloudAgents";
import type { RelayAgent } from "@/shared/api/types";
import type {
  CloudAgentProvisioningConfig,
  CreateCloudRelayAgentResponse,
} from "@/shared/api/cloudAgentTypes";
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
import { relayRuntimeLabel } from "./RelayAgentEditDialog";

export function RelayAgentCreateDialog({
  agentToDuplicate,
  onCreated,
  onOpenChange,
  open,
}: {
  agentToDuplicate: RelayAgent | null;
  onCreated: (agent: CreateCloudRelayAgentResponse) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [configuration, setConfiguration] =
    React.useState<CloudAgentProvisioningConfig | null>(null);
  const [name, setName] = React.useState("");
  const [runtime, setRuntime] = React.useState("");
  const [model, setModel] = React.useState("");
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setConfiguration(null);
    setName("");
    setRuntime("");
    setModel("");
    setSystemPrompt("");
    setError(null);
    setLoading(true);
    void Promise.all([
      getCloudAgentProvisioningConfig(),
      agentToDuplicate
        ? getCloudRelayAgent(agentToDuplicate.pubkey)
        : Promise.resolve(null),
    ])
      .then(([next, source]) => {
        if (cancelled) return;
        if (next.allowedRuntimes.length === 0) {
          throw new Error("This cloud host has no agent runtimes configured.");
        }
        setConfiguration(next);
        setRuntime(
          source && next.allowedRuntimes.includes(source.runtime)
            ? source.runtime
            : next.allowedRuntimes.includes(next.defaultRuntime)
              ? next.defaultRuntime
              : next.allowedRuntimes[0],
        );
        if (source) {
          setName(`${source.name} copy`);
          setModel(source.model ?? "");
          setSystemPrompt(source.systemPrompt);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to load cloud agent configuration.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentToDuplicate, open]);

  async function handleCreate() {
    if (!configuration || saving) return;
    setError(null);
    setSaving(true);
    try {
      const created = await createCloudRelayAgent({
        name,
        runtime,
        model: model.trim() || null,
        systemPrompt,
      });
      onCreated(created);
      onOpenChange(false);
      toast.success(`${created.name} is starting in the cloud.`);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to create the cloud agent.",
      );
    } finally {
      setSaving(false);
    }
  }

  const runtimeOptions = (configuration?.allowedRuntimes ?? []).map(
    (allowedRuntime) => ({
      label: relayRuntimeLabel(allowedRuntime),
      value: allowedRuntime,
    }),
  );
  const canCreate =
    Boolean(configuration) &&
    name.trim().length > 0 &&
    runtime.length > 0 &&
    systemPrompt.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto"
        data-testid="relay-agent-create-dialog"
      >
        <DialogHeader>
          <DialogTitle>
            {agentToDuplicate
              ? `Duplicate ${agentToDuplicate.name}`
              : "New cloud agent"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configure and start a new agent on this community&apos;s cloud host.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center">
            <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : configuration ? (
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="cloud-agent-name">
                Agent name
              </label>
              <Input
                autoFocus
                id="cloud-agent-name"
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                placeholder="Research"
                value={name}
              />
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="cloud-agent-instructions"
              >
                Agent instructions
              </label>
              <Textarea
                className="min-h-56 resize-y"
                id="cloud-agent-instructions"
                onChange={(event) => setSystemPrompt(event.target.value)}
                placeholder="Define the role, goals, boundaries, and expected outputs."
                value={systemPrompt}
              />
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="cloud-agent-runtime"
              >
                Runtime
              </label>
              <AgentDropdownSelect
                id="cloud-agent-runtime"
                onValueChange={setRuntime}
                options={runtimeOptions}
                value={runtime}
              />
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="cloud-agent-model"
              >
                Model
              </label>
              <Input
                id="cloud-agent-model"
                maxLength={256}
                onChange={(event) => setModel(event.target.value)}
                placeholder="Harness default"
                value={model}
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
            disabled={!canCreate || loading || saving}
            onClick={() => void handleCreate()}
            type="button"
          >
            {saving ? <LoaderCircle className="animate-spin" /> : null}
            {agentToDuplicate ? "Duplicate agent" : "Create agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
