import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/renderApp';
import { ACCENT_KEY, THEME_KEY, accentHue, organizationHue } from './appearance';

const root = () => document.documentElement;
const hue = () => root().style.getPropertyValue('--accent-hue');

afterEach(() => {
  delete root().dataset.theme;
  root().style.removeProperty('--accent-hue');
});

async function openLook(user: Awaited<ReturnType<typeof renderApp>>['user']) {
  await user.click(screen.getByRole('button', { name: 'Настройки' }));
  return {
    themes: screen.getByRole('radiogroup', { name: 'Тема' }),
    accents: screen.getByRole('radiogroup', { name: 'Акцент' }),
  };
}

describe('the look: a theme and an accent', () => {
  it('follows the organisation: the МВД blue, the Армия green', async () => {
    await renderApp({ profile: { organization: 'mvd' } });
    await vi.waitFor(() => expect(hue()).toBe(String(organizationHue('mvd'))));
    expect(root().dataset.theme).toBeUndefined();
    cleanup();
    await renderApp({ profile: { organization: 'army' } });
    await vi.waitFor(() => expect(hue()).toBe(String(organizationHue('army'))));
    expect(organizationHue('army')).not.toBe(organizationHue('mvd'));
  });

  it('changes the theme from the settings, at once, and keeps it', async () => {
    const { platform, user } = await renderApp();
    const { themes } = await openLook(user);
    expect(within(themes).getByRole('radio', { name: 'Стекло' })).toBeChecked();
    await user.click(within(themes).getByRole('radio', { name: 'Плотная' }));
    expect(root().dataset.theme).toBe('dense');
    expect(platform.settings.get(THEME_KEY)).toBe('dense');

    // Started again: the saved theme is back.
    const settings = Object.fromEntries(platform.settings);
    cleanup();
    delete root().dataset.theme;
    await renderApp({ settings });
    await vi.waitFor(() => expect(root().dataset.theme).toBe('dense'));
  });

  it('takes a hue chosen by hand over the organisation, and gives the pinned cards the same', async () => {
    const { platform, user } = await renderApp({ profile: { organization: 'mvd' } });
    const { accents } = await openLook(user);
    expect(within(accents).getByRole('radio', { name: 'Как у организации' })).toBeChecked();
    await user.click(within(accents).getByRole('radio', { name: 'Оттенок 150' }));
    expect(hue()).toBe('150');
    expect(platform.settings.get(ACCENT_KEY)).toBe(150);
    expect(platform.calls.filter((c) => c.method === 'setPinLook').at(-1)?.args[0]).toEqual({ theme: 'glass', hue: 150 });
  });

  it('works out the hue: the organisation’s unless one was chosen; an unknown organisation gets the default blue', () => {
    expect(accentHue('organization', 'fsb')).toBe(organizationHue('fsb'));
    expect(accentHue(25, 'fsb')).toBe(25);
    expect(organizationHue('somebody')).toBe(245);
  });
});
