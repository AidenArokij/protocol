import { useEffect, useRef, useState } from 'react';
import { changedArticles, recentChanges } from '../core';
import { packFor } from '../data';
import { CheckIcon, ChevronDownIcon } from './icons';
import { SERVERS } from './profile';

/** Articles changed this recently count as news in the list of servers. */
const NEWS_DAYS = 14;

/** A server's emblem: its first letter on the server's own colour. */
export function ServerEmblem({ id, name, size = 22 }: { id: string; name: string; size?: number }) {
  return (
    <span className="emblem" style={{ width: size, height: size, background: `var(--server-${id}, var(--surface-active))` }} aria-hidden="true">
      {name.charAt(0)}
    </span>
  );
}

/** «+3»: how many articles of a server's laws changed lately. */
function useNews(): Record<string, number> {
  // Counted once, when the menu first shows: today's date is read then, not at every render.
  const [news] = useState(() => {
    const now = new Date();
    return Object.fromEntries(
      SERVERS.filter((s) => s.status === 'active').map((s) => [s.id, changedArticles(recentChanges(packFor(s.id), now, NEWS_DAYS)).size]),
    );
  });
  return news;
}

/** The server in the header, and the list to switch it, as in the header of SinSet-like helpers. */
export function ServerMenu({ server, organization, onPick }: { server: string; organization?: string; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const news = useNews();
  const current = SERVERS.find((s) => s.id === server) ?? SERVERS[0];

  // A click anywhere else closes the list.
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', away);
    return () => window.removeEventListener('mousedown', away);
  }, [open]);

  return (
    <div
      className="srv"
      ref={rootRef}
      onKeyDown={(event) => {
        // Esc closes the list only, not the overlay behind it.
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className={open ? 'srv__btn srv__btn--open' : 'srv__btn'}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Сервер: ${organization ? `${current.name} · ${organization}` : current.name}`}
        title={organization ? `${current.name} · ${organization}` : current.name}
        onClick={() => setOpen((v) => !v)}
      >
        <ServerEmblem id={current.id} name={current.name} />
        <span className="srv__name">{current.name}</span>
        <ChevronDownIcon />
      </button>
      {open && (
        <ul className="srv__list" role="listbox" aria-label="Сервер">
          {SERVERS.map((choice) => {
            const count = news[choice.id] ?? 0;
            return (
              <li key={choice.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={choice.id === server}
                  disabled={choice.status !== 'active'}
                  className={choice.id === server ? 'srv__item srv__item--on' : 'srv__item'}
                  onClick={() => {
                    setOpen(false);
                    if (choice.id !== server) onPick(choice.id);
                  }}
                >
                  <ServerEmblem id={choice.id} name={choice.name} />
                  <span className="srv__item-name">{choice.name}</span>
                  <span className="sp" />
                  {count > 0 && (
                    <span className="srv__news" title={`Изменено статей за ${NEWS_DAYS} дней: ${count}`}>
                      +{count}
                    </span>
                  )}
                  {choice.status === 'soon' && <span className="srv__soon">скоро</span>}
                  <span className="srv__check">{choice.id === server && <CheckIcon size={16} />}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
