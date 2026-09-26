// settings.rs — где и как хранится API-ключ пользователя.
//
// Ключ лежит в отдельном файле рядом с базой данных, на компьютере
// самого пользователя. Он НИКОГДА не попадает ни в исходный код,
// ни в собранный exe, ни тем более в GitHub — это ровно то требование
// из раздела 23 самого первого технического задания.
//
// Путь на Windows примерно такой:
// C:\Users\<имя>\AppData\Roaming\protocol\settings.json

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Default)]
struct Settings {
    gemini_api_key: Option<String>,
}

fn settings_path() -> PathBuf {
    let mut dir = dirs::data_dir().expect("не удалось найти папку данных пользователя");
    dir.push("protocol");
    fs::create_dir_all(&dir).ok();
    dir.push("settings.json");
    dir
}

pub fn load_api_key() -> Option<String> {
    let text = fs::read_to_string(settings_path()).ok()?;
    let s: Settings = serde_json::from_str(&text).ok()?;
    s.gemini_api_key.filter(|k| !k.trim().is_empty())
}

pub fn save_api_key(key: String) -> Result<(), String> {
    let s = Settings { gemini_api_key: Some(key) };
    let text = serde_json::to_string_pretty(&s).map_err(|e| e.to_string())?;
    fs::write(settings_path(), text).map_err(|e| e.to_string())
}

pub fn has_api_key() -> bool {
    load_api_key().is_some()
}
