import { useState } from 'react';
import type { SearchHit } from '../core';
import { AiTabs, citedIn, type AiTab } from './AiView';
import { BackIcon, CheckIcon, CloseIcon, WarnIcon } from './icons';
import { SIDES, type RoleplayCheck } from './rpcheck';

/** «Проверка отыгровки»: a piece of the chat in, a list of what was right and what was missed out. */
export function CheckView({
  checker,
  backLabel,
  onBack,
  onOpen,
  onTab,
}: {
  checker: RoleplayCheck;
  backLabel: string;
  onBack: () => void;
  onOpen: (hit: SearchHit) => void;
  onTab: (tab: AiTab) => void;
}) {
  const [log, setLog] = useState('');
  const result = checker.result;

  return (
    <section className="art ai check" aria-label="Проверка отыгровки">
      <div className="ai__top">
        <button className="back" type="button" onClick={onBack}>
          <BackIcon />
          <span>{backLabel}</span>
        </button>
        <span className="sp" />
        {result && (
          <button
            className="link-btn"
            type="button"
            onClick={() => {
              checker.reset();
              setLog('');
            }}
          >
            Проверить другую
          </button>
        )}
      </div>
      <AiTabs tab="check" onTab={onTab} />

      {!result && (
        <>
          <div className="set__row">
            <span className="set__label">Чья отыгровка</span>
            <span className="sp" />
            <div className="tabs" role="radiogroup" aria-label="Чья отыгровка">
              {SIDES.map((side) => (
                <button
                  key={side.id}
                  type="button"
                  role="radio"
                  aria-checked={checker.side === side.id}
                  className={checker.side === side.id ? 'tabs__btn tabs__btn--on' : 'tabs__btn'}
                  onClick={() => checker.setSide(side.id)}
                >
                  {side.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            className="doc__edit check__log"
            aria-label="Отыгровка из чата"
            rows={8}
            placeholder={'/me достал наручники и надел на задержанного\n— Вы задержаны, пройдёмте в машину.'}
            value={log}
            onChange={(e) => setLog(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') e.stopPropagation();
              // Ctrl+Enter checks; Enter alone is a new line of the chat.
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void checker.check(log);
              }
            }}
          />
          <div className="set__row">
            <button className="btn btn--primary" type="button" disabled={!log.trim() || checker.busy} onClick={() => void checker.check(log)}>
              Проверить
            </button>
            <span className="set__hint">Вставьте кусок чата: /me, /do и реплики. Ctrl + Enter — проверить.</span>
          </div>
        </>
      )}

      {checker.busy && (
        <div className="ai__pending" role="status">
          <span className="ai__dots" aria-hidden="true" />
          Ищу статьи о порядке действий и сверяю отыгровку…
        </div>
      )}

      {checker.error && (
        <div className="warn" role="alert">
          <WarnIcon />
          <span>{checker.error}</span>
        </div>
      )}

      {result && (
        <>
          <pre className="check__quote">{result.log}</pre>
          {result.summary && <p className="quiz__question">{result.summary}</p>}
          <ul className="check__items">
            {result.items.map((item, i) => {
              const cited = citedIn(item.text, result.sources);
              return (
                <li key={i} className={item.ok ? 'check__item check__item--ok' : 'check__item check__item--miss'}>
                  <span className="check__mark" aria-label={item.ok ? 'Верно' : 'Пропущено'}>
                    {item.ok ? <CheckIcon size={16} /> : <CloseIcon size={16} />}
                  </span>
                  {cited ? (
                    <button type="button" className="ai__cite" title="Открыть статью" onClick={() => onOpen(cited)}>
                      {item.text}
                    </button>
                  ) : (
                    <span>{item.text}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="set__hint">ИИ может ошибиться: откройте статьи по ссылкам и проверьте сами.</p>
        </>
      )}
    </section>
  );
}
