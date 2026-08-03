use std::path::Path;

use serde::{Deserialize, Serialize};

pub const REMOTE_CONFIG_VERSION: u32 = 1;
pub const MAX_REMOTE_SYSTEM_PROMPT_BYTES: usize = 1_048_576;
pub const MAX_REMOTE_MODEL_CHARS: usize = 256;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteAgentConfig {
    pub version: u32,
    pub runtime: String,
    pub system_prompt: String,
    pub model: Option<String>,
}

impl RemoteAgentConfig {
    pub fn validate(&self, allowed_runtimes: &[String]) -> Result<(), String> {
        if self.version != REMOTE_CONFIG_VERSION {
            return Err(format!(
                "unsupported remote configuration version {}",
                self.version
            ));
        }
        if !allowed_runtimes
            .iter()
            .any(|runtime| runtime == &self.runtime)
        {
            return Err(format!(
                "runtime '{}' is not allowed by this compute host",
                self.runtime
            ));
        }
        if self.system_prompt.len() > MAX_REMOTE_SYSTEM_PROMPT_BYTES {
            return Err(format!(
                "agent instructions exceed {} bytes",
                MAX_REMOTE_SYSTEM_PROMPT_BYTES
            ));
        }
        if self
            .model
            .as_deref()
            .is_some_and(|model| model.chars().count() > MAX_REMOTE_MODEL_CHARS)
        {
            return Err(format!(
                "model exceeds {} characters",
                MAX_REMOTE_MODEL_CHARS
            ));
        }
        Ok(())
    }
}

pub fn normalize_allowed_runtimes(
    configured: Option<Vec<String>>,
    baseline_runtime: &str,
) -> Vec<String> {
    let mut runtimes = configured
        .unwrap_or_default()
        .into_iter()
        .map(|runtime| runtime.trim().to_string())
        .filter(|runtime| !runtime.is_empty())
        .collect::<Vec<_>>();
    if !runtimes.iter().any(|runtime| runtime == baseline_runtime) {
        runtimes.push(baseline_runtime.to_string());
    }
    runtimes.sort();
    runtimes.dedup();
    runtimes
}

pub fn load_remote_config(
    path: &Path,
    allowed_runtimes: &[String],
) -> Result<Option<RemoteAgentConfig>, String> {
    let content = match std::fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(format!(
                "failed to read remote configuration {}: {error}",
                path.display()
            ));
        }
    };
    let config: RemoteAgentConfig = serde_json::from_str(&content).map_err(|error| {
        format!(
            "failed to parse remote configuration {}: {error}",
            path.display()
        )
    })?;
    config.validate(allowed_runtimes)?;
    Ok(Some(config))
}

pub fn save_remote_config(path: &Path, config: &RemoteAgentConfig) -> Result<(), String> {
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    std::fs::create_dir_all(parent).map_err(|error| {
        format!(
            "failed to create remote configuration directory {}: {error}",
            parent.display()
        )
    })?;

    let tmp_path = path.with_extension("tmp");
    let bytes = serde_json::to_vec_pretty(config)
        .map_err(|error| format!("failed to serialize remote configuration: {error}"))?;
    std::fs::write(&tmp_path, bytes).map_err(|error| {
        format!(
            "failed to write remote configuration {}: {error}",
            tmp_path.display()
        )
    })?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&tmp_path, std::fs::Permissions::from_mode(0o600)).map_err(
            |error| {
                format!(
                    "failed to secure remote configuration {}: {error}",
                    tmp_path.display()
                )
            },
        )?;
    }

    std::fs::rename(&tmp_path, path).map_err(|error| {
        format!(
            "failed to replace remote configuration {}: {error}",
            path.display()
        )
    })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allowed_runtimes_always_include_the_deployment_baseline() {
        assert_eq!(
            normalize_allowed_runtimes(
                Some(vec!["codex-acp".into(), "codex-acp".into()]),
                "claude-agent-acp",
            ),
            vec!["claude-agent-acp", "codex-acp"]
        );
    }

    #[test]
    fn persisted_configuration_round_trips() {
        let dir = std::env::temp_dir().join(format!("buzz-acp-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("temp dir");
        let path = dir.join("remote.json");
        let config = RemoteAgentConfig {
            version: REMOTE_CONFIG_VERSION,
            runtime: "codex-acp".into(),
            system_prompt: "Review the implementation.".into(),
            model: Some("gpt-5".into()),
        };
        save_remote_config(&path, &config).expect("save");
        let loaded = load_remote_config(&path, &["claude-agent-acp".into(), "codex-acp".into()])
            .expect("load")
            .expect("present");
        assert_eq!(loaded.runtime, "codex-acp");
        assert_eq!(loaded.system_prompt, "Review the implementation.");
        assert_eq!(loaded.model.as_deref(), Some("gpt-5"));
        std::fs::remove_dir_all(dir).expect("cleanup");
    }

    #[test]
    fn rejects_runtime_outside_host_allowlist() {
        let config = RemoteAgentConfig {
            version: REMOTE_CONFIG_VERSION,
            runtime: "arbitrary-command".into(),
            system_prompt: String::new(),
            model: None,
        };
        assert!(config.validate(&["codex-acp".into()]).is_err());
    }
}
