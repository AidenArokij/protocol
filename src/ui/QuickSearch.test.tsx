import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { QuickBridge, QuickRequest } from '../platform/types';
import { renderApp } from '../test/renderApp';
import { QuickSearch } from './QuickSearch';

/** The bar on its own, with the settings given and what it asks of the overlay written down. */
function renderBar(settings: Record<string, unknown> = { profile: { server: 'tverskoi', organization: 'mvd', hotkey: 'Alt+Q' } }) {
  const requests: QuickRequest[] = [];
  const shown = new Set<() => void>();
  let hidden = 0;
  const bridge: QuickBridge = {
    readSetting: async <T,>(key: string) => settings[key] as T | undefined,
    readLaws: async () => undefined,
    onShown(listener) {
      shown.add(listener);
      return () => shown.delete(listener);
    },
    hide: async () => {
      hidden += 1;
    },
    request: async (request) => {
      requests.push(request);
    },
  };
  render(<QuickSearch bridge={bridge} />);
  return {
    requests,
    hidden: () => hidden,
    show: () => act(() => shown.forEach((listener) => listener())),
    user: userEvent.setup(),
  };
}

const field = () => screen.getByRole('searchbox');
const results = () => screen.getByRole('list', { name: 'Результаты быстрого поиска' });

describe('the quick search', () => {
  it('finds articles as the player types, a few, and Enter puts the chosen one into the calculator', async () => {
    const { requests, user } = renderBar();
    expect(field()).toHaveFocus();
    await user.type(field(), 'кража');
    const rows = within(results()).getAllByRole('listitem');
    expect(rows.length).toBeLessThanOrEqual(8);
    expect(rows[0]).toHaveTextContent('ст. 65 ч. 1');

    await user.keyboard('{ArrowDown}{Enter}');
    expect(requests).toEqual([{ kind: 'charge', key: 'uk-65#2' }]);
    expect(screen.getByText(/В калькуляторе: 1/)).toBeInTheDocument();
    // Twice is still once.
    await user.keyboard('{Enter}');
    expect(requests).toHaveLength(1);
  });

  it('opens an article in the bar with →, and Esc steps back, then hides the bar', async () => {
    const { requests, hidden, user } = renderBar();
    await user.type(field(), 'ук 65{ArrowRight}');
    const article = screen.getByRole('article', { name: 'Статья 65. Кража' });
    await user.click(within(article).getAllByRole('button', { name: 'В калькулятор' })[1]);
    expect(requests).toEqual([{ kind: 'charge', key: 'uk-65#2' }]);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(results()).toBeInTheDocument();
    expect(hidden()).toBe(0);
    await user.keyboard('{Escape}');
    expect(hidden()).toBe(1);
  });

  it('turns to the AI with Tab: Enter asks the assistant, and the bar goes', async () => {
    const { requests, hidden, user } = renderBar();
    await user.type(field(), 'украл телефон у прохожего');
    await user.keyboard('{Tab}');
    expect(screen.getByRole('radio', { name: 'ИИ' })).toBeChecked();
    expect(screen.getByRole('searchbox', { name: 'Вопрос ИИ' })).toHaveValue('украл телефон у прохожего');
    await user.keyboard('{Enter}');
    expect(requests).toEqual([{ kind: 'ask', question: 'украл телефон у прохожего' }]);
    await vi.waitFor(() => expect(hidden()).toBe(1));
  });

  it('searches the laws of the player’s server, and starts empty each time it is shown', async () => {
    const { show, user } = renderBar({ profile: { server: 'arbatskiy', organization: 'none', hotkey: 'Alt+Q' } });
    expect(await screen.findByPlaceholderText('Поиск: Арбатский')).toBeInTheDocument();
    await user.type(field(), 'угнал');
    expect(within(results()).getAllByRole('listitem')[0]).toHaveTextContent('ст. 10.3');

    await show();
    expect(field()).toHaveValue('');
    expect(field()).toHaveFocus();
  });
});


describe('the overlay, for the quick search', () => {
  it('registers the quick search key, and puts into the calculator what the bar sends', async () => {
    const { platform } = await renderApp();
    await vi.waitFor(() => expect(platform.state.quickHotkey).toBe('Alt+S'));
    act(() => platform.quickRequest({ kind: 'charge', key: 'uk-65#1' }));
    expect(await screen.findByRole('complementary', { name: 'Калькулятор' })).toHaveTextContent('ст. 65 ч. 1');
  });

  it('opens itself on the AI with the question the bar asked', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });
    try {
      const { platform } = await renderApp();
      act(() => platform.quickRequest({ kind: 'ask', question: 'украл телефон у прохожего' }));
      expect(await screen.findByRole('region', { name: 'ИИ-разбор' })).toHaveTextContent('украл телефон у прохожего');
      expect(platform.calls.some((call) => call.method === 'showOverlay')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('lets the player turn the key off in «Клавиши»', async () => {
    const { platform, user } = await renderApp();
    await vi.waitFor(() => expect(platform.state.quickHotkey).toBe('Alt+S'));
    await user.click(screen.getByRole('button', { name: 'Настройки' }));
    const block = within(screen.getByRole('group', { name: 'Настройки' })).getByRole('region', { name: 'Быстрый поиск' });
    await user.click(within(block).getByRole('switch', { name: 'Быстрый поиск поверх игры' }));
    expect(platform.settings.get('quick.hotkey')).toBe('');
    await vi.waitFor(() => expect(platform.state.quickHotkey).toBeNull());
  });
});

describe('the quick search, in an article', () => {
  it('puts the part it was opened at into the calculator with Enter', async () => {
    const { requests, user } = renderBar();
    await user.type(field(), 'ук 65 ч 2{ArrowRight}');
    expect(screen.getByRole('article', { name: 'Статья 65. Кража' })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(requests).toEqual([{ kind: 'charge', key: 'uk-65#2' }]);
  });
});
