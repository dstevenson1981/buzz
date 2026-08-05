#!/usr/bin/env node

const PROTOCOL_VERSION = 1;
const DEFAULT_API_URL =
  process.env.BUZZ_AGILE36_CLOUD_API_URL || "https://buzz.agile36.com/cloud";

function readStdin() {
  return new Promise((resolve, reject) => {
    let body = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      body += chunk;
    });
    process.stdin.on("end", () => resolve(body));
    process.stdin.on("error", reject);
  });
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function schema() {
  return {
    type: "object",
    properties: {
      api_url: {
        type: "string",
        title: "Cloud API URL",
        description: "Agile36 cloud-control endpoint.",
        default: DEFAULT_API_URL,
      },
    },
    required: ["api_url"],
  };
}

function info() {
  return {
    ok: true,
    name: "agile36",
    version: "0.1.0",
    protocol_version: PROTOCOL_VERSION,
    description: "Runs agents on the Agile36 VPS cloud-control host",
    config_schema: schema(),
  };
}

function scalar(value) {
  return typeof value === "string" ? value.trim() : "";
}

function selectedApiUrl(config = {}) {
  const raw = scalar(config.api_url) || DEFAULT_API_URL;
  if (!/^https?:\/\//.test(raw)) {
    throw new Error("provider_config.api_url must start with http:// or https://");
  }
  return raw.replace(/\/+$/, "");
}

function deployBody(agent = {}) {
  const launch = agent.launch && typeof agent.launch === "object" ? agent.launch : {};
  const policy =
    launch.policy_env && typeof launch.policy_env === "object"
      ? launch.policy_env
      : {};
  const name =
    scalar(agent.name) ||
    scalar(policy.BUZZ_ACP_DISPLAY_NAME) ||
    scalar(policy.BUZZ_ACP_SESSION_TITLE) ||
    "Agent";
  return {
    name,
    runtime: scalar(launch.command) || scalar(agent.agent_command) || "claude-agent-acp",
    model: scalar(policy.BUZZ_ACP_MODEL) || scalar(agent.model) || null,
    systemPrompt:
      typeof policy.BUZZ_ACP_SYSTEM_PROMPT === "string"
        ? policy.BUZZ_ACP_SYSTEM_PROMPT
        : typeof agent.system_prompt === "string"
          ? agent.system_prompt
          : "",
    agentPrivateKey: scalar(agent.private_key_nsec),
    authTag: typeof agent.auth_tag === "string" ? agent.auth_tag : "",
    ownerPubkey: scalar(launch.owner_pubkey),
    respondTo: scalar(agent.respond_to) || "owner-only",
    respondToAllowlist: Array.isArray(agent.respond_to_allowlist)
      ? agent.respond_to_allowlist
      : [],
  };
}

async function deploy(request) {
  const apiUrl = selectedApiUrl(request.provider_config);
  const body = deployBody(request.agent);
  const response = await fetch(`${apiUrl}/v1/provider/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = {};
  }
  if (!response.ok) {
    throw new Error(
      typeof parsed.message === "string"
        ? parsed.message
        : `Agile36 cloud-control returned HTTP ${response.status}`,
    );
  }
  if (typeof parsed.pubkey !== "string" || parsed.pubkey.trim() === "") {
    throw new Error("Agile36 cloud-control did not return an agent pubkey");
  }
  return { ok: true, agent_id: parsed.pubkey };
}

async function main() {
  const input = JSON.parse(await readStdin());
  if (input.op === "info") {
    writeJson(info());
    return;
  }
  if (input.op === "deploy") {
    writeJson(await deploy(input));
    return;
  }
  throw new Error(`unsupported op: ${input.op}`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
