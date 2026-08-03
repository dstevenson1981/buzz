import { sendAgentObserverControl } from "@/shared/api/observerRelay";
import type {
  ControlResultFrame,
  RelayAgentConfiguration,
} from "@/shared/api/types";
import {
  ensureRelayObserverSubscription,
  subscribeControlResults,
} from "./observerRelayStore";

const CONTROL_TIMEOUT_MS = 10_000;

function isRelayAgentConfiguration(
  value: unknown,
): value is RelayAgentConfiguration {
  if (typeof value !== "object" || value === null) return false;
  const config = value as Partial<RelayAgentConfiguration>;
  return (
    typeof config.runtime === "string" &&
    typeof config.systemPrompt === "string" &&
    (typeof config.model === "string" || config.model === null) &&
    Array.isArray(config.allowedRuntimes) &&
    config.allowedRuntimes.every((runtime) => typeof runtime === "string")
  );
}

async function sendConfigurationControl(
  pubkey: string,
  type: "get_configuration" | "update_configuration",
  payload: Record<string, unknown> = {},
): Promise<ControlResultFrame> {
  await ensureRelayObserverSubscription();
  const requestId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      unsubscribe();
      callback();
    };
    const unsubscribe = subscribeControlResults(pubkey, (frame) => {
      if (frame.type !== type || frame.requestId !== requestId) return;
      finish(() => {
        if (frame.status === "rejected") {
          reject(
            new Error(frame.error || "The relay agent rejected the change."),
          );
          return;
        }
        resolve(frame);
      });
    });
    const timeout = window.setTimeout(() => {
      finish(() =>
        reject(
          new Error(
            "The relay agent did not respond. Check that it is online and remote configuration is enabled.",
          ),
        ),
      );
    }, CONTROL_TIMEOUT_MS);

    void sendAgentObserverControl(pubkey, {
      type,
      requestId,
      ...payload,
    }).catch((error) => {
      finish(() =>
        reject(
          error instanceof Error
            ? error
            : new Error("Failed to contact the relay agent."),
        ),
      );
    });
  });
}

export async function getRelayAgentConfiguration(
  pubkey: string,
): Promise<RelayAgentConfiguration> {
  const frame = await sendConfigurationControl(pubkey, "get_configuration");
  if (!isRelayAgentConfiguration(frame.configuration)) {
    throw new Error("The relay agent returned an invalid configuration.");
  }
  return frame.configuration;
}

export async function updateRelayAgentConfiguration(
  pubkey: string,
  configuration: Pick<
    RelayAgentConfiguration,
    "runtime" | "systemPrompt" | "model"
  >,
): Promise<ControlResultFrame> {
  return sendConfigurationControl(
    pubkey,
    "update_configuration",
    configuration,
  );
}
