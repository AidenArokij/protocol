import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { articleHeading, formatPunishment, searchArticles, type SearchHit, type ServerPack } from '../core';
import { packFor } from '../data';
import type { PinLook, QuickBridge } from '../platform/types';
import { applyAppearance, isTheme } from './appearance';
import { BackIcon, CheckIcon, CloseIcon, SearchIcon, SparkIcon } from './icons';
import { isNewer, readPack } from './laws';
import { DocBadge, Stars } from './lawBits';
import { PROFILE_KEY, type Profile } from './profile';
import { ResultRow } from './ResultRow';
import { entryPart, hitKey } from './saved';

/** How many results the bar shows under the field. */
const SHOWN = 8;
/** The theme and accent of the overlay, as the pinned cards get them. */
const LOOK_KEY = 'pin.look';

type Mode = 'laws' | 'ai';

/** An article opened in the bar: its heading, then each part with its punishment and its «+». */
function QuickArticle({ hit, added, onCharge, onBack }: { hit: SearchHit; added: (key: string) => boolean; onCharge: (hit: SearchHit) => void; onBack: () => void }) {
  const { article, document } = hit;
  return (
    <article className="quick__article" aria-label={articleHeading(article, document.unit)}>
      <button className="back" type="button" onClick={onBack}>
        <BackIcon />
        <span>Результаты</span>
      </button>
      <h2 className="quick__title">
        <DocBadge document={document} /> {articleHeading(article, document.unit)}
      </h2>
      {article.parts.map((part, i) => {
        const partHit = { ...hit, part };
        const key = hitKey(partHit);
        return (
          <section key={part.number ?? `#${i}`} className={part === hit.part ? 'quick__part quick__part--focus' : 'quick__part'}>
            <p className="quick__text">
              {part.number && <b>{part.number}. </b>}
              {part.text}
            </p>
            {part.punishment && (
              <div className="quick__pen">
                {part.stars && <Stars stars={part.stars} />}
                <span>{formatPunishment(part.punishment)}</span>
                <span className="sp" />
                <button className="settings__button" type="button" disabled={added(key)} onClick={() => onCharge(partHit)}>
                  {added(key) ? 'В калькуляторе' : 'В калькулятор'}
                </button>
              </div>
            )}
          </section>
        );
      })}
    </article>
  );
}

/**
 * The quick search (ticket 27): a bar of its own at the top centre of the screen, opened by its own key over
 * the game. The laws of the player's server, results under the field; → opens an article in the bar, Enter
 * puts it into the assistant's calculator; Tab turns the field to the AI, whose question the assistant answers.
 * Esc steps back, then hides the bar.
 */
export function QuickSearch({ bridge }: { bridge: QuickBridge }) {
  const [organization, setOrganization] = useState<string | undefined>();
  const [pack, setPack] = useState<ServerPack>(() => packFor('tverskoi'));
  const [mode, setMode] = useState<Mode>('laws');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState<SearchHit | null>(null);
  /** What went into the calculator since the bar was shown. */
  const [sent, setSent] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);

  // The window as tall as the bar and what it shows under it.
  useEffect(() => {
    const element = root.current;
    if (!element || !bridge.fit || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => bridge.fit?.(Math.ceil(element.getBoundingClientRect().height) + 2));
    observer.observe(element);
    return () => observer.disconnect();
  }, [bridge]);

  // Each time it is shown: the player's server and faction and the look as they are now, an empty field.
  const load = useCallback(async () => {
    const [profile, look] = await Promise.all([bridge.readSetting<Profile>(PROFILE_KEY), bridge.readSetting<PinLook>(LOOK_KEY)]);
    if (look) applyAppearance(isTheme(look.theme) ? look.theme : 'glass', look.hue);
    const id = profile?.server ?? 'tverskoi';
    setOrganization(profile?.organization);
    const bundled = packFor(id);
    const kept = readPack(await bridge.readLaws(id).catch(() => undefined), id);
    setPack(kept && isNewer(kept, bundled) ? kept : bundled);
  }, [bridge]);
  useEffect(() => {
    const reset = () => {
      setMode('laws');
      setQuery('');
      setSelected(0);
      setOpen(null);
      setSent([]);
      input.current?.focus();
      void load();
    };
    reset();
    return bridge.onShown(reset);
  }, [bridge, load]);

  const boostDocuments = pack.organizations.find((o) => o.id === organization)?.documents;
  const hits = useMemo(
    () => (mode === 'laws' && query.trim() ? searchArticles(pack, query, { boostDocuments }).slice(0, SHOWN) : []),
    [pack, query, mode, boostDocuments],
  );
  const current = Math.min(selected, hits.length - 1);
  const punished = (hit: SearchHit) => !!entryPart(hit.article, hit.part)?.punishment;

  const charge = (hit: SearchHit) => {
    const key = hitKey({ ...hit, part: entryPart(hit.article, hit.part) });
    if (sent.includes(key)) return;
    setSent((list) => [...list, key]);
    void bridge.request({ kind: 'charge', key });
    input.current?.focus();
  };
  const ask = () => {
    const question = query.trim();
    if (!question) return;
    void bridge.request({ kind: 'ask', question }).then(() => bridge.hide());
  };

  // Esc on the window, not the field: a button just clicked has the focus. It steps back, then hides the bar.
  const back = useRef<() => void>(() => {});
  back.current = () => {
    if (open) setOpen(null);
    else void bridge.hide();
    input.current?.focus();
  };
  useEffect(() => {
    const onEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      back.current();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      setMode((m) => (m === 'laws' ? 'ai' : 'laws'));
      setOpen(null);
      return;
    }
    if (mode === 'ai') {
      if (e.key === 'Enter') {
        e.preventDefault();
        ask();
      }
      return;
    }
    // In an article, Enter puts the part it was opened at into the calculator.
    if (open) {
      if (e.key === 'Enter' && punished(open)) {
        e.preventDefault();
        charge(open);
      }
      return;
    }
    if (!hits.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(Math.min(current + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(Math.max(current - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = hits[current];
      if (punished(hit)) charge(hit);
      else setOpen(hit);
    } else if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length) {
      e.preventDefault();
      setOpen(hits[current]);
    }
  };

  return (
    <div className="quick glass" role="dialog" aria-label="Быстрый поиск" ref={root}>
      <div className="quick__bar">
        {mode === 'ai' ? <SparkIcon size={20} /> : <SearchIcon />}
        <input
          ref={input}
          className="quick__input"
          type="search"
          aria-label={mode === 'ai' ? 'Вопрос ИИ' : 'Быстрый поиск по законам'}
          placeholder={mode === 'ai' ? 'Опишите ситуацию — ответит ИИ в ассистенте' : `Поиск: ${pack.server.name}`}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
            setOpen(null);
          }}
          onKeyDown={onKey}
        />
        <div className="seg seg--sm quick__mode" role="radiogroup" aria-label="Где искать">
          {(['laws', 'ai'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => {
                setMode(m);
                setOpen(null);
                input.current?.focus();
              }}
            >
              {m === 'laws' ? 'Законы' : 'ИИ'}
            </button>
          ))}
        </div>
        <button className="icon-btn icon-btn--sm" type="button" aria-label="Закрыть" title="Закрыть (Esc)" onClick={() => void bridge.hide()}>
          <CloseIcon size={16} />
        </button>
      </div>

      {open ? (
        <div className="quick__body">
          <QuickArticle
            hit={open}
            added={(key) => sent.includes(key)}
            onCharge={charge}
            onBack={() => {
              setOpen(null);
              input.current?.focus();
            }}
          />
        </div>
      ) : mode === 'ai' ? (
        <p className="quick__hint">
          Enter — вопрос уйдёт ИИ, ответ откроется в ассистенте. <kbd>Tab</kbd> — обратно к законам.
        </p>
      ) : hits.length > 0 ? (
        <div className="quick__body">
          <div className="list" role="list" aria-label="Результаты быстрого поиска">
            {hits.map((hit, i) => (
              <div role="listitem" key={hitKey(hit)}>
                <ResultRow
                  hit={hit}
                  selected={i === current}
                  onOpen={() => setOpen(hit)}
                  calculator={
                    punished(hit)
                      ? { added: sent.includes(hitKey({ ...hit, part: entryPart(hit.article, hit.part) })), onToggle: () => charge(hit) }
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        query.trim() && <p className="quick__hint">Ничего не нашлось. <kbd>Tab</kbd> — спросить ИИ.</p>
      )}

      <div className="quick__foot">
        {mode === 'laws' && !open && (
          <>
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> выбор
            </span>
            <span>
              <kbd>→</kbd> открыть
            </span>
          </>
        )}
        <span>
          <kbd>Enter</kbd> {mode === 'ai' ? 'спросить ИИ' : 'в калькулятор'}
        </span>
        <span>
          <kbd>Tab</kbd> {mode === 'ai' ? 'законы' : 'ИИ'}
        </span>
        <span>
          <kbd>Esc</kbd> {open ? 'назад' : 'закрыть'}
        </span>
        {sent.length > 0 && (
          <span className="quick__sent">
            <CheckIcon size={14} /> В калькуляторе: {sent.length} — откройте ассистент
          </span>
        )}
      </div>
    </div>
  );
}
