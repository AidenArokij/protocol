import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/renderApp';
import { STREAMER_KEY } from './overlaySettings';

const toggle = () => screen.getByRole('switch', { name: 'Режим стримера' });

describe('streamer mode', () => {
  it('leaves the app out of screen capture from the settings, warns about Nvidia, and remembers it', async () => {
    const { platform, user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Настройки' }));
    expect(toggle()).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/запись Nvidia \(мгновенный повтор, ShadowPlay\) не работает совсем/)).toBeInTheDocument();

    await user.click(toggle());
    expect(platform.state.captureHidden).toBe(true);
    expect(platform.settings.get(STREAMER_KEY)).toBe(true);

    await user.click(toggle());
    expect(platform.state.captureHidden).toBe(false);
    expect(platform.settings.get(STREAMER_KEY)).toBe(false);
  });

  it('is set again at the next start', async () => {
    const { platform } = await renderApp({ settings: { [STREAMER_KEY]: true } });
    await vi.waitFor(() => expect(platform.state.captureHidden).toBe(true));
  });

  it('stays off, and says so, when Windows refuses', async () => {
    const { platform, user } = await renderApp();
    platform.setCaptureHidden = () => Promise.reject(new Error('refused'));
    await user.click(screen.getByRole('button', { name: 'Настройки' }));
    await user.click(toggle());
    expect(await screen.findByRole('alert')).toHaveTextContent('Windows не дал скрыть окно');
    expect(toggle()).toHaveAttribute('aria-checked', 'false');
    expect(platform.settings.get(STREAMER_KEY)).toBeUndefined();
  });
});
