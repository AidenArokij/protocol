import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/renderApp';
import { RAIL_TIP_KEY } from './overlaySettings';

const rail = () => document.querySelector<HTMLElement>('nav.rail')!;
const isOpen = () => rail().dataset.open === 'true';

describe('the side menu', () => {
  it('is out of sight, and of reach, until it is opened', async () => {
    await renderApp();
    expect(isOpen()).toBe(false);
    expect(screen.queryByRole('navigation', { name: 'Разделы' })).not.toBeInTheDocument();
  });

  it('opens and closes at a tap of Alt, but not with Alt+Q', async () => {
    const { user } = await renderApp();
    await user.keyboard('{Alt}');
    expect(isOpen()).toBe(true);
    expect(within(screen.getByRole('navigation', { name: 'Разделы' })).getByRole('button', { name: 'Поиск' })).toHaveAttribute('aria-current', 'page');
    await user.keyboard('{Alt}');
    expect(isOpen()).toBe(false);
    await user.keyboard('{Alt>}q{/Alt}');
    expect(isOpen()).toBe(false);
  });

  it('comes out when the mouse reaches the left edge, and goes half a second after it leaves', async () => {
    await renderApp();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      fireEvent.mouseEnter(document.querySelector('.rail-edge')!);
      expect(isOpen()).toBe(true);
      fireEvent.mouseLeave(rail());
      act(() => vi.advanceTimersByTime(400));
      expect(isOpen()).toBe(true);
      act(() => vi.advanceTimersByTime(200));
      expect(isOpen()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens its sections with Ctrl and a number: the documents, the settings', async () => {
    const { user } = await renderApp();
    await user.keyboard('{Control>}2{/Control}');
    expect(screen.getByRole('button', { name: 'Все документы' })).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Control>}5{/Control}');
    expect(screen.getByRole('group', { name: 'Настройки' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Все документы' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes with Esc before anything else does', async () => {
    const { platform, user } = await renderApp();
    await user.keyboard('{Alt}');
    await user.keyboard('{Escape}');
    expect(isOpen()).toBe(false);
    expect(platform.calls.some((c) => c.method === 'hideOverlay')).toBe(false);
  });

  it('shows the memos and the profile as coming, and the calculator only once it has charges', async () => {
    const { user } = await renderApp();
    await user.keyboard('{Alt}');
    const nav = screen.getByRole('navigation', { name: 'Разделы' });
    for (const name of ['Памятки', 'Профиль', 'Калькулятор']) expect(within(nav).getByRole('button', { name })).toBeDisabled();
    expect(within(nav).getByRole('button', { name: 'Закреплённое' })).toBeEnabled();
  });

  it('says where it is at the first launch, until read', async () => {
    const { platform, user } = await renderApp({ settings: { [RAIL_TIP_KEY]: false } });
    const tip = await screen.findByRole('note');
    expect(tip).toHaveTextContent('Разделы — у левого края');
    await user.click(within(tip).getByRole('button', { name: 'Понятно' }));
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(platform.settings.get(RAIL_TIP_KEY)).toBe(true);
  });
});
