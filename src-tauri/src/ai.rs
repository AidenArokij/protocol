// ai.rs — обращение к Gemini поверх того, что реально нашлось в базе.
//
// Важно: сюда попадают ТОЛЬКО статьи, которые уже нашёл обычный поиск
// (db::search, FTS5). Модель не видит "всю базу целиком" и не может
// сослаться на то, чего мы ей не передали, — это и есть механическая
// защита от выдумывания статей, а не просто просьба в тексте промпта.

use crate::db::SearchHit;
use serde::{Deserialize, Serialize};

const MODEL: &str = "gemini-2.5-flash";

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<Content>,
    #[serde(rename = "systemInstruction")]
    system_instruction: Content,
}

#[derive(Serialize, Deserialize)]
struct Content {
    parts: Vec<Part>,
}

#[derive(Serialize, Deserialize)]
struct Part {
    text: String,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<Candidate>>,
    error: Option<GeminiError>,
}

#[derive(Deserialize)]
struct Candidate {
    content: Content,
}

#[derive(Deserialize)]
struct GeminiError {
    message: String,
}

fn build_system_prompt() -> String {
    "Ты — юридический помощник «ПРОТОКОЛ» для игрового RP-сервера Russia Online (GTA 5 RP). \
Тебе передают вопрос игрока и список статей, найденных обычным поиском по базе законов сервера. \
\n\nСТРОГИЕ ПРАВИЛА:\n\
1. Отвечай ТОЛЬКО на основе переданных ниже источников. Никогда не придумывай статьи, номера пунктов, санкции или факты, которых нет в переданном тексте.\n\
2. Если среди источников нет ответа на вопрос — прямо и честно напиши: «В доступной базе ПРОТОКОЛА точного положения по этому вопросу не найдено».\n\
3. Если найдено что-то похожее по смыслу, но не отвечает на вопрос напрямую — так и скажи: «Найдено близкое по смыслу положение, но оно не подтверждает ситуацию напрямую», и объясни, в чём разница.\n\
4. Обязательно указывай статус каждого источника, на который ссылаешься (он передан в квадратных скобках перед статьёй) — «Проверено» или «Требует проверки». Если статус «Требует проверки» — предупреди, что это не подтверждено официальным источником.\n\
5. Отвечай по-русски, адаптивно: не пиши раздел, если для него нечего сказать (например, не пиши «ЧТО НЕЛЬЗЯ», если запрета в источниках нет).\n\
\nФормат ответа:\n\
КРАТКО: (главный вывод в 1-2 предложениях)\n\
ПОЧЕМУ: (какие положения источников относятся к вопросу)\n\
ЧТО МОЖНО: (только подтверждённые источниками действия)\n\
ЧТО НЕЛЬЗЯ: (только если запрет реально найден в источниках)\n\
ИСТОЧНИКИ: (документ, статья, статус)".to_string()
}

fn build_user_message(question: &str, hits: &[SearchHit]) -> String {
    if hits.is_empty() {
        return format!(
            "Вопрос игрока: {}\n\nПоиск по базе не нашёл ни одной статьи по этому запросу. \
             Источников нет вообще — сообщи об этом честно, ничего не придумывай.",
            question
        );
    }
    let mut sources = String::new();
    for h in hits.iter().take(10) {
        sources.push_str(&format!(
            "[{}] {} — ст.{} «{}»\nТекст: {}\nСанкция: {}\n\n",
            h.document_status,
            h.document_title,
            h.chunk.article_no,
            h.chunk.heading,
            h.chunk.text,
            h.chunk.sanction
        ));
    }
    format!(
        "Вопрос игрока: {}\n\nНайденные поиском источники (используй только их):\n\n{}",
        question, sources
    )
}

pub async fn ask_gemini(api_key: &str, question: &str, hits: &[SearchHit]) -> Result<String, String> {
    let body = GeminiRequest {
        system_instruction: Content { parts: vec![Part { text: build_system_prompt() }] },
        contents: vec![Content { parts: vec![Part { text: build_user_message(question, hits) }] }],
    };

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        MODEL, api_key
    );

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Не удалось связаться с Gemini (проверьте интернет): {}", e))?;

    let status = resp.status();
    let parsed: GeminiResponse = resp
        .json()
        .await
        .map_err(|e| format!("Gemini прислал неожиданный ответ (код {}): {}", status, e))?;

    if let Some(err) = parsed.error {
        return Err(format!("Gemini вернул ошибку: {}", err.message));
    }

    let text = parsed
        .candidates
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.content.parts.into_iter().next())
        .map(|p| p.text)
        .ok_or_else(|| "Gemini прислал пустой ответ.".to_string())?;

    Ok(text)
}
