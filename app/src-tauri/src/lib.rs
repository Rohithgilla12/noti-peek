use tauri::{
    menu::{
        AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder,
    },
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent, TrayIcon},
    Emitter, Manager, State, WindowEvent,
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
        Migration {
            version: 4,
            description: "add_first_seen_at_to_notifications",
            sql: r#"
                ALTER TABLE notifications ADD COLUMN first_seen_at TEXT;
                UPDATE notifications SET first_seen_at = cached_at WHERE first_seen_at IS NULL;
                CREATE INDEX IF NOT EXISTS idx_notifications_first_seen_source
                  ON notifications(first_seen_at DESC, source);
            "#,
            kind: MigrationKind::Up,
        },
    ]
}

#[tauri::command]
fn set_badge_count(count: u32, state: State<TrayState>) -> Result<(), String> {
    let label = if count > 0 { Some(count.to_string()) } else { None };
    let tray_guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(tray) = tray_guard.as_ref() {
        tray.set_title(label).map_err(|e| e.to_string())?;
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
        .plugin(tauri_plugin_notification::init())
        .manage(TrayState(Mutex::new(None)))
        .setup(|app| {
            // ----------------------------------------------------------
            // Native macOS menu bar.
            // ----------------------------------------------------------
            let about_metadata = AboutMetadataBuilder::new()
                .name(Some("noti-peek"))
                .version(Some(env!("CARGO_PKG_VERSION")))
                .copyright(Some("© Rohith Gilla"))
                .website(Some("https://github.com/Rohithgilla12/noti-peek"))
                .website_label(Some("github.com/Rohithgilla12/noti-peek"))
                .build();

            let prefs = MenuItemBuilder::new("Preferences…")
                .id("app:preferences")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;
            let refresh = MenuItemBuilder::new("Refresh")
                .id("view:refresh")
                .accelerator("CmdOrCtrl+R")
                .build(app)?;
            let toggle_unread = MenuItemBuilder::new("Toggle Unread Only")
                .id("view:toggle-unread")
                .accelerator("CmdOrCtrl+U")
                .build(app)?;

            let app_submenu = SubmenuBuilder::new(app, "noti-peek")
                .item(&PredefinedMenuItem::about(
                    app,
                    Some("About noti-peek"),
                    Some(about_metadata),
                )?)
                .separator()
                .item(&prefs)
                .separator()
                .item(&PredefinedMenuItem::services(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::hide(app, None)?)
                .item(&PredefinedMenuItem::hide_others(app, None)?)
                .item(&PredefinedMenuItem::show_all(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::quit(app, None)?)
                .build()?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;

            let view_submenu = SubmenuBuilder::new(app, "View")
                .item(&refresh)
                .item(&toggle_unread)
                .separator()
                .item(&PredefinedMenuItem::fullscreen(app, None)?)
                .build()?;

            let window_submenu = SubmenuBuilder::new(app, "Window")
                .item(&PredefinedMenuItem::minimize(app, None)?)
                .item(&PredefinedMenuItem::maximize(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::close_window(app, None)?)
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&app_submenu, &edit_submenu, &view_submenu, &window_submenu])
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(|app, event| match event.id().as_ref() {
                "app:preferences" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.emit("open-preferences", ());
                    }
                }
                "view:refresh" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("menu-refresh", ());
                    }
                }
                "view:toggle-unread" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("menu-toggle-unread", ());
                    }
                }
                _ => {}
            });

            // ----------------------------------------------------------
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
