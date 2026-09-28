import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/renderApp';
import { AI_KEY_SETTING } from './ai';

const VERDICT = {
  summary: 'Задержание отыграно, но без оснований и прав.',
  items: [
    { ok: true, text: 'Наручники отыграны — 6-ФЗ ст. 20' },
    { ok: false, text: 'Не названо основание задержания — УК ст. 65' },
  ],
};

/** Gemini: the law terms, then the verdict on the roleplay; every request kept. */
function fakeChecker() {
  const bodies: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const raw = String(init.body);
      bodies.push(raw);
      const text = raw.includes('Отыгровка:') ? JSON.stringify(VERDICT) : '["задержание", "наручники", "кража"]';
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
    }),
  );
  return bodies;
}

describe('checking a roleplay', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('checks the pasted chat, for the chosen side, and lists what was right and what was missed, with the articles', async () => {
    const bodies = fakeChecker();
    const { user } = await renderApp({ settings: { [AI_KEY_SETTING]: 'test-key' } });
    await user.click(screen.getByRole('button', { name: 'ИИ-разбор ситуации' }));
    await user.click(screen.getByRole('radio', { name: 'Проверка отыгровки' }));
    const view = screen.getByRole('region', { name: 'Проверка отыгровки' });
    expect(within(view).getByRole('radio', { name: 'Сотрудник' })).toHaveAttribute('aria-checked', 'true');

    await user.type(within(view).getByRole('textbox', { name: 'Отыгровка из чата' }), '/me надел наручники{Enter}— Вы задержаны за кражу.');
    await user.click(within(view).getByRole('button', { name: 'Проверить' }));

    expect(await within(view).findByText('Задержание отыграно, но без оснований и прав.')).toBeInTheDocument();
    const items = within(view).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByLabelText('Верно')).toBeInTheDocument();
    expect(within(items[1]).getByLabelText('Пропущено')).toBeInTheDocument();
    expect(within(items[1]).getByRole('button', { name: /УК ст\. 65/ })).toBeInTheDocument();
    // The whole chat and the side went to the AI, with articles of the server's laws.
    const request = bodies.find((b) => b.includes('Отыгровка:'))!;
    expect(request).toContain('/me надел наручники');
    expect(request).toContain('отыгровка сотрудника');
    expect(request).toMatch(/### .+ ст\. /);
  });

  it('asks for the key before checking', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'ИИ-разбор ситуации' }));
    await user.click(screen.getByRole('radio', { name: 'Проверка отыгровки' }));
    const view = screen.getByRole('region', { name: 'Проверка отыгровки' });
    await user.type(within(view).getByRole('textbox', { name: 'Отыгровка из чата' }), '/me надел наручники');
    await user.click(within(view).getByRole('button', { name: 'Проверить' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Сначала вставьте ключ Gemini');
  });
});
