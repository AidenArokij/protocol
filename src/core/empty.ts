import type { LawDocument, ServerPack } from './model';
import { PART_GLUED, PART_WORD, parseQuery, searchArticles, type SearchOptions } from './search';
import { cachedStem, distance, matchWord, wordIndex, words } from './wordIndex';

/** Something to search instead, which does find articles. */
export interface Try {
  query: string;
  /** How it reads on its button: the word offered, «без «…»», «во всех документах». */
  label: string;
  /** Leave the document the search was narrowed to. */
  everywhere?: true;
}

/**
 * What a search that found nothing looked through (roadmap 1В): the player sees where and by what it
 * searched, and what to try instead — worked out from the laws alone, never by the AI.
 */
export interface EmptySearch {
  /** How many documents were looked through: all of them, or the one the search was narrowed to. */
  documents: number;
  scope?: LawDocument;
  number?: string;
  part?: string;
  /** The words searched by; a word the laws hold nowhere — not with a typo, not as a synonym — is not known. */
  words: { word: string; known: boolean }[];
  /** At most three, the likeliest first; each one checked to find something. */
  tries: Try[];
}

const MOST_TRIES = 3;

/** The laws' words by stem, as first written: a stem is offered back as a word a player would type. */
const surfaces = new WeakMap<ServerPack, Map<string, string>>();
function surfaceOf(pack: ServerPack): Map<string, string> {
  let map = surfaces.get(pack);
  if (!map) {
    map = new Map();
    for (const document of pack.documents) {
      for (const article of document.articles) {
        for (const text of [article.title, ...article.parts.map((part) => part.text)]) {
          for (const word of words(text)) {
            const s = cachedStem(word);
            if (!map.has(s)) map.set(s, word);
          }
        }
      }
    }
    surfaces.set(pack, map);
  }
  return map;
}

/** The word of the laws nearest to one they do not hold: a few letters off, the same first letter, the commoner first. */
function nearestWord(pack: ServerPack, word: string): string | undefined {
  const index = wordIndex(pack);
  const limit = word.length >= 8 ? 3 : 2;
  let best: { word: string; distance: number; weight: number } | undefined;
  for (const [stem, surface] of surfaceOf(pack)) {
    if (surface[0] !== word[0]) continue;
    const d = distance(word, surface, limit);
    if (d > limit) continue;
    const weight = index.postings.get(stem)?.length ?? 0;
    if (!best || d < best.distance || (d === best.distance && weight > best.weight)) best = { word: surface, distance: d, weight };
  }
  return best?.word;
}

/** Why a query found nothing, and what would; null when it finds something or there is nothing to search by. */
export function explainEmpty(pack: ServerPack, raw: string, options: SearchOptions = {}): EmptySearch | null {
  if (!raw.trim() || searchArticles(pack, raw, options).length) return null;
  const query = parseQuery(pack, raw);
  if (!query.number && !query.words.length) return null;
  const scope = query.scope ?? pack.documents.find((d) => d.id === options.document);
  const index = wordIndex(pack);
  const known = (word: string) => {
    const matcher = matchWord(index, word, false);
    return matcher.stems.size > 0 || matcher.phrases.length > 0;
  };
  const found = query.words.map((word) => ({ word, known: known(word) }));

  const tokens = raw.toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean);
  const holds = (token: string, word: string) => words(token).includes(word);
  const tries: Try[] = [];
  const offer = (candidate: string[], label: string, everywhere = false) => {
    const text = candidate.join(' ');
    if (tries.length >= MOST_TRIES || !text || tries.some((t) => t.query === text)) return;
    const narrowed = everywhere ? { ...options, document: undefined } : options;
    if (!searchArticles(pack, text, narrowed).length) return;
    tries.push(everywhere ? { query: text, label, everywhere: true } : { query: text, label });
  };

  const unknown = found.filter((w) => !w.known).map((w) => w.word);
  for (const word of unknown) offer(tokens.filter((t) => !holds(t, word)), `без «${word}»`);
  for (const word of unknown) {
    const near = nearestWord(pack, word);
    if (near) offer(tokens.map((t) => (holds(t, word) ? near : t)), near);
  }
  if (scope) {
    const alias = query.scope ? tokens.filter((t) => !query.scope!.aliases.includes(t)) : tokens;
    offer(alias, 'во всех документах', true);
  }
  if (query.part) {
    const whole = tokens.filter((t, i) => !PART_GLUED.test(t) && !PART_WORD.test(t) && !(PART_WORD.test(tokens[i - 1] ?? '') && /^\d+$/.test(t)));
    offer(whole, `без «ч. ${query.part}»`);
  }
  // Every word is in the laws, only not all in one article: one of them less.
  for (const { word } of found.filter((w) => w.known)) if (found.length > 1) offer(tokens.filter((t) => !holds(t, word)), `без «${word}»`);

  return {
    documents: scope ? 1 : pack.documents.length,
    ...(scope ? { scope } : {}),
    ...(query.number ? { number: query.number } : {}),
    ...(query.part ? { part: query.part } : {}),
    words: found,
    tries,
  };
}
