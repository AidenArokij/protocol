/**
 * Default hotkey. Alt+Q was checked in game on Тверской (ticket 06): GTA V leaves the Alt+Q combination
 * free (Q alone, «cover», still reaches the game) and nothing in Russia Online collided with it.
 */
export const DEFAULT_HOTKEY = 'Alt+Q';

export const OPACITY_KEY = 'overlay.opacity';
/** Background opacity of the glass, 0–1; the mockup's value. */
export const DEFAULT_OPACITY = 0.62;
export const MIN_OPACITY = 0.35;
export const MAX_OPACITY = 0.95;

export function clampOpacity(value: number): number {
  return Math.min(MAX_OPACITY, Math.max(MIN_OPACITY, value));
}

/** «Сплошное» — an opaque dark panel with a red accent, ПРОТОКОЛ's own look; «Стекло» — the game shows through, as in РО Хелпер. */
export type Theme = 'solid' | 'glass';
export const THEME_KEY = 'overlay.theme';
export const DEFAULT_THEME: Theme = 'solid';

export function applyTheme(theme: Theme): void {
  if (theme === 'glass') document.documentElement.dataset.theme = 'glass';
  else delete document.documentElement.dataset.theme;
}

/** Streamer mode: the app is left out of screen capture (OBS, Discord, screenshots). */
export const STREAMER_KEY = 'overlay.streamer';

/** Applies the glass opacity to the whole overlay through the `--glass-alpha` token. */
export function applyOpacity(value: number): void {
  document.documentElement.style.setProperty('--glass-alpha', String(clampOpacity(value)));
}
