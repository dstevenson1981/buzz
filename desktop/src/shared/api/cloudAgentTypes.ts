export type CloudAgentProvisioningConfig = {
  allowedRuntimes: string[];
  defaultRuntime: string;
};

export type CreateCloudRelayAgentInput = {
  name: string;
  runtime: string;
  model?: string | null;
  systemPrompt: string;
};

export type CreateCloudRelayAgentResponse = {
  pubkey: string;
  name: string;
  status: string;
};

export type CloudRelayAgentConfiguration = {
  pubkey: string;
  name: string;
  runtime: string;
  model: string | null;
  systemPrompt: string;
  allowedRuntimes: string[];
  status: "running" | "stopped";
};

export type UpdateCloudRelayAgentInput = Pick<
  CloudRelayAgentConfiguration,
  "name" | "runtime" | "model" | "systemPrompt"
>;

export type CloudAgentSnapshotInput = UpdateCloudRelayAgentInput & {
  avatarUrl?: string | null;
};

export type CloudAgentSnapshotPayload = {
  fileBytes: number[];
  fileName: string;
};

export type DeleteCloudRelayAgentResponse = {
  pubkey: string;
  status: "deleted";
};
