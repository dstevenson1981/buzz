import type {
  CloudAgentProvisioningConfig,
  CreateCloudRelayAgentInput,
  CreateCloudRelayAgentResponse,
} from "@/shared/api/cloudAgentTypes";
import { invokeTauri } from "@/shared/api/tauri";

export async function getCloudAgentProvisioningConfig(): Promise<CloudAgentProvisioningConfig> {
  return invokeTauri<CloudAgentProvisioningConfig>(
    "get_cloud_agent_provisioning_config",
  );
}

export async function createCloudRelayAgent(
  input: CreateCloudRelayAgentInput,
): Promise<CreateCloudRelayAgentResponse> {
  return invokeTauri<CreateCloudRelayAgentResponse>(
    "create_cloud_relay_agent",
    { input },
  );
}
