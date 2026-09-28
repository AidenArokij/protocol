// Checking a roleplay: the player pastes a piece of the game chat (/me, /do, what was said), and the AI tells
// what was done by the procedure and what was missed — only by the articles the search found in the server's laws.
import { useCallback, useState } from 'react';
import { findForSituation, sourcesText, type SearchHit, type ServerPack } from '../core';
import type { PlatformAdapter } from '../platform/types';
import { AI_KEY_SETTING, AiError, NO_KEY, SOURCES, ask, lawTerms } from './ai';

export type Side = 'officer' | 'citizen';

export const SIDES: { id: Side; label: string; prompt: string }[] = [
  {
    id: 'officer',
    label: 'Сотрудник',
    prompt: 'Проверяется отыгровка сотрудника государственной организации: соблюдён ли порядок действий, названы ли основания, разъяснены ли права, не превышены ли полномочия.',
  },
  {
    id: 'citizen',
    label: 'Гражданский',
    prompt: 'Проверяется отыгровка гражданина: выполнил ли он законные требования, воспользовался ли своими правами, не нарушил ли он сам закон.',
  },
];

export interface CheckItem {
  ok: boolean;
  text: string;
}

export interface CheckResult {
  log: string;
  summary: string;
  items: CheckItem[];
  sources: SearchHit[];
}

const PROMPT = (pack: ServerPack, side: (typeof SIDES)[number]) =>
  [
    `Ты проверяешь RP-отыгровку на игровом сервере Russia Online (GTA 5 RP), сервер «${pack.server.name}». Законы сервера вымышленные и не совпадают с законами РФ.`,
    side.prompt,
    'Игрок прислал кусок игрового чата: /me — действия, /do — обстановка, остальное — реплики. Разбери по шагам, что сделано по закону, а что пропущено или сделано неправильно.',
    'СТРОГИЕ ПРАВИЛА: опирайся только на статьи из источников в сообщении и ссылайся на них в точности как они подписаны (например «6-ФЗ ст. 14»). Не придумывай требований, которых нет в источниках; если по какому-то шагу в источниках ничего нет — не упоминай его. Никаких законов РФ.',
    'Ответь JSON: {"summary": "одна фраза — общий вывод", "items": [{"ok": true, "text": "что сделано верно — со ссылкой на статью"}, {"ok": false, "text": "что пропущено или неверно и как надо — со ссылкой на статью"}]}. От 2 до 6 пунктов, сначала верные.',
  ].join('\n\n');

export interface RoleplayCheck {
  side: Side;
  setSide: (side: Side) => void;
  busy: boolean;
  result: CheckResult | null;
  error: string | null;
  check: (log: string) => Promise<void>;
  reset: () => void;
}

export function useRoleplayCheck(platform: PlatformAdapter, pack: ServerPack, boostDocuments?: string[]): RoleplayCheck {
  const [side, setSide] = useState<Side>('officer');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(
    async (log: string) => {
      const text = log.trim();
      if (!text || busy) return;
      setBusy(true);
      setError(null);
      try {
        const key = (await platform.readSetting<string>(AI_KEY_SETTING))?.trim();
        if (!key) throw new AiError(NO_KEY);
        const who = SIDES.find((s) => s.id === side)!;
        // The chat's own words, and the procedure it is about, in the words of the law.
        const terms = await lawTerms(key, `${who.label}. ${text}`);
        const sources = findForSituation(pack, text, { boostDocuments, lawTerms: terms, limit: SOURCES });
        if (!sources.length) throw new AiError('В законах сервера не нашлось статей по этой отыгровке — проверить её не по чему.');
        const raw = await ask(
          key,
          PROMPT(pack, who),
          [{ role: 'user', parts: [{ text: `Отыгровка:\n${text}\n\nНайденные в законах сервера источники (используй только их):\n\n${sourcesText(sources)}` }] }],
          true,
        );
        const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|```\s*$/g, '')) as { summary?: string; items?: { ok?: boolean; text?: string }[] };
        const items = (parsed.items ?? []).filter((i) => i.text).map((i) => ({ ok: !!i.ok, text: i.text! }));
        if (!items.length) throw new AiError('ИИ не смог разобрать отыгровку — попробуйте вставить больше строк чата.');
        setResult({ log: text, summary: parsed.summary ?? '', items, sources });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [busy, platform, pack, boostDocuments, side],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { side, setSide, busy, result, error, check, reset };
}
