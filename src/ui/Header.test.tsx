import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TVERSKOI_PACK } from '../data';
import { searchArticles } from '../core';
import { renderApp } from '../test/renderApp';

const search = () => screen.getByRole('searchbox', { name: 'Поиск по законам' });

describe('the header', () => {
  it('«Правила» searches the rules of the project only, «Законы» everything else; a named document is searched anyway', () => {
    const rules = searchArticles(TVERSKOI_PACK, 'оружие', { only: (d) => d.category === 'rules' });
    const laws = searchArticles(TVERSKOI_PACK, 'оружие', { only: (d) => d.category !== 'rules' });
    expect(rules.length).toBeGreaterThan(0);
    expect(laws.length).toBeGreaterThan(0);
    expect(rules.every((hit) => hit.document.category === 'rules')).toBe(true);
    expect(laws.every((hit) => hit.document.category !== 'rules')).toBe(true);
    expect(searchArticles(TVERSKOI_PACK, 'ук 65', { only: (d) => d.category === 'rules' }).length).toBeGreaterThan(0);
  });

  it('switches between «Всё», «Законы» and «Правила», and the search field says what it looks for', async () => {
    const { user } = await renderApp();
    const kinds = screen.getByRole('radiogroup', { name: 'Где искать' });
    expect(within(kinds).getByRole('radio', { name: 'Всё' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(kinds).getByRole('radio', { name: 'Правила' }));
    expect(within(kinds).getByRole('radio', { name: 'Правила' })).toHaveAttribute('aria-checked', 'true');
    expect(search()).toHaveAttribute('placeholder', 'Пункт или слова правил: 1.20, nonrp, оскорбление');
    expect(search()).toHaveFocus();
  });

  it('shows the server and switches it from its list', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: /^Сервер: Тверской/ }));
    const list = screen.getByRole('listbox', { name: 'Сервер' });
    expect(within(list).getByRole('option', { name: /Тверской/ })).toHaveAttribute('aria-selected', 'true');
    await user.click(within(list).getByRole('option', { name: /Арбатский/ }));
    expect(await screen.findByRole('button', { name: /^Сервер: Арбатский/ })).toBeInTheDocument();
    expect(screen.queryByRole('listbox', { name: 'Сервер' })).not.toBeInTheDocument();
  });

  it('closes the list of servers on Esc without hiding the overlay', async () => {
    const { platform, user } = await renderApp();
    await user.click(screen.getByRole('button', { name: /^Сервер: Тверской/ }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox', { name: 'Сервер' })).not.toBeInTheDocument();
    expect(platform.state.overlayVisible).toBe(true);
  });
});
