import type {
  CloudAgentSnapshotInput,
  CloudAgentSnapshotPayload,
  CloudAgentProvisioningConfig,
  CloudRelayAgentConfiguration,
  CreateCloudRelayAgentInput,
  CreateCloudRelayAgentResponse,
  DeleteCloudRelayAgentResponse,
  UpdateCloudRelayAgentInput,
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

export async function getCloudRelayAgent(
  pubkey: string,
): Promise<CloudRelayAgentConfiguration> {
  return invokeTauri<CloudRelayAgentConfiguration>("get_cloud_relay_agent", {
    pubkey,
  });
}

export async function updateCloudRelayAgent(
  pubkey: string,
  input: UpdateCloudRelayAgentInput,
): Promise<CloudRelayAgentConfiguration> {
  return invokeTauri<CloudRelayAgentConfiguration>("update_cloud_relay_agent", {
    pubkey,
    input,
  });
}

export async function deleteCloudRelayAgent(
  pubkey: string,
): Promise<DeleteCloudRelayAgentResponse> {
  return invokeTauri<DeleteCloudRelayAgentResponse>(
    "delete_cloud_relay_agent",
    {
      pubkey,
    },
  );
}

export async function encodeCloudAgentSnapshotForSend(
  input: CloudAgentSnapshotInput,
): Promise<CloudAgentSnapshotPayload> {
  return invokeTauri<CloudAgentSnapshotPayload>(
    "encode_cloud_agent_snapshot_for_send",
    { input },
  );
}

export async function exportCloudAgentSnapshot(
  input: CloudAgentSnapshotInput,
): Promise<boolean> {
  return invokeTauri<boolean>("export_cloud_agent_snapshot", { input });
}
