import { act, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pinnedCards, renderApp } from '../test/renderApp';
import { AI_KEY_SETTING, historyKey, type StoredConversation } from './ai';
import { DEFAULT_VOICE_HOTKEY, VOICE_HOTKEY_KEY } from './overlaySettings';

// The microphone as the tests see it: always there, a recording of a few bytes.
vi.mock('./voice', () => ({
  canRecord: () => true,
  startRecording: vi.fn(async () => ({ stop: async () => 'UklGRg==', cancel: () => {} })),
}));

const ANSWER = 'Суть: это кража.\nСтатья: УК ст. 65 — штраф до 50 000 ₽ либо 30 мес.\nЧто делать: заявить в полицию.';

/** Gemini: writes down the recording, gives the law terms, then the short answer. */
function fakeGemini() {
  const bodies: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const raw = String(init.body);
      bodies.push(raw);
      const body = JSON.parse(raw) as { generationConfig?: { responseMimeType?: string } };
      const text = raw.includes('inlineData') ? 'у меня украли телефон' : body.generationConfig?.responseMimeType === 'application/json' ? '["кража"]' : ANSWER;
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
    }),
  );
  return bodies;
}

/** Holding the key while speaking: longer than a tap. */
const speak = () => act(() => new Promise((resolve) => setTimeout(resolve, 450)));

describe('a question over the game', () => {
  beforeEach(() => void fakeGemini());
  afterEach(() => vi.unstubAllGlobals());

  it('listens while the key is held, then pins the short answer over the game and keeps it in the history', async () => {
    const { platform } = await renderApp({ settings: { [AI_KEY_SETTING]: 'test-key' } });
    await vi.waitFor(() => expect(platform.state.voiceHotkey).toBe(DEFAULT_VOICE_HOTKEY));

    await act(async () => platform.holdVoiceHotkey());
    await vi.waitFor(() => expect(platform.state.toast?.title).toBe('Слушаю…'));
    await speak();
    await act(async () => platform.releaseVoiceHotkey());

    await vi.waitFor(() => expect(pinnedCards(platform).some((card) => card.kind === 'ai')).toBe(true));
    const card = pinnedCards(platform).find((c) => c.kind === 'ai')!;
    expect(card.heading).toBe('у меня украли телефон');
    expect(card.lines).toEqual(['Суть: это кража.', 'Статья: УК ст. 65 — штраф до 50 000 ₽ либо 30 мес.', 'Что делать: заявить в полицию.']);
    const saved = platform.settings.get(historyKey('tverskoi')) as StoredConversation[];
    expect(saved[0].title).toBe('у меня украли телефон');
  });

  it('also takes a tap to start and another press to end, when the key is not held', async () => {
    const { platform } = await renderApp({ settings: { [AI_KEY_SETTING]: 'test-key' } });
    await vi.waitFor(() => expect(platform.state.voiceHotkey).toBe(DEFAULT_VOICE_HOTKEY));
    await act(async () => platform.holdVoiceHotkey());
    await vi.waitFor(() => expect(platform.state.toast?.title).toBe('Слушаю…'));
    await act(async () => platform.releaseVoiceHotkey());
    expect(platform.state.toast?.text).toMatch(/нажмите Alt \+ W ещё раз/);
    expect(pinnedCards(platform)).toEqual([]);

    await speak();
    await act(async () => platform.holdVoiceHotkey());
    await vi.waitFor(() => expect(pinnedCards(platform).some((card) => card.kind === 'ai')).toBe(true));
  });

  it('asks the AI for a short answer, fit for a card', async () => {
    const { platform } = await renderApp({ settings: { [AI_KEY_SETTING]: 'test-key' } });
    await vi.waitFor(() => expect(platform.state.voiceHotkey).toBe(DEFAULT_VOICE_HOTKEY));
    const bodies = fakeGemini();
    await act(async () => platform.holdVoiceHotkey());
    await vi.waitFor(() => expect(platform.state.toast?.title).toBe('Слушаю…'));
    await speak();
    await act(async () => platform.releaseVoiceHotkey());
    await vi.waitFor(() => expect(bodies.some((b) => b.includes('ОТВЕТ ДЛЯ КАРТОЧКИ ПОВЕРХ ИГРЫ'))).toBe(true));
  });

  it('says so over the game when the AI cannot answer', async () => {
    const { platform } = await renderApp();
    await vi.waitFor(() => expect(platform.state.voiceHotkey).toBe(DEFAULT_VOICE_HOTKEY));
    await act(async () => platform.holdVoiceHotkey());
    await vi.waitFor(() => expect(platform.state.toast?.title).toBe('Слушаю…'));
    await speak();
    await act(async () => platform.releaseVoiceHotkey());
    await vi.waitFor(() => expect(platform.state.toast?.text).toMatch(/ключ Gemini/));
    expect(pinnedCards(platform)).toEqual([]);
  });

  it('is turned off, or given another key, in the settings', async () => {
    const { platform, user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Настройки' }));
    const settings = screen.getByRole('group', { name: 'Настройки' });
    const toggle = within(settings).getByRole('switch', { name: 'Спрашивать, не открывая окно' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await user.click(toggle);
    expect(platform.settings.get(VOICE_HOTKEY_KEY)).toBe('');
    await vi.waitFor(() => expect(platform.state.voiceHotkey).toBeNull());
  });
});
