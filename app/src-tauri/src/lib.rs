use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent, TrayIcon},
    Manager, State,
};
use tauri_plugin_positioner::{Position, WindowExt as PositionerExt};
use std::sync::Mutex;

#[cfg(target_os = "macos")]
use tauri_nspanel::WebviewWindowExt as NsPanelExt;

#[cfg(target_os = "macos")]
const NS_MAIN_MENU_WINDOW_LEVEL: i32 = 24;

struct TrayState(Mutex<Option<TrayIcon>>);

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
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_positioner::init());

    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_nspanel::init());
    }

    builder
        .manage(TrayState(Mutex::new(None)))
        .setup(|app| {
            let tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true)
                .on_tray_icon_event(|tray, event| {
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);

                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        #[cfg(target_os = "macos")]
                        {
                            use tauri_nspanel::ManagerExt;
                            if let Ok(panel) = app.get_webview_panel("main") {
                                if panel.is_visible() {
                                    panel.order_out(None);
                                } else {
                                    if let Some(window) = app.get_webview_window("main") {
                                        let _ = window.move_window(Position::TrayBottomCenter);
                                    }
                                    panel.show();
                                }
                            }
                        }
                        #[cfg(not(target_os = "macos"))]
                        {
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.move_window(Position::TrayBottomCenter);
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    }
                })
                .build(app)?;

            let tray_state: State<TrayState> = app.state();
            *tray_state.0.lock().unwrap() = Some(tray);

            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "macos")]
                {
                    let panel = window.to_panel().unwrap();
                    panel.set_level(NS_MAIN_MENU_WINDOW_LEVEL + 1);
                }

                let _ = window.hide();

                #[cfg(not(target_os = "macos"))]
                {
                    let window_clone = window.clone();
                    window.on_window_event(move |event| {
                        if let WindowEvent::Focused(false) = event {
                            let _ = window_clone.hide();
                        }
                    });
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![set_badge_count])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
