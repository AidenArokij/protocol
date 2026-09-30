import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/renderApp';

const toggle = () => screen.getByRole('switch', { name: 'Запускать вместе с Windows' });

describe('starting with Windows', () => {
  it('is asked of Windows and turned on and off from the settings', async () => {
    const { platform, user } = await renderApp({ platform: { kind: 'tauri' } });
    await user.click(screen.getByRole('button', { name: 'Настройки' }));
    await vi.waitFor(() => expect(toggle()).toBeEnabled());
    expect(toggle()).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/будет ждать в трее/)).toBeInTheDocument();

    await user.click(toggle());
    expect(platform.state.autostart).toBe(true);
    await user.click(toggle());
    expect(platform.state.autostart).toBe(false);
  });

  it('stays as it was, and says so, when Windows refuses', async () => {
    const { platform, user } = await renderApp({ platform: { kind: 'tauri' } });
    platform.setAutostart = () => Promise.reject(new Error('refused'));
    await user.click(screen.getByRole('button', { name: 'Настройки' }));
    await vi.waitFor(() => expect(toggle()).toBeEnabled());
    await user.click(toggle());
    expect(await screen.findByRole('alert')).toHaveTextContent('Windows не дал изменить автозапуск');
    expect(toggle()).toHaveAttribute('aria-checked', 'false');
  });

  it('is only in the installed app', async () => {
    const { user } = await renderApp({ platform: { kind: 'browser' } });
    await user.click(screen.getByRole('button', { name: 'Настройки' }));
    expect(toggle()).toBeDisabled();
    expect(screen.getByText('Работает только в установленной программе.')).toBeInTheDocument();
  });
});
