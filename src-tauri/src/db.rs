// db.rs — вся работа с локальной базой ПРОТОКОЛА.
//
// База — обычный файл SQLite, лежит в папке данных приложения
// (на Windows это примерно C:\Users\<имя>\AppData\Roaming\protocol\protocol.db).
// При первом запуске, если база пустая, сюда загружаются "затравочные" данные
// из seed_tver.json (см. рядом в этой же папке) — это временная мера, пока
// не готов настоящий импортёр с вики (это отдельный, более поздний этап).

use rusqlite::Connection;
use serde::Serialize;
use std::path::PathBuf;

// Данные "вшиты" прямо в exe на этапе сборки — не нужен отдельный файл рядом с программой.
const SEED_JSON: &str = include_str!("../seed_tver.json");

#[derive(Serialize, Clone)]
pub struct ServerInfo {
    pub id: String,
    pub name: String,
    pub enabled: bool,
}

#[derive(Serialize, Clone)]
pub struct DocumentInfo {
    pub id: i64,
    pub server: String,
    pub code: String,
    pub title: String,
    pub url: Option<String>,
    pub status: String,
    pub note: Option<String>,
    pub source_type: String,
    pub chunk_count: i64,
}

#[derive(Serialize, Clone)]
pub struct ChunkInfo {
    pub id: i64,
    pub document_id: i64,
    pub article_no: String,
    pub heading: String,
    pub text: String,
    pub sanction: String,
}

#[derive(Serialize, Clone)]
pub struct SearchHit {
    pub chunk: ChunkInfo,
    pub document_title: String,
    pub document_status: String,
    pub rank: f64,
}

fn db_path() -> PathBuf {
    let mut dir = dirs::data_dir().expect("не удалось найти папку данных пользователя");
    dir.push("protocol");
    std::fs::create_dir_all(&dir).ok();
    dir.push("protocol.db");
    dir
}

/// Открыть соединение с базой, создать таблицы и (если база пустая) загрузить seed.
/// Вызывается один раз при старте приложения.
pub fn init() -> Connection {
    let path = db_path();
    let conn = Connection::open(&path).expect("не удалось открыть файл базы данных");

    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS servers (
            id      TEXT PRIMARY KEY,
            name    TEXT NOT NULL,
            enabled INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS documents (
            id          INTEGER PRIMARY KEY,
            server      TEXT NOT NULL,
            code        TEXT NOT NULL,
            title       TEXT NOT NULL,
            url         TEXT,
            status      TEXT NOT NULL,   -- Проверено / Требует проверки / Устарело / Не найдено в источнике / Заметка
            note        TEXT,
            source_type TEXT NOT NULL    -- law | protocol_note | user_material (позже)
        );

        CREATE TABLE IF NOT EXISTS chunks (
            id          INTEGER PRIMARY KEY,
            document_id INTEGER NOT NULL REFERENCES documents(id),
            article_no  TEXT NOT NULL,
            heading     TEXT NOT NULL,
            text        TEXT NOT NULL,
            sanction    TEXT NOT NULL DEFAULT ''
        );

        -- Полнотекстовый поиск: отдельная "виртуальная" таблица поверх chunks.
        -- external content = не дублирует текст физически, только индекс.
        CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
            heading, text, tags,
            content='chunks', content_rowid='id'
        );

        -- Синхронизация индекса при любых изменениях chunks (на будущее, для импортёра).
        CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
            INSERT INTO chunks_fts(rowid, heading, text, tags) VALUES (new.id, new.heading, new.text, '');
        END;
        CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
            INSERT INTO chunks_fts(chunks_fts, rowid, heading, text, tags) VALUES('delete', old.id, old.heading, old.text, '');
        END;
        "#,
    )
    .expect("не удалось создать таблицы");

    let already_seeded: i64 = conn
        .query_row("SELECT COUNT(*) FROM documents", [], |r| r.get(0))
        .unwrap_or(0);

    if already_seeded == 0 {
        seed(&conn);
    }

    conn
}

fn seed(conn: &Connection) {
    let data: serde_json::Value =
        serde_json::from_str(SEED_JSON).expect("seed_tver.json повреждён");

    for s in data["servers"].as_array().unwrap() {
        conn.execute(
            "INSERT INTO servers (id, name, enabled) VALUES (?1, ?2, ?3)",
            rusqlite::params![
                s["id"].as_str().unwrap(),
                s["name"].as_str().unwrap(),
                s["enabled"].as_bool().unwrap() as i64
            ],
        )
        .unwrap();
    }

    for d in data["documents"].as_array().unwrap() {
        conn.execute(
            "INSERT INTO documents (id, server, code, title, url, status, note, source_type)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                d["id"].as_i64().unwrap(),
                d["server"].as_str().unwrap(),
                d["code"].as_str().unwrap(),
                d["title"].as_str().unwrap(),
                d["url"].as_str(),
                d["status"].as_str().unwrap(),
                d["note"].as_str(),
                d["source_type"].as_str().unwrap(),
            ],
        )
        .unwrap();
    }

    for c in data["chunks"].as_array().unwrap() {
        conn.execute(
            "INSERT INTO chunks (id, document_id, article_no, heading, text, sanction)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                c["id"].as_i64().unwrap(),
                c["document_id"].as_i64().unwrap(),
                c["article_no"].as_str().unwrap(),
                c["heading"].as_str().unwrap(),
                c["text"].as_str().unwrap(),
                c["sanction"].as_str().unwrap_or(""),
            ],
        )
        .unwrap();
    }
}

pub fn list_servers(conn: &Connection) -> Vec<ServerInfo> {
    let mut stmt = conn.prepare("SELECT id, name, enabled FROM servers ORDER BY rowid").unwrap();
    stmt.query_map([], |r| {
        Ok(ServerInfo { id: r.get(0)?, name: r.get(1)?, enabled: r.get::<_, i64>(2)? != 0 })
    })
    .unwrap()
    .filter_map(|r| r.ok())
    .collect()
}

pub fn list_documents(conn: &Connection, server: &str) -> Vec<DocumentInfo> {
    let mut stmt = conn
        .prepare(
            "SELECT d.id, d.server, d.code, d.title, d.url, d.status, d.note, d.source_type,
                    (SELECT COUNT(*) FROM chunks c WHERE c.document_id = d.id)
             FROM documents d WHERE d.server = ?1 ORDER BY d.id",
        )
        .unwrap();
    stmt.query_map([server], |r| {
        Ok(DocumentInfo {
            id: r.get(0)?, server: r.get(1)?, code: r.get(2)?, title: r.get(3)?,
            url: r.get(4)?, status: r.get(5)?, note: r.get(6)?, source_type: r.get(7)?,
            chunk_count: r.get(8)?,
        })
    })
    .unwrap()
    .filter_map(|r| r.ok())
    .collect()
}

pub fn get_chunks(conn: &Connection, document_id: i64) -> Vec<ChunkInfo> {
    let mut stmt = conn
        .prepare("SELECT id, document_id, article_no, heading, text, sanction FROM chunks WHERE document_id = ?1 ORDER BY id")
        .unwrap();
    stmt.query_map([document_id], |r| {
        Ok(ChunkInfo {
            id: r.get(0)?, document_id: r.get(1)?, article_no: r.get(2)?,
            heading: r.get(3)?, text: r.get(4)?, sanction: r.get(5)?,
        })
    })
    .unwrap()
    .filter_map(|r| r.ok())
    .collect()
}

/// Полнотекстовый поиск (FTS5, движок BM25 — встроенное ранжирование по релевантности).
/// query — то, что напечатал пользователь. server — фильтр по серверу.
pub fn search(conn: &Connection, server: &str, query: &str) -> Vec<SearchHit> {
    if query.trim().is_empty() {
        return vec![];
    }
    // Простая, безопасная сборка FTS-запроса: каждое слово ищем с "*" (по началу слова).
    let fts_query: String = query
        .split_whitespace()
        .map(|w| format!("{}*", w.replace('"', "")))
        .collect::<Vec<_>>()
        .join(" OR ");

    let mut stmt = conn
        .prepare(
            r#"
            SELECT c.id, c.document_id, c.article_no, c.heading, c.text, c.sanction,
                   d.title, d.status, fts.rank
            FROM chunks_fts fts
            JOIN chunks c ON c.id = fts.rowid
            JOIN documents d ON d.id = c.document_id
            WHERE chunks_fts MATCH ?1 AND d.server = ?2
            ORDER BY fts.rank
            LIMIT 30
            "#,
        )
        .unwrap();

    stmt.query_map(rusqlite::params![fts_query, server], |r| {
        Ok(SearchHit {
            chunk: ChunkInfo {
                id: r.get(0)?, document_id: r.get(1)?, article_no: r.get(2)?,
                heading: r.get(3)?, text: r.get(4)?, sanction: r.get(5)?,
            },
            document_title: r.get(6)?,
            document_status: r.get(7)?,
            rank: r.get(8)?,
        })
    })
    .unwrap()
    .filter_map(|r| r.ok())
    .collect()
}
