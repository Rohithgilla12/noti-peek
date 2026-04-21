use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent, TrayIcon},
    Manager, State,
};
use tauri_plugin_sql::{Migration, MigrationKind};
use std::sync::Mutex;

struct TrayState(Mutex<Option<TrayIcon>>);

fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_notifications_table",
            sql: r#"
                CREATE TABLE IF NOT EXISTS notifications (
                    id TEXT PRIMARY KEY,
                    source TEXT NOT NULL,
                    type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    body TEXT,
                    url TEXT NOT NULL,
                    repo TEXT,
                    project TEXT,
                    author_name TEXT NOT NULL,
                    author_avatar TEXT,
                    unread INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    cached_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_notifications_source ON notifications(source);
                CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(unread);
                CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_connections_table",
            sql: r#"
                CREATE TABLE IF NOT EXISTS connections (
                    provider TEXT PRIMARY KEY,
                    account_id TEXT,
                    account_name TEXT,
                    account_avatar TEXT,
                    connected_at TEXT NOT NULL,
                    cached_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_sync_metadata_table",
            sql: r#"
                CREATE TABLE IF NOT EXISTS sync_metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            "#,
            kind: MigrationKind::Up,
        },
    ]
}

#[tauri::command]
fn set_badge_count(count: u32, state: State<TrayState>) -> Result<(), String> {
    let tray_guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(tray) = tray_guard.as_ref() {
        let title = if count > 0 {
            Some(count.to_string())
        } else {
            None
        };
        tray.set_title(title).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:noti-peek.db", get_migrations())
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(TrayState(Mutex::new(None)))
        .setup(|app| {
            // Tray icon stays — it toggles the main window's visibility and
            // surfaces the unread badge. No longer drives position (the main
            // window is a regular app window now, not a menubar popover).
            let tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false)
                                && window.is_focused().unwrap_or(false)
                            {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            let tray_state: State<TrayState> = app.state();
            *tray_state.0.lock().unwrap() = Some(tray);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![set_badge_count])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
