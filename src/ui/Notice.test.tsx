import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/renderApp';
import { NOTICE_DISMISSED_KEY, NOTICE_URL, readNotice } from './notice';
import { AUTO_KEY } from './updates';

const MOVE = {
  id: 'move-1',
  title: 'ПРОТОКОЛ теперь часть РО Хелпера',
  text: 'ИИ-разбор переехал в РО Хелпер. Избранное и историю придётся собрать заново.',
  link: { label: 'Скачать РО Хелпер', url: 'https://github.com/skyyyzeee/ro-helper/releases/latest' },
};

describe('a notice from the repository', () => {
  it('reads a notice, and nothing from an empty, broken or unsafe one', () => {
    expect(readNotice(JSON.stringify(MOVE))).toEqual(MOVE);
    expect(readNotice('{}')).toBeNull();
    expect(readNotice('<html>404</html>')).toBeNull();
    expect(readNotice(JSON.stringify({ ...MOVE, link: { label: 'x', url: 'javascript:alert(1)' } }))).toEqual({ id: MOVE.id, title: MOVE.title, text: MOVE.text });
  });

  it('shows it under the header, tells it over the game once, opens its page, and stays closed once closed', async () => {
    const { platform, user } = await renderApp({ platform: { remote: { [NOTICE_URL]: JSON.stringify(MOVE) } } });
    const banner = await screen.findByRole('status', { name: 'Объявление' });
    expect(banner).toHaveTextContent(MOVE.title);
    expect(platform.state.toast?.title).toBe(MOVE.title);

    await user.click(within(banner).getByRole('button', { name: 'Скачать РО Хелпер' }));
    expect(platform.calls.at(-1)).toEqual({ method: 'openExternal', args: [MOVE.link.url] });

    await user.click(within(banner).getByRole('button', { name: 'Скрыть объявление' }));
    expect(screen.queryByRole('status', { name: 'Объявление' })).not.toBeInTheDocument();
    expect(platform.settings.get(NOTICE_DISMISSED_KEY)).toBe('move-1');
  });

  it('says nothing while the file is empty', async () => {
    await renderApp({ platform: { remote: { [NOTICE_URL]: '{}' } } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('status', { name: 'Объявление' })).not.toBeInTheDocument();
  });

  it('asks nothing when the automatic checks are off', async () => {
    const { platform } = await renderApp({ settings: { [AUTO_KEY]: false }, platform: { remote: { [NOTICE_URL]: JSON.stringify(MOVE) } } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(platform.calls.some((c) => c.method === 'download' && c.args[0] === NOTICE_URL)).toBe(false);
    expect(screen.queryByRole('status', { name: 'Объявление' })).not.toBeInTheDocument();
  });
});
