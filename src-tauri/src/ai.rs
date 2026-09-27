// ai.rs — обращение к Gemini поверх того, что реально нашлось в базе.
//
// Важно: сюда попадают ТОЛЬКО статьи, которые уже нашёл обычный поиск
// (db::search, FTS5). Модель не видит "всю базу целиком" и не может
// сослаться на то, чего мы ей не передали, — это и есть механическая
// защита от выдумывания статей, а не просто просьба в тексте промпта.

use crate::db::SearchHit;
use serde::{Deserialize, Serialize};

const MODEL: &str = "gemini-3.8-flash";

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

fn perspective_block(perspective: &str) -> &'static str {
    match perspective {
        "state" => "\n\nПЕРСПЕКТИВА — ГОСУДАРСТВО (сотрудник МВД/госслужащий): смотри на ситуацию со стороны сотрудника. Разбери: какие у него полномочия и основания для действий в этой ситуации; какой порядок процедуры предусмотрен; какие ограничения на него накладываются; что он обязан сделать; не превышает ли он полномочия и какие нарушения возможны с его стороны.",
        "citizen" => "\n\nПЕРСПЕКТИВА — ГРАЖДАНСКИЙ: смотри на ситуацию со стороны обычного игрока-гражданина. Разбери: какие у него права в этой ситуации; что от него законно требуют; обязан ли он это выполнять; какие действия другой стороны он вправе проверить/оспорить; как ему корректно продолжить RP.",
        "lawyer" => "\n\nПЕРСПЕКТИВА — АДВОКАТ: смотри на ситуацию со стороны защитника. Разбери: соблюдена ли законность процедуры; какие права доверителя могли быть затронуты; были ли основания для действий другой стороны; что именно стоит проверить или потребовать; что можно обжаловать, если это подтверждается источниками — не выдумывай нарушения, которых не видно из переданного текста.",
        "crime" => "\n\nПЕРСПЕКТИВА — КРИМИНАЛ: смотри на ситуацию со стороны игрока-преступника. Разбери: какие риски у него в этой ситуации; какие статьи к нему могут применить; какие у него есть RP-варианты поведения дальше. Не поощряй и не оправдывай преступление — только опиши правовые последствия и варианты по фактам.",
        _ => "",
    }
}

fn build_system_prompt(perspective: &str) -> String {
    let base = "Ты — юридический ассистент «ПРОТОКОЛ» для игрового RP-сервера Russia Online (GTA 5 RP, сервер Тверской). \
У сервера полностью вымышленное законодательство РО — оно НЕ совпадает с реальным законодательством РФ.\n\n\
ФОРМАТ ОТВЕТА (только для вопросов по законам/правилам сервера или RP-ситуациям):\n\
• Суть: одна короткая фраза — что происходит и главный вывод\n\
• Статья: конкретный документ и номер статьи ИЗ источников ниже, с пометкой её статуса (Проверено / Требует проверки); если среди источников нет ничего по делу — прямо напиши «в базе ПРОТОКОЛА не найдено»\n\
• Детали: 1-2 предложения, что это значит на практике, только на основе текста источника\n\n\
Если сообщение не является вопросом по законам/RP-ситуации (приветствие, светская беседа, вопрос о тебе самом) — отвечай обычным коротким текстом без этого формата, не притягивай к нему закон.\n\n\
СТРОГИЕ ПРАВИЛА:\n\
1. Никогда не ссылайся на реальное законодательство (ТК РФ, КоАП РФ, УК РФ, ГК РФ и т.д.) — используй только источники, переданные тебе ниже.\n\
2. Никогда не придумывай статьи, номера пунктов, санкции, которых нет в переданном тексте.\n\
3. Если источников нет вообще — честно скажи об этом, не подставляй похожий по названию реальный закон.\n\
4. Если источник похож по смыслу, но не отвечает на вопрос напрямую — так и скажи в «Деталях».\n\
5. Всегда указывай статус источника, если на него ссылаешься.";
    format!("{}{}", base, perspective_block(perspective))
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

pub async fn ask_gemini(api_key: &str, question: &str, hits: &[SearchHit], perspective: &str) -> Result<String, String> {
    let body = GeminiRequest {
        system_instruction: Content { parts: vec![Part { text: build_system_prompt(perspective) }] },
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
