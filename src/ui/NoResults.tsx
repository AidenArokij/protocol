import type { EmptySearch, Try } from '../core';

/**
 * A search that found nothing (roadmap 1В): where and by what it looked, and what to try instead — worked
 * out from the laws alone, each try known to find something. Compact over the game: one line and the tries.
 */
export function NoResults({ empty, onTry, compact = false }: { empty: EmptySearch; onTry: (to: Try) => void; compact?: boolean }) {
  const where = empty.scope ? `в «${empty.scope.short}»` : `в ${empty.documents} документах`;
  const missing = empty.words.filter((w) => !w.known).map((w) => w.word);
  const asked = [
    ...(empty.number ? [`ст. ${empty.number}${empty.part ? ` ч. ${empty.part}` : ''}`] : []),
    ...empty.words.map((w) => w.word),
  ];
  return (
    <div className={compact ? 'why why--compact' : 'why'} role="status" aria-label="Ничего не найдено">
      <div className="why__title">Ничего не найдено {where}</div>
      {!compact && asked.length > 0 && (
        <div className="why__line">
          Искали: {asked.join(', ')}
          {missing.length > 0 && (
            <span className="why__miss">
              {' '}
              · {missing.length === 1 ? `слова «${missing[0]}» нет в законах` : `слов ${missing.map((w) => `«${w}»`).join(', ')} нет в законах`}
            </span>
          )}
        </div>
      )}
      {empty.tries.length > 0 && (
        <div className="why__tries" role="group" aria-label="Попробуйте">
          <span className="why__label">Попробуйте:</span>
          {empty.tries.map((to) => (
            <button key={to.query + to.label} className="tag" type="button" onClick={() => onTry(to)}>
              {to.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
