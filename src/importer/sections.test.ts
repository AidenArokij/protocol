import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLawText } from './lawText';

const root = join(import.meta.dirname, '..', '..');
const parse = (server: string) =>
  parseLawText(readFileSync(join(root, 'data', server, 'sources', 'rules-server.txt'), 'utf8'), 'rules-server', 'sections');

describe('the additional rules of a server: titled sections (real forum text)', () => {
  it('takes each section marked on the forum for an article of its own, titled and numbered by its place', () => {
    expect(parse('tverskoi').articles.map((a) => [a.number, a.title])).toEqual([['1', 'AirDrop'], ['2', 'Нападение на Форт']]);
    expect(parse('arbatskiy').articles.map((a) => a.title)).toEqual(['Нападение на военную базу', 'Правила перехвата поставок', 'Правила войны за AirDrop']);
    expect(parse('kutuzovskiy').articles.map((a) => a.title)).toEqual(['Нападение на военную базу', 'Правила войны за AirDrop']);
  });

  it('keeps the lines of a section as its paragraphs, and what follows «|» as its punishment, told once', () => {
    const fort = parse('tverskoi').articles[1];
    expect(fort.parts.map((p) => p.text).slice(0, 2)).toEqual(['График нападения:', 'Дни: Понедельник, Среда, Пятница, Суббота.']);
    const supply = parse('arbatskiy').articles[1];
    expect(supply.parts.map((p) => p.text).at(-1)).toBe('Максимальное количество участников со стороны государственных организаций - 70 человек.');
    expect(supply.notes).toEqual([
      { label: 'Наказание', text: 'Demorgan 45 минут / Выговор лидеру(-ам) при превышении лимита.' },
      { label: 'Примечание', text: 'включая Армию.' },
    ]);
  });
});
