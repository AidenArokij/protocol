import type { Article } from '../core/model';
import type { ParsedLaw } from './lawText';

/**
 * Rules written as titled sections with no numbered points (the additional rules of each server: «Нападение на Форт»,
 * «AirDrop», «Правила перехвата поставок»). The forum marks a section's title with a zero-width space — at the end of
 * the title's own line or alone on the line right under it. Each section is an article numbered by its place, titled
 * by its title; its lines are its paragraphs, and what follows «|» on a line is a punishment (each told once).
 */

const MARK = /[​‌‍﻿]/;
const clean = (line: string) => line.replace(/[​‌‍﻿]/g, '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

export function parseSectionsText(text: string, documentId: string): ParsedLaw {
  const raw = text.split(/\r?\n/);
  const articles: Article[] = [];
  const header: string[] = [];
  let article: Article | undefined;

  raw.forEach((line, i) => {
    const content = clean(line);
    if (!content) return;
    const next = raw[i + 1] ?? '';
    if (MARK.test(line.slice(-2)) || (MARK.test(next) && !clean(next))) {
      const number = String(articles.length + 1);
      article = { id: `${documentId}-${number}`, number, title: content.replace(/[.:]$/, ''), parts: [], notes: [] };
      articles.push(article);
      return;
    }
    if (!article) {
      header.push(content);
      return;
    }
    const [body, ...rest] = content.split(/\s+\|\s+/);
    article.parts.push({ text: body, points: [] });
    // «… при превышении лимита.Примечание: включая Армию.»: a note run into the punishment has a line of its own.
    const [, punishment = rest.join(' | '), label, note] = /^(.*?[.!?])\s*(Примечание|Пояснение|Исключение):\s*(.*)$/.exec(rest.join(' | ')) ?? [];
    for (const [l, t] of [['Наказание', punishment], [label, note]]) {
      if (l && t && !article.notes.some((n) => n.label === l && n.text === t)) article.notes.push({ label: l, text: t });
    }
  });

  return { chapters: [], articles, header, footer: [], issues: [] };
}
