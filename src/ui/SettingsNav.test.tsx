import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/renderApp';
import { STREAMER_KEY } from './overlaySettings';

const settings = () => screen.getByRole('group', { name: 'Настройки' });

describe('the settings, with a menu on the left', () => {
  it('lists every section in the menu, the server and organisation above it', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Настройки' }));
    const menu = within(settings()).getByRole('navigation', { name: 'Разделы настроек' });
    for (const name of ['Основное', 'Ответы ИИ', 'Внешний вид', 'Закреплённые', 'Законы и обновления', 'Клавиши', 'Частые вопросы', 'О программе']) {
      expect(within(menu).getByRole('button', { name })).toBeInTheDocument();
      // A section, and in some the block within it bears the same title.
      expect(within(settings()).getAllByRole('region', { name }).length).toBeGreaterThan(0);
    }
    await user.click(within(menu).getByRole('button', { name: 'Клавиши' }));
    expect(within(menu).getByRole('button', { name: 'Клавиши' })).toHaveAttribute('aria-current', 'true');
  });

  it('streamer mode leaves the app out of screen capture, and is remembered for the next start', async () => {
    const { platform, user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Настройки' }));
    const toggle = within(settings()).getByRole('switch', { name: 'Режим стримера' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(platform.state.captureHidden).toBe(true);
    expect(platform.settings.get(STREAMER_KEY)).toBe(true);
  });

  it('turns streamer mode on at start when it was on', async () => {
    const { platform } = await renderApp({ settings: { [STREAMER_KEY]: true } });
    await screen.findByRole('searchbox', { name: 'Поиск по законам' });
    await vi.waitFor(() => expect(platform.state.captureHidden).toBe(true));
  });

  it('starts with Windows when asked, as Windows says', async () => {
    const { platform, user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Настройки' }));
    const toggle = await within(settings()).findByRole('switch', { name: 'Запускать вместе с Windows' });
    await vi.waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);
    expect(platform.state.autostart).toBe(true);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('answers the frequent questions', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Настройки' }));
    await user.click(within(settings()).getByText('Где взять ключ для ИИ и сколько это стоит?'));
    expect(within(settings()).getByText(/aistudio\.google\.com\/apikey/)).toBeVisible();
  });
});
