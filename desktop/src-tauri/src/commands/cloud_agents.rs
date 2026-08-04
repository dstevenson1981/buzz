use std::time::Duration;

use nostr::Keys;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::app_state::AppState;
use crate::relay::{
    build_nip98_auth_header_for_keys, classify_request_error, parse_json_response,
    relay_api_base_url_with_override,
};

const MAX_AGENT_NAME_CHARS: usize = 80;
const MAX_MODEL_CHARS: usize = 256;
const MAX_SYSTEM_PROMPT_BYTES: usize = 1_048_576;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCloudRelayAgentInput {
    pub name: String,
    pub runtime: String,
    pub model: Option<String>,
    pub system_prompt: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProvisionCloudRelayAgentRequest {
    name: String,
    runtime: String,
    model: Option<String>,
    system_prompt: String,
    agent_private_key: String,
    auth_tag: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudAgentProvisioningConfig {
    pub allowed_runtimes: Vec<String>,
    pub default_runtime: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCloudRelayAgentResponse {
    pub pubkey: String,
    pub name: String,
    pub status: String,
}

fn cloud_api_base_url(state: &AppState) -> String {
    std::env::var("BUZZ_CLOUD_API_URL")
        .ok()
        .map(|value| value.trim().trim_end_matches('/').to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            option_env!("BUZZ_DESKTOP_BUILD_CLOUD_API_URL")
                .map(|value| value.trim().trim_end_matches('/').to_string())
                .filter(|value| !value.is_empty())
        })
        .unwrap_or_else(|| {
            format!(
                "{}/cloud",
                relay_api_base_url_with_override(state).trim_end_matches('/')
            )
        })
}

fn normalize_create_input(
    input: CreateCloudRelayAgentInput,
) -> Result<CreateCloudRelayAgentInput, String> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err("Agent name is required.".to_string());
    }
    if name.chars().count() > MAX_AGENT_NAME_CHARS {
        return Err(format!(
            "Agent name must be {MAX_AGENT_NAME_CHARS} characters or fewer."
        ));
    }

    let runtime = input.runtime.trim().to_string();
    if runtime.is_empty() {
        return Err("Runtime is required.".to_string());
    }

    let model = input
        .model
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if model
        .as_deref()
        .is_some_and(|value| value.chars().count() > MAX_MODEL_CHARS)
    {
        return Err(format!(
            "Model must be {MAX_MODEL_CHARS} characters or fewer."
        ));
    }

    if input.system_prompt.len() > MAX_SYSTEM_PROMPT_BYTES {
        return Err("Agent instructions are too large.".to_string());
    }
    if input.system_prompt.trim().is_empty() {
        return Err("Agent instructions are required.".to_string());
    }

    Ok(CreateCloudRelayAgentInput {
        name,
        runtime,
        model,
        system_prompt: input.system_prompt,
    })
}

async fn cloud_error_message(response: reqwest::Response) -> String {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&body) {
        if let Some(message) = value.get("message").and_then(serde_json::Value::as_str) {
            return message.to_string();
        }
    }
    match status {
        reqwest::StatusCode::NOT_FOUND => {
            "Cloud agent creation is not configured for this community.".to_string()
        }
        reqwest::StatusCode::UNAUTHORIZED | reqwest::StatusCode::FORBIDDEN => {
            "Your Buzz identity is not authorized to create cloud agents here.".to_string()
        }
        _ => format!("Cloud agent creation failed (HTTP {status})."),
    }
}

#[tauri::command]
pub async fn get_cloud_agent_provisioning_config(
    state: State<'_, AppState>,
) -> Result<CloudAgentProvisioningConfig, String> {
    let url = format!("{}/v1/config", cloud_api_base_url(&state));
    let response = state
        .media_fetch_client
        .get(&url)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|error| classify_request_error(&error))?;
    if !response.status().is_success() {
        return Err(cloud_error_message(response).await);
    }
    parse_json_response(response).await
}

#[tauri::command]
pub async fn create_cloud_relay_agent(
    input: CreateCloudRelayAgentInput,
    state: State<'_, AppState>,
) -> Result<CreateCloudRelayAgentResponse, String> {
    let input = normalize_create_input(input)?;
    let owner_keys = state.signing_keys()?;
    let agent_keys = Keys::generate();
    let agent_private_key = agent_keys.secret_key().to_secret_hex();

    // buzz-sdk and the desktop can resolve different nostr crate versions.
    // Bridge through canonical hex so the owner attestation stays portable.
    let compat_owner = nostr::Keys::parse(&owner_keys.secret_key().to_secret_hex())
        .map_err(|error| format!("failed to bridge owner keys: {error}"))?;
    let compat_agent = nostr::PublicKey::from_hex(&agent_keys.public_key().to_hex())
        .map_err(|error| format!("failed to bridge agent pubkey: {error}"))?;
    let auth_tag = buzz_sdk_pkg::nip_oa::compute_auth_tag(&compat_owner, &compat_agent, "")
        .map_err(|error| format!("failed to authorize cloud agent: {error}"))?;

    let request = ProvisionCloudRelayAgentRequest {
        name: input.name,
        runtime: input.runtime,
        model: input.model,
        system_prompt: input.system_prompt,
        agent_private_key,
        auth_tag,
    };
    let body = serde_json::to_vec(&request)
        .map_err(|error| format!("failed to encode cloud agent request: {error}"))?;
    let url = format!("{}/v1/agents", cloud_api_base_url(&state));
    let authorization =
        build_nip98_auth_header_for_keys(&owner_keys, &Method::POST, &url, &body)?;

    // This request contains the agent private key. The no-redirect client is
    // mandatory so neither the payload nor its signed auth header can be
    // forwarded to a different origin by a 3xx response.
    let response = state
        .media_fetch_client
        .post(&url)
        .header(reqwest::header::AUTHORIZATION, authorization)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .body(body)
        .timeout(Duration::from_secs(90))
        .send()
        .await
        .map_err(|error| classify_request_error(&error))?;
    if !response.status().is_success() {
        return Err(cloud_error_message(response).await);
    }
    parse_json_response(response).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_input_is_trimmed_without_rewriting_instructions() {
        let normalized = normalize_create_input(CreateCloudRelayAgentInput {
            name: "  Research  ".into(),
            runtime: " claude-agent-acp ".into(),
            model: Some("  claude-sonnet  ".into()),
            system_prompt: "  Keep meaningful whitespace.\n".into(),
        })
        .expect("valid input");

        assert_eq!(normalized.name, "Research");
        assert_eq!(normalized.runtime, "claude-agent-acp");
        assert_eq!(normalized.model.as_deref(), Some("claude-sonnet"));
        assert_eq!(normalized.system_prompt, "  Keep meaningful whitespace.\n");
    }

    #[test]
    fn create_input_requires_instructions() {
        let error = normalize_create_input(CreateCloudRelayAgentInput {
            name: "Research".into(),
            runtime: "claude-agent-acp".into(),
            model: None,
            system_prompt: " \n ".into(),
        })
        .expect_err("blank prompt rejected");

        assert_eq!(error, "Agent instructions are required.");
    }
}
