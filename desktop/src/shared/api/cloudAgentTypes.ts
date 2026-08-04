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
