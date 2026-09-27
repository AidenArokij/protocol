// The AI analysis of a situation: Gemini reads only the articles the search found in the server's laws.
// It never sees the whole pack, so it cannot cite an article it was not given — that is the guard against
// made-up laws, not a request in the prompt alone.
import { useCallback, useRef, useState } from 'react';
import { findForSituation, sourcesText, type SearchHit, type ServerPack } from '../core';
import type { PlatformAdapter } from '../platform/types';

/** The player's own Gemini key, in the settings file on this computer. */
export const AI_KEY_SETTING = 'ai.key';
export const AI_KEY_URL = 'https://aistudio.google.com/apikey';

/** If the first model is overloaded, the next one is asked, without troubling the player. */
const MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
const API = 'https://generativelanguage.googleapis.com/v1beta/models';
/** Articles given to the AI for one question. */
const SOURCES = 14;
/** Earlier questions and answers sent along, so a follow-up («а если он в маске?») is understood. */
const HISTORY_TURNS = 6;

export type Perspective = 'state' | 'citizen' | 'lawyer' | 'crime';

export const PERSPECTIVES: { id: Perspective; label: string }[] = [
  { id: 'state', label: 'Государство' },
  { id: 'citizen', label: 'Гражданский' },
  { id: 'lawyer', label: 'Адвокат' },
  { id: 'crime', label: 'Крайм' },
];

const PERSPECTIVE_PROMPTS: Record<Perspective, string> = {
  state:
    'ПЕРСПЕКТИВА — ГОСУДАРСТВО (сотрудник МВД/госслужащий): какие у него полномочия и основания для действий; какой порядок процедуры; какие ограничения; что он обязан сделать; не превышает ли он полномочия.',
  citizen:
    'ПЕРСПЕКТИВА — ГРАЖДАНСКИЙ: какие у игрока права; что от него законно требуют; обязан ли он это выполнять; что он вправе проверить или оспорить; как корректно продолжить RP.',
  lawyer:
    'ПЕРСПЕКТИВА — АДВОКАТ: соблюдена ли законность процедуры; какие права доверителя затронуты; были ли основания у другой стороны; что проверить или потребовать; что можно обжаловать — только если это видно из источников, не выдумывай нарушений.',
  crime:
    'ПЕРСПЕКТИВА — КРАЙМ: какие риски у игрока-преступника; какие статьи к нему могут применить; какие RP-варианты у него дальше. Не поощряй и не оправдывай преступление — только правовые последствия по фактам.',
};

function systemPrompt(pack: ServerPack, perspective?: Perspective): string {
  return [
    `Ты — юридический ассистент для игрового RP-сервера Russia Online (GTA 5 RP), сервер «${pack.server.name}». У сервера своё вымышленное законодательство — оно НЕ совпадает с законами РФ.`,
    'ФОРМАТ ОТВЕТА на вопрос по законам или RP-ситуации:\nСуть: одна-две фразы — что происходит и главный вывод.\nСтатьи: каждая применимая статья отдельной строкой, начиная с «- », в точности как она подписана в источниках (например «- УК ст. 65 «Кража» — почему подходит»).\nДетали: 1–3 предложения, что это значит на практике, только по тексту источников.',
    'Если сообщение не вопрос по законам (приветствие, вопрос о тебе) — ответь коротко обычным текстом, без формата.',
    'СТРОГИЕ ПРАВИЛА:\n1. Используй только источники из сообщения игрока. Никогда не ссылайся на законы РФ (УК РФ, КоАП РФ и т.д.).\n2. Не придумывай статьи, части, санкции и номера, которых нет в источниках.\n3. Если среди источников нет ничего по делу — прямо напиши «В законах сервера по этой ситуации ничего не нашлось» и посоветуй, какими словами поискать.\n4. Если статья подходит лишь частично — так и скажи в «Деталях».\n5. Наказание называй только так, как оно записано в источнике.',
    perspective ? PERSPECTIVE_PROMPTS[perspective] : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

const TERMS_PROMPT =
  'Игрок описал ситуацию на RP-сервере своими словами. Перескажи её 4–8 короткими поисковыми фразами (2–4 слова) на языке законов: юридические термины, названия правонарушений, участники, предметы («незаконное ношение оружия», «сокрытие лица», «неповиновение сотруднику полиции»). Не называй номеров статей и названий законов. Ответь только JSON-массивом строк.';

interface GeminiTurn {
  role: 'user' | 'model';
  parts: { text: string }[];
}

class AiError extends Error {
  constructor(
    message: string,
    readonly overloaded = false,
  ) {
    super(message);
  }
}

async function generate(key: string, model: string, system: string, contents: GeminiTurn[], json = false): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${API}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
      }),
    });
  } catch {
    throw new AiError('Нет связи с Gemini — проверьте интернет.');
  }
  const body = (await response.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string; status?: string };
  } | null;
  if (!response.ok || body?.error) {
    const message = body?.error?.message ?? `код ${response.status}`;
    const overloaded = response.status === 503 || response.status === 429 || /overload|high demand|unavailable/i.test(message);
    if (/api key not valid|API_KEY_INVALID/i.test(message)) throw new AiError('Ключ Gemini не подходит. Проверьте его в настройках.');
    throw new AiError(`Gemini вернул ошибку: ${message}`, overloaded);
  }
  const text = body?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  if (!text.trim()) throw new AiError('Gemini прислал пустой ответ.');
  return text;
}

/** Asks the models in turn while they are overloaded. */
async function ask(key: string, system: string, contents: GeminiTurn[], json = false): Promise<string> {
  let last: unknown;
  for (const model of MODELS) {
    try {
      return await generate(key, model, system, contents, json);
    } catch (error) {
      last = error;
      if (!(error instanceof AiError && error.overloaded)) throw error;
    }
  }
  throw new AiError(`Все модели Gemini сейчас перегружены. ${last instanceof Error ? last.message : ''}`.trim());
}

/** The situation in the words of the law, for the search; nothing when the AI could not say. */
async function lawTerms(key: string, situation: string): Promise<string[]> {
  try {
    const text = await ask(key, TERMS_PROMPT, [{ role: 'user', parts: [{ text: situation }] }], true);
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 10) : [];
  } catch {
    // The search still has the situation's own words.
    return [];
  }
}

export interface AiMessage {
  id: number;
  role: 'user' | 'ai';
  text: string;
  perspective?: Perspective;
  /** What the answer stands on: the articles given to the AI. */
  sources?: SearchHit[];
  /** The AI could not answer: the text says why. */
  failed?: boolean;
  pending?: boolean;
}

export interface AiChat {
  messages: AiMessage[];
  busy: boolean;
  /** Asks about a situation, or the last one again from a side. */
  send: (text: string, perspective?: Perspective) => Promise<void>;
  clear: () => void;
}

/** The conversation with the AI, kept while the overlay lives: going to an article and back keeps it. */
export function useAiChat(platform: PlatformAdapter, pack: ServerPack, boostDocuments?: string[]): AiChat {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const current = useRef(messages);
  current.current = messages;

  const send = useCallback(
    async (text: string, perspective?: Perspective) => {
      const question = text.trim();
      if (!question || busy) return;
      const asked: AiMessage = { id: nextId.current++, role: 'user', text: question, perspective };
      const answerId = nextId.current++;
      const earlier = current.current.filter((m) => !m.pending && !m.failed);
      setMessages((list) => [...list, asked, { id: answerId, role: 'ai', text: '', pending: true }]);
      setBusy(true);
      const finish = (patch: Partial<AiMessage>) =>
        setMessages((list) => list.map((m) => (m.id === answerId ? { ...m, pending: false, ...patch } : m)));
      try {
        const key = (await platform.readSetting<string>(AI_KEY_SETTING))?.trim();
        if (!key) {
          finish({ failed: true, text: 'Сначала вставьте ключ Gemini в настройках (⚙ → «ИИ-разбор»). Он бесплатный.' });
          return;
        }
        // A follow-up leans on the question before it: both go into the search.
        const previous = [...earlier].reverse().find((m) => m.role === 'user')?.text ?? '';
        const context = perspective ? question : `${previous}\n${question}`.trim();
        const terms = await lawTerms(key, context);
        const sources = findForSituation(pack, context, { boostDocuments, lawTerms: terms, limit: SOURCES });
        const history: GeminiTurn[] = earlier.slice(-HISTORY_TURNS * 2).map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }],
        }));
        const prompt = sources.length
          ? `Вопрос игрока: ${question}\n\nНайденные в законах сервера источники (используй только их):\n\n${sourcesText(sources)}`
          : `Вопрос игрока: ${question}\n\nПоиск по законам сервера ничего не нашёл. Источников нет — скажи об этом честно, ничего не придумывай.`;
        const answer = await ask(key, systemPrompt(pack, perspective), [...history, { role: 'user', parts: [{ text: prompt }] }]);
        finish({ text: answer.trim(), sources, perspective });
      } catch (error) {
        finish({ failed: true, text: error instanceof Error ? error.message : String(error) });
      } finally {
        setBusy(false);
      }
    },
    [busy, platform, pack, boostDocuments],
  );

  const clear = useCallback(() => setMessages([]), []);
  return { messages, busy, send, clear };
}
