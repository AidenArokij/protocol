import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/renderApp';
import { FAREWELL, FAREWELL_AGAIN_MS, FAREWELL_DISMISSED_KEY, NOTICE_DISMISSED_KEY, NOTICE_URL, readNotice } from './notice';
import { AUTO_KEY } from './updates';

const MOVE = {
  id: 'move-1',
  title: 'ПРОТОКОЛ теперь часть РО Хелпера',
  text: 'ИИ-разбор переехал в РО Хелпер. Избранное и историю придётся собрать заново.',
  link: { label: 'Скачать РО Хелпер', url: 'https://github.com/skyyyzeee/ro-helper/releases/latest' },
};

const banner = () => screen.findByRole('status', { name: 'Объявление' });
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('a notice from the repository', () => {
  it('reads a notice, and nothing from an empty, broken or unsafe one', () => {
    expect(readNotice(JSON.stringify(MOVE))).toEqual(MOVE);
    expect(readNotice('{}')).toBeNull();
    expect(readNotice('<html>404</html>')).toBeNull();
    expect(readNotice(JSON.stringify({ ...MOVE, link: { label: 'x', url: 'javascript:alert(1)' } }))).toEqual({ id: MOVE.id, title: MOVE.title, text: MOVE.text });
  });

  it('shows it under the header instead of the farewell, tells it over the game once, opens its page, and stays closed once closed', async () => {
    const { platform, user } = await renderApp({ platform: { remote: { [NOTICE_URL]: JSON.stringify(MOVE) } } });
    await screen.findByText(MOVE.title);
    const shown = await banner();
    expect(shown).not.toHaveTextContent(FAREWELL.title);
    expect(platform.state.toast?.title).toBe(MOVE.title);

    await user.click(within(shown).getByRole('button', { name: 'Скачать РО Хелпер' }));
    expect(platform.calls.at(-1)).toEqual({ method: 'openExternal', args: [MOVE.link.url] });

    await user.click(within(shown).getByRole('button', { name: 'Скрыть объявление' }));
    expect(screen.queryByText(MOVE.title)).not.toBeInTheDocument();
    expect(platform.settings.get(NOTICE_DISMISSED_KEY)).toBe('move-1');
  });

  it('asks nothing when the automatic checks are off', async () => {
    const { platform } = await renderApp({ settings: { [AUTO_KEY]: false }, platform: { remote: { [NOTICE_URL]: JSON.stringify(MOVE) } } });
    await settle();
    expect(platform.calls.some((c) => c.method === 'download' && c.args[0] === NOTICE_URL)).toBe(false);
    expect(screen.queryByText(MOVE.title)).not.toBeInTheDocument();
  });
});

describe('the farewell: ПРОТОКОЛ 3.0 is the last version', () => {
  it('says so with no notice on GitHub — offline and with the checks off too — with a link to Кремлёвский Ассистент', async () => {
    const { platform, user } = await renderApp({ settings: { [AUTO_KEY]: false, [FAREWELL_DISMISSED_KEY]: undefined }, platform: { remote: { [NOTICE_URL]: '{}' } } });
    const shown = await banner();
    expect(shown).toHaveTextContent(FAREWELL.title);
    // Told over the game once.
    expect(platform.state.toast?.title).toBe(FAREWELL.title);

    await user.click(within(shown).getByRole('button', { name: 'Скачать Кремлёвский Ассистент' }));
    expect(platform.calls.at(-1)).toEqual({ method: 'openExternal', args: ['https://github.com/skyyyzeee/ro-helper/releases/latest'] });
  });

  it('closed, it stays away for a few days, then comes back', async () => {
    const { platform, user } = await renderApp({ settings: { [FAREWELL_DISMISSED_KEY]: undefined }, platform: { remote: { [NOTICE_URL]: '{}' } } });
    await user.click(within(await banner()).getByRole('button', { name: 'Скрыть объявление' }));
    expect(screen.queryByRole('status', { name: 'Объявление' })).not.toBeInTheDocument();
    expect(Date.now() - (platform.settings.get(FAREWELL_DISMISSED_KEY) as number)).toBeLessThan(1000);
  });

  it('is not shown within the days after closing it, and is shown again after them', async () => {
    const day = 24 * 60 * 60 * 1000;
    await renderApp({ settings: { [FAREWELL_DISMISSED_KEY]: Date.now() - day }, platform: { remote: { [NOTICE_URL]: '{}' } } });
    await settle();
    expect(screen.queryByRole('status', { name: 'Объявление' })).not.toBeInTheDocument();
  });

  it('comes back once the days have passed', async () => {
    await renderApp({ settings: { [FAREWELL_DISMISSED_KEY]: Date.now() - FAREWELL_AGAIN_MS - 1000 }, platform: { remote: { [NOTICE_URL]: '{}' } } });
    expect(await banner()).toHaveTextContent(FAREWELL.title);
  });
});
