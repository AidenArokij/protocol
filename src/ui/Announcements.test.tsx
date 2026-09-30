import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/renderApp';
import { ANNOUNCEMENTS_URL } from './announcements';

const news = () => screen.queryByRole('region', { name: 'Объявление' });
const posted = (announcements: object[]) => ({ remote: { [ANNOUNCEMENTS_URL]: JSON.stringify({ announcements }) } });
const MAINTENANCE = {
  id: 'maintenance-10-01',
  title: 'Технические работы',
  text: 'Сервер ИИ будет недоступен с 3:00 до 5:00 по Москве.',
  link: { label: 'Подробнее', url: 'https://forum.russia.online/threads/1' },
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-01T12:00:00+03:00'));
});
afterEach(() => vi.useRealTimers());

describe('announcements', () => {
  it('shows what the author posted on GitHub, with its link, until the player closes it', async () => {
    const { platform, user } = await renderApp({ platform: posted([MAINTENANCE]) });
    const notice = await screen.findByRole('region', { name: 'Объявление' });
    expect(notice).toHaveTextContent('Технические работыСервер ИИ будет недоступен с 3:00 до 5:00 по Москве.');

    await user.click(within(notice).getByRole('button', { name: 'Подробнее' }));
    expect(platform.calls.at(-1)).toEqual({ method: 'openExternal', args: ['https://forum.russia.online/threads/1'] });

    await user.click(within(notice).getByRole('button', { name: 'Скрыть объявление' }));
    expect(news()).not.toBeInTheDocument();
    expect(platform.settings.get('announcements.dismissed')).toEqual(['maintenance-10-01']);
  });

  it('leaves out one past its date, one for another server, and a link to a site the app does not open', async () => {
    await renderApp({
      platform: posted([
        { id: 'old', text: 'Было и прошло', until: '2026-09-30' },
        { id: 'arbat', text: 'Только Арбатский', servers: ['arbatskiy'] },
        { id: 'odd', text: 'Со странной ссылкой', link: { label: 'Сюда', url: 'https://example.com/x' } },
      ]),
    });
    const notice = await screen.findByRole('region', { name: 'Объявление' });
    expect(notice).toHaveTextContent('Со странной ссылкой');
    expect(within(notice).queryByRole('button', { name: 'Сюда' })).not.toBeInTheDocument();
  });

  it('shows nothing when there is nothing, or the file cannot be had', async () => {
    await renderApp({ platform: { remote: 'offline' } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(news()).not.toBeInTheDocument();
  });

  it('asks nothing of GitHub once the player turned the checks off', async () => {
    const { platform } = await renderApp({ platform: posted([MAINTENANCE]), settings: { 'update.auto': false } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(news()).not.toBeInTheDocument();
    expect(platform.calls.some((call) => call.method === 'download' && call.args[0] === ANNOUNCEMENTS_URL)).toBe(false);
  });
});
