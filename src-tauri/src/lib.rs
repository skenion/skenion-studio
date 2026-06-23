use std::{
    collections::{BTreeSet, HashMap},
    env,
    io::{BufRead, BufReader},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{mpsc, Mutex},
    thread,
    time::Duration,
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

#[derive(Default)]
struct RuntimeSidecarState {
    manager: Mutex<RuntimeSidecarManager>,
}

#[derive(Default)]
struct RuntimeSidecarManager {
    children: HashMap<String, RuntimeSidecarChild>,
}

struct RuntimeSidecarChild {
    child: Child,
    owners: RuntimeSidecarOwners,
    profile_id: String,
    runtime_url: String,
    startup: Value,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RuntimeSidecarOwners {
    window_ids: BTreeSet<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartRuntimeSidecarRequest {
    #[serde(default)]
    isolated: bool,
    owner_window_id: String,
    profile_id: String,
    #[serde(default)]
    runtime_executable: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StopRuntimeSidecarRequest {
    profile_id: String,
    #[serde(default)]
    owner_window_id: Option<String>,
    #[serde(default)]
    reason: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenStudioWindowRequest {
    profile_id: String,
    runtime_url: String,
    session_id: String,
    window_id: String,
    window_mode: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeSidecarStopResponse {
    ok: bool,
    stopped: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    profile_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    runtime_url: Option<String>,
    diagnostics: Vec<RuntimeSidecarDiagnostic>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeSidecarDiagnostic {
    severity: &'static str,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<&'static str>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenStudioWindowResponse {
    ok: bool,
    window_id: String,
}

#[tauri::command]
fn start_runtime_sidecar(
    app: tauri::AppHandle,
    state: tauri::State<'_, RuntimeSidecarState>,
    request: StartRuntimeSidecarRequest,
) -> Result<Value, String> {
    let key = sidecar_key(
        &request.profile_id,
        &request.owner_window_id,
        request.isolated,
    );
    {
        let mut manager = state
            .manager
            .lock()
            .map_err(|_| "Runtime sidecar state lock is poisoned.".to_owned())?;
        manager.drop_exited_children();
        if let Some(child) = manager.children.get_mut(&key) {
            child.owners.register(request.owner_window_id.clone());
            return Ok(child.startup.clone());
        }
    }

    let executable = runtime_executable(&app, request.runtime_executable.as_deref());
    let mut child = Command::new(&executable)
        .args([
            "serve",
            "--host",
            "127.0.0.1",
            "--port",
            "0",
            "--startup-json",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| {
            format!(
                "Could not start skenion-runtime sidecar from {}: {error}",
                executable.display()
            )
        })?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Runtime sidecar stdout was not available.".to_owned())?;
    let startup = read_startup_json(stdout).map_err(|error| {
        let _ = child.kill();
        let _ = child.wait();
        error
    })?;
    let runtime_url = startup
        .pointer("/endpoint/url")
        .and_then(Value::as_str)
        .ok_or_else(|| "Runtime sidecar startup response did not include endpoint.url.".to_owned())?
        .to_owned();

    let mut manager = state
        .manager
        .lock()
        .map_err(|_| "Runtime sidecar state lock is poisoned.".to_owned())?;
    if let Some(existing) = manager.children.get_mut(&key) {
        existing.owners.register(request.owner_window_id.clone());
        let _ = child.kill();
        let _ = child.wait();
        return Ok(existing.startup.clone());
    }
    manager.children.insert(
        key,
        RuntimeSidecarChild {
            child,
            owners: RuntimeSidecarOwners::new(request.owner_window_id),
            profile_id: request.profile_id,
            runtime_url,
            startup: startup.clone(),
        },
    );
    Ok(startup)
}

#[tauri::command]
fn stop_runtime_sidecar(
    state: tauri::State<'_, RuntimeSidecarState>,
    request: StopRuntimeSidecarRequest,
) -> Result<RuntimeSidecarStopResponse, String> {
    let _ = request.reason.as_deref();
    let mut manager = state
        .manager
        .lock()
        .map_err(|_| "Runtime sidecar state lock is poisoned.".to_owned())?;
    let stopped = manager.stop_matching(
        request.profile_id.as_str(),
        request.owner_window_id.as_deref(),
    );
    Ok(RuntimeSidecarStopResponse {
        ok: true,
        stopped: stopped.is_some(),
        profile_id: Some(request.profile_id),
        runtime_url: stopped,
        diagnostics: Vec::new(),
    })
}

#[tauri::command]
fn open_studio_window(
    app: tauri::AppHandle,
    request: OpenStudioWindowRequest,
) -> Result<OpenStudioWindowResponse, String> {
    let query = format!(
        "runtimeUrl={}&sessionId={}&runtimeProfile={}&windowId={}&windowMode={}",
        encode_query_value(&request.runtime_url),
        encode_query_value(&request.session_id),
        encode_query_value(&request.profile_id),
        encode_query_value(&request.window_id),
        encode_query_value(&request.window_mode)
    );
    let url = WebviewUrl::App(format!("index.html?{query}").into());
    WebviewWindowBuilder::new(&app, request.window_id.clone(), url)
        .title("skenion studio")
        .inner_size(1280.0, 860.0)
        .min_inner_size(960.0, 640.0)
        .build()
        .map_err(|error| error.to_string())?;

    Ok(OpenStudioWindowResponse {
        ok: true,
        window_id: request.window_id,
    })
}

pub fn run() {
    tauri::Builder::default()
        .manage(RuntimeSidecarState::default())
        .invoke_handler(tauri::generate_handler![
            open_studio_window,
            start_runtime_sidecar,
            stop_runtime_sidecar
        ])
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::Destroyed) {
                let state = window.state::<RuntimeSidecarState>();
                if let Ok(mut manager) = state.manager.lock() {
                    manager.stop_for_owner(window.label());
                };
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running skenion studio desktop shell");
}

impl RuntimeSidecarManager {
    fn drop_exited_children(&mut self) {
        self.children
            .retain(|_, child| match child.child.try_wait() {
                Ok(Some(_)) => false,
                Ok(None) => true,
                Err(_) => false,
            });
    }

    fn stop_matching(&mut self, profile_id: &str, owner_window_id: Option<&str>) -> Option<String> {
        let keys: Vec<String> = self
            .children
            .iter()
            .filter(|(_, child)| {
                child.profile_id == profile_id
                    && owner_window_id
                        .map(|owner| child.owners.contains(owner))
                        .unwrap_or(true)
            })
            .map(|(key, _)| key.clone())
            .collect();
        let mut stopped_runtime_url = None;
        for key in keys {
            let should_stop = match (owner_window_id, self.children.get_mut(&key)) {
                (Some(owner), Some(child)) => child.owners.release(owner),
                (None, Some(_)) => true,
                _ => false,
            };
            if should_stop {
                if let Some(mut child) = self.children.remove(&key) {
                    stopped_runtime_url = Some(child.runtime_url.clone());
                    let _ = child.child.kill();
                    let _ = child.child.wait();
                }
            }
        }
        stopped_runtime_url
    }

    fn stop_for_owner(&mut self, owner_window_id: &str) {
        let keys: Vec<String> = self
            .children
            .iter()
            .filter(|(_, child)| child.owners.contains(owner_window_id))
            .map(|(key, _)| key.clone())
            .collect();
        for key in keys {
            let should_stop = self
                .children
                .get_mut(&key)
                .map(|child| child.owners.release(owner_window_id))
                .unwrap_or(false);
            if should_stop {
                if let Some(mut child) = self.children.remove(&key) {
                    let _ = child.child.kill();
                    let _ = child.child.wait();
                }
            }
        }
    }
}

impl RuntimeSidecarOwners {
    fn new(owner_window_id: String) -> Self {
        let mut window_ids = BTreeSet::new();
        window_ids.insert(owner_window_id);
        Self { window_ids }
    }

    fn register(&mut self, owner_window_id: String) {
        self.window_ids.insert(owner_window_id);
    }

    fn release(&mut self, owner_window_id: &str) -> bool {
        self.window_ids.remove(owner_window_id);
        self.window_ids.is_empty()
    }

    fn contains(&self, owner_window_id: &str) -> bool {
        self.window_ids.contains(owner_window_id)
    }
}

#[cfg(test)]
mod tests {
    use super::{sidecar_key, RuntimeSidecarOwners};

    #[test]
    fn sidecar_key_reuses_shared_profiles_and_splits_isolated_windows() {
        assert_eq!(sidecar_key("local-managed", "main", false), "local-managed");
        assert_eq!(
            sidecar_key("local-managed", "main", true),
            "local-managed:main"
        );
        assert_ne!(
            sidecar_key("local-managed", "main", true),
            sidecar_key("local-managed", "detail", true)
        );
    }

    #[test]
    fn shared_sidecar_owners_keep_child_alive_until_last_owner_releases() {
        let mut owners = RuntimeSidecarOwners::new("main".to_owned());

        owners.register("detail".to_owned());

        assert!(owners.contains("main"));
        assert!(owners.contains("detail"));
        assert!(!owners.release("main"));
        assert!(!owners.contains("main"));
        assert!(owners.contains("detail"));
        assert!(owners.release("detail"));
    }

    #[test]
    fn shared_sidecar_owner_registration_is_idempotent_for_reused_window_label() {
        let mut owners = RuntimeSidecarOwners::new("main".to_owned());

        owners.register("main".to_owned());

        assert!(owners.release("main"));
    }
}

fn sidecar_key(profile_id: &str, owner_window_id: &str, isolated: bool) -> String {
    if isolated {
        format!("{profile_id}:{owner_window_id}")
    } else {
        profile_id.to_owned()
    }
}

fn read_startup_json(stdout: impl std::io::Read + Send + 'static) -> Result<Value, String> {
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        let result = match reader.read_line(&mut line) {
            Ok(0) => Err("Runtime sidecar exited before writing startup JSON.".to_owned()),
            Ok(_) => Ok(line),
            Err(error) => Err(format!(
                "Could not read Runtime sidecar startup JSON: {error}"
            )),
        };
        let _ = sender.send(result);
        for line in reader.lines() {
            if line.is_err() {
                break;
            }
        }
    });
    let line = receiver
        .recv_timeout(Duration::from_secs(10))
        .map_err(|_| "Timed out waiting for Runtime sidecar startup JSON.".to_owned())??;
    let startup: Value = serde_json::from_str(line.trim())
        .map_err(|error| format!("Runtime sidecar startup JSON could not be parsed: {error}"))?;
    if startup.get("schema").and_then(Value::as_str) != Some("skenion.runtime.sidecar.startup") {
        return Err("Runtime sidecar startup response used an unsupported schema.".to_owned());
    }
    Ok(startup)
}

fn runtime_executable(app: &tauri::AppHandle, requested: Option<&str>) -> PathBuf {
    if let Some(path) = requested.filter(|value| !value.trim().is_empty()) {
        return PathBuf::from(path);
    }
    if let Ok(path) = env::var("SKENION_RUNTIME_BIN") {
        if !path.trim().is_empty() {
            return PathBuf::from(path);
        }
    }
    if let Some(path) = bundled_runtime_binary(app) {
        return path;
    }
    if let Some(path) = sibling_runtime_debug_binary() {
        return path;
    }
    PathBuf::from("skenion-runtime")
}

fn bundled_runtime_binary(app: &tauri::AppHandle) -> Option<PathBuf> {
    let binary_name = if cfg!(windows) {
        "skenion-runtime.exe"
    } else {
        "skenion-runtime"
    };
    let resource_dir = app.path().resource_dir().ok()?;
    let candidate = resource_dir.join(binary_name);
    candidate.exists().then_some(candidate)
}

fn sibling_runtime_debug_binary() -> Option<PathBuf> {
    let binary_name = if cfg!(windows) {
        "skenion-runtime.exe"
    } else {
        "skenion-runtime"
    };
    let current_dir = env::current_dir().ok()?;
    let candidate = current_dir
        .parent()?
        .join("Skenion-runtime")
        .join("target")
        .join("debug")
        .join(binary_name);
    candidate.exists().then_some(candidate)
}

fn encode_query_value(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            _ => {
                encoded.push('%');
                encoded.push_str(&format!("{byte:02X}"));
            }
        }
    }
    encoded
}
