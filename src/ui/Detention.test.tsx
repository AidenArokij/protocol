import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/renderApp';
import { AI_SERVER_SETTING } from './ai';

const SERVER = { [AI_SERVER_SETTING]: 'https://ai.example' };

/** The AI server: the law terms, then the review — citing the first article the search really found as `FOUND`. */
function fakeServer(answer: object) {
  const bodies: { system?: string; messages?: { content: string }[]; counts?: boolean; think?: boolean }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as (typeof bodies)[number];
      bodies.push(body);
      const found = body.messages?.at(-1)?.content.match(/### (\S+ (?:ст|п)\. [\d.]+)/)?.[1] ?? 'нет';
      const text = body.counts === false ? '{"phrases": ["задержание", "права задержанного"]}' : JSON.stringify(answer).replaceAll('FOUND', found);
      return new Response(JSON.stringify({ text }), { status: 200 });
    }),
  );
  return bodies;
}

const REVIEW = {
  steps: [
    { step: 'Представился задержанному', verdict: 'ok', basis: 'FOUND — сотрудник называет себя', fix: '' },
    { step: 'Обыскал без понятых', verdict: 'violation', basis: 'FOUND — обыск при понятых', fix: 'Пригласить двух понятых.' },
    // A violation the laws found say nothing of: not shown as one.
    { step: 'Надел наручники', verdict: 'violation', basis: 'УК ст. 999 — выдуманная статья', fix: 'Не надевать.' },
  ],
  missed: [
    { what: 'Не разъяснил права', basis: 'FOUND — разъяснить права' },
    { what: 'Не дал позвонить маме', basis: 'нигде не сказано' },
  ],
  summary: 'Обыск — главная ошибка.',
};

async function openDetention() {
  const app = await renderApp({ settings: SERVER });
  await app.user.click(screen.getByRole('button', { name: 'ИИ-разбор ситуации' }));
  await app.user.click(screen.getByRole('radio', { name: 'Разбор задержания' }));
  return { ...app, view: screen.getByRole('region', { name: 'Разбор задержания' }) };
}

describe('the review of a detention (issue #4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('checks each step the officer tells against the laws, with what was missed and a summary to copy', async () => {
    const bodies = fakeServer(REVIEW);
    const { platform, user, view } = await openDetention();
    await user.type(screen.getByRole('searchbox', { name: 'Поиск по законам' }), 'представился, обыскал без понятых, надел наручники{Enter}');

    const steps = await within(view).findAllByRole('listitem');
    const list = within(view).getByRole('list', { name: 'Шаги задержания' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(steps[0]).toHaveTextContent('По закону');
    expect(steps[1]).toHaveTextContent('Нарушение');
    expect(steps[1]).toHaveTextContent('Пригласить двух понятых.');
    // Its basis is a found article, opened with a click.
    expect(within(steps[1]).getByRole('button', { name: /(ст|п)\. [\d.]+/ })).toBeInTheDocument();
    // The one resting on an article the laws do not have is no violation.
    expect(steps[2]).toHaveTextContent('В законах сервера не нашлось');
    expect(steps[2]).not.toHaveTextContent('Не надевать.');

    const missed = within(view).getByRole('list', { name: 'Не сделано' });
    expect(within(missed).getAllByRole('listitem')).toHaveLength(1);
    expect(missed).toHaveTextContent('Не разъяснил права');
    expect(view).toHaveTextContent('По закону: 1 из 3 · нарушений: 1 · не сделано: 1');
    expect(view).toHaveTextContent('Обыск — главная ошибка.');

    await user.click(within(view).getByRole('button', { name: 'Скопировать разбор' }));
    expect(platform.state.clipboard).toMatch(/^Разбор задержания\n/);
    expect(platform.state.clipboard).toContain('Обыскал без понятых — Нарушение');

    // The AI was given the server's articles and told to be fair; the review counts as one question, with thinking.
    const review = bodies.find((b) => b.counts !== false)!;
    expect(review.system).toContain('Верно сделанное так и отмечай');
    expect(review.messages?.at(-1)?.content).toContain('Найденные в законах сервера источники');
    expect(review.think).toBe(true);
  });

  it('says so when the AI makes nothing of the story', async () => {
    fakeServer({ steps: [], missed: [], summary: '' });
    const { user, view } = await openDetention();
    await user.type(screen.getByRole('searchbox', { name: 'Поиск по законам' }), 'задержал человека{Enter}');
    expect(await within(view).findByRole('alert')).toHaveTextContent('ИИ не разобрал шаги');
  });
});
