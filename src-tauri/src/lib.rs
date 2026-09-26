mod db;
mod commands;
mod settings;
mod ai;

use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};
use commands::AppState;
use std::sync::Mutex;

// F9 — показать/спрятать окно ПРОТОКОЛА поверх игры
fn toggle(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            let _ = w.show();
            let _ = w.unminimize();
            let _ = w.set_always_on_top(true);
            let _ = w.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Открываем (и при необходимости создаём) базу данных один раз при старте.
    let conn = db::init();

    tauri::Builder::default()
        .manage(AppState { conn: Mutex::new(conn) })
        .invoke_handler(tauri::generate_handler![
            commands::get_servers,
            commands::get_documents,
            commands::get_chunks,
            commands::search,
            commands::has_api_key,
            commands::save_api_key,
            commands::ask_ai,
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            app.global_shortcut().register(Shortcut::new(None, Code::F9))?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("ошибка запуска приложения");
}
