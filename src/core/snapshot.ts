import { articleText } from './changes';
import type { Article, ServerPack } from './model';

/** Moscow is three hours ahead of UTC all year: the day a pack was built is the day there, where the players are. */
const MOSCOW_MS = 3 * 60 * 60 * 1000;

/**
 * The version of a pack as people read it (roadmap 1Б): the day it was built — «2026.10.1» — or, for a pack the
 * importer never stamped, the day of its newest law edit. Two packs of one day read the same; what tells them
 * apart for the app is `built`.
 */
export function packLabel(pack: ServerPack): string {
  const at = Date.parse(pack.built ?? pack.version);
  if (Number.isNaN(at)) return '—';
  const day = new Date(at + MOSCOW_MS);
  return `${day.getUTCFullYear()}.${day.getUTCMonth() + 1}.${day.getUTCDate()}`;
}

/** FNV-1a, 32 bits, as eight hex digits. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** An article as it reads — its title, text, punishments and notes — in eight characters: changes when it does. */
export function articleFingerprint(article: Article): string {
  return fnv1a(`${article.title}\n${articleText(article)}`);
}

/** The laws something was worked out by: the pack, and how each article it rests on read then. */
export interface PackSnapshot {
  server: string;
  label: string;
  built?: string;
  /** Article id → its fingerprint. */
  articles: Record<string, string>;
}

function articlesById(pack: ServerPack, ids: Iterable<string>): Map<string, Article> {
  const wanted = new Set(ids);
  const found = new Map<string, Article>();
  for (const document of pack.documents) {
    for (const article of document.articles) if (wanted.has(article.id)) found.set(article.id, article);
  }
  return found;
}

/** A snapshot of the articles named, as the pack has them now; one it does not have is left out. */
export function snapshotOf(pack: ServerPack, articleIds: string[]): PackSnapshot {
  const articles: Record<string, string> = {};
  for (const [id, article] of articlesById(pack, articleIds)) articles[id] = articleFingerprint(article);
  return { server: pack.server.id, label: packLabel(pack), ...(pack.built ? { built: pack.built } : {}), articles };
}

/** What of a snapshot reads differently in the pack now, and what the pack no longer has. */
export function changedSince(pack: ServerPack, snapshot: PackSnapshot): { changed: string[]; gone: string[] } {
  const now = articlesById(pack, Object.keys(snapshot.articles));
  const changed: string[] = [];
  const gone: string[] = [];
  for (const [id, print] of Object.entries(snapshot.articles)) {
    const article = now.get(id);
    if (!article) gone.push(id);
    else if (articleFingerprint(article) !== print) changed.push(id);
  }
  return { changed, gone };
}
