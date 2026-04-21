use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent, TrayIcon},
    Manager, State, WindowEvent,
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
fn set_badge_count(
    count: u32,
    state: State<TrayState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let label = if count > 0 { Some(count.to_string()) } else { None };

    // Menubar tray shows the unread count next to the icon.
    let tray_guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(tray) = tray_guard.as_ref() {
        tray.set_title(label.clone()).map_err(|e| e.to_string())?;
    }

    // macOS Dock badge — matches Mail.app behaviour.
    #[cfg(target_os = "macos")]
    {
        let _ = app.set_badge_label(label);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = &app;
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
            // Tray right-click menu — native macOS context menu with
            // Show · Preferences · Quit. Matches every menubar helper
            // the target user already has in their bar.
            let show_item = MenuItemBuilder::new("Show noti-peek")
                .id("show")
                .accelerator("CmdOrCtrl+Shift+N")
                .build(app)?;
            let prefs_item = MenuItemBuilder::new("Preferences…")
                .id("preferences")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItemBuilder::new("Quit noti-peek")
                .id("quit")
                .accelerator("CmdOrCtrl+Q")
                .build(app)?;

            let tray_menu = MenuBuilder::new(app)
                .items(&[&show_item, &prefs_item, &separator, &quit_item])
                .build()?;

            let tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true)
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "preferences" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("open-preferences", ());
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
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

            // Close-to-hide: red traffic-light button hides the window
            // instead of quitting the process. ⌘Q still quits. This is
            // the standard macOS app lifetime.
            if let Some(window) = app.get_webview_window("main") {
                let win = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win.hide();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![set_badge_count])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
