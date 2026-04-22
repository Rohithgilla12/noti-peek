use std::sync::Mutex;
use tauri::{
    menu::{
        AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder,
    },
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State, TitleBarStyle, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_sql::{Migration, MigrationKind};

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
    let label = if count > 0 {
        Some(count.to_string())
    } else {
        None
    };
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
            // Create the main window with transparent titlebar for macOS
            let win_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Noti Peek")
                .inner_size(1120.0, 720.0)
                .min_inner_size(820.0, 560.0)
                .resizable(true)
                .visible(true)
                .transparent(true)
                .shadow(true)
                .focused(true);

            // macOS: transparent titlebar, hide the title text, and nudge
            // the traffic lights inward so they sit comfortably against
            // the app's content — matches Slack / Linear / Electron apps.
            #[cfg(target_os = "macos")]
            let win_builder = win_builder
                .title_bar_style(TitleBarStyle::Overlay)
                .hidden_title(true)
                .traffic_light_position(tauri::LogicalPosition::new(18.0, 18.0));

            let window = win_builder.build().unwrap();

            // Set background color only when building for macOS
            #[cfg(target_os = "macos")]
            {
                use cocoa::appkit::{NSColor, NSWindow};
                use cocoa::base::{id, nil};

                let ns_window = window.ns_window().unwrap() as id;
                unsafe {
                    // Matches --bg in App.css (oklch(13% 0.006 80)) so the
                    // titlebar blends into the app's warm near-black surface.
                    let bg_color = NSColor::colorWithRed_green_blue_alpha_(
                        nil,
                        24.0 / 255.0,
                        22.0 / 255.0,
                        19.0 / 255.0,
                        1.0,
                    );
                    ns_window.setBackgroundColor_(bg_color);
                }
            }

            // ----------------------------------------------------------
            // Native macOS menu bar.
            // ----------------------------------------------------------
            let about_metadata = AboutMetadataBuilder::new()
                .name(Some("Noti Peek"))
                .version(Some(env!("CARGO_PKG_VERSION")))
                .copyright(Some("© Rohith Gilla"))
                .website(Some("https://github.com/Rohithgilla12/noti-peek"))
                .website_label(Some("github.com/Rohithgilla12/noti-peek"))
                .build();

            let prefs = MenuItemBuilder::new("Preferences…")
                .id("app:preferences")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;
            let check_updates = MenuItemBuilder::new("Check for Updates…")
                .id("app:check-updates")
                .build(app)?;
            let refresh = MenuItemBuilder::new("Refresh")
                .id("view:refresh")
                .accelerator("CmdOrCtrl+R")
                .build(app)?;
            let toggle_unread = MenuItemBuilder::new("Toggle Unread Only")
                .id("view:toggle-unread")
                .accelerator("CmdOrCtrl+U")
                .build(app)?;

            let app_submenu = SubmenuBuilder::new(app, "Noti Peek")
                .item(&PredefinedMenuItem::about(
                    app,
                    Some("About Noti Peek"),
                    Some(about_metadata),
                )?)
                .separator()
                .item(&check_updates)
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
                "app:check-updates" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.emit("menu-check-updates", ());
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
            let show_item = MenuItemBuilder::new("Show Noti Peek")
                .id("show")
                .accelerator("CmdOrCtrl+Shift+N")
                .build(app)?;
            let prefs_item = MenuItemBuilder::new("Preferences…")
                .id("preferences")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItemBuilder::new("Quit Noti Peek")
                .id("quit")
                .accelerator("CmdOrCtrl+Q")
                .build(app)?;

            let tray_menu = MenuBuilder::new(app)
                .items(&[&show_item, &prefs_item, &separator, &quit_item])
                .build()?;

            // Menubar glyph is a single-color template image (ring + offset
            // dot). macOS inverts it for dark/light menubars automatically.
            let tray_icon =
                tauri::image::Image::from_bytes(include_bytes!("../icons/tray-template@2x.png"))
                    .expect("tray-template@2x.png must be a valid PNG");
            let tray = TrayIconBuilder::new()
                .icon(tray_icon)
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
