// commands.rs — функции, которые может вызвать окно (JavaScript) у Rust-части.
// Каждая функция с #[tauri::command] становится доступна в JS как
// window.__TAURI__.core.invoke("имя_функции", { аргументы }).
//
// Соединение с базой лежит в общем состоянии приложения (AppState),
// чтобы не открывать файл базы заново на каждый вызов.

use crate::db::{self, DocumentInfo, ChunkInfo, SearchHit, ServerInfo};
use rusqlite::Connection;
use std::sync::Mutex;

pub struct AppState {
    pub conn: Mutex<Connection>,
}

#[tauri::command]
pub fn get_servers(state: tauri::State<AppState>) -> Vec<ServerInfo> {
    let conn = state.conn.lock().unwrap();
    db::list_servers(&conn)
}

#[tauri::command]
pub fn get_documents(state: tauri::State<AppState>, server: String) -> Vec<DocumentInfo> {
    let conn = state.conn.lock().unwrap();
    db::list_documents(&conn, &server)
}

#[tauri::command]
pub fn get_chunks(state: tauri::State<AppState>, document_id: i64) -> Vec<ChunkInfo> {
    let conn = state.conn.lock().unwrap();
    db::get_chunks(&conn, document_id)
}

#[tauri::command]
pub fn search(state: tauri::State<AppState>, server: String, query: String) -> Vec<SearchHit> {
    let conn = state.conn.lock().unwrap();
    db::search(&conn, &server, &query)
}

#[tauri::command]
pub fn has_api_key() -> bool {
    crate::settings::has_api_key()
}

#[tauri::command]
pub fn save_api_key(key: String) -> Result<(), String> {
    crate::settings::save_api_key(key)
}

#[tauri::command]
pub async fn ask_ai(
    state: tauri::State<'_, AppState>,
    server: String,
    question: String,
) -> Result<String, String> {
    let api_key = crate::settings::load_api_key()
        .ok_or_else(|| "Ключ Gemini не задан. Откройте настройки и вставьте ключ.".to_string())?;

    // Сначала обычный поиск по базе — ИИ увидит только то, что реально нашлось.
    let hits = {
        let conn = state.conn.lock().unwrap();
        db::search(&conn, &server, &question)
    };

    crate::ai::ask_gemini(&api_key, &question, &hits).await
}
