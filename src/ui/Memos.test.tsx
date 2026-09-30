import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FakeAccounts } from '../account/fake';
import type { Memo } from '../account/roles';
import { renderApp } from '../test/renderApp';

const LEADER = { id: 'user-1', name: 'Skyze', via: 'discord' as const };
const PLAYER = { id: 'user-2', name: 'Ivan', via: 'discord' as const };
const MVD = { organization: 'mvd' };
const rail = () => screen.getByRole('navigation', { name: 'Разделы' });
const account = () => within(screen.getByRole('group', { name: 'Настройки' })).getByRole('region', { name: 'Аккаунт' });
const DAY = 24 * 3600 * 1000;
const memo = (patch: Partial<Memo>): Memo => ({
  id: 1,
  server: 'tverskoi',
  organization: 'mvd',
  authorId: 'user-1',
  authorName: 'Skyze',
  text: 'С 20:00 рейд на склад в Южном порту. Сбор у ГУВД.',
  createdAt: new Date().toISOString(),
  until: new Date(Date.now() + DAY).toISOString(),
  ...patch,
});
/** A faction of Тверской's МВД: its leader Skyze, and Ivan and Petr among its players. */
const faction = (server: FakeAccounts['server']) => {
  server.roles.set('user-1', [{ server: 'tverskoi', organization: 'mvd', role: 'leader' }]);
  server.cards.set('user-1', { name: 'Skyze', server: 'tverskoi', organization: 'mvd' });
  server.cards.set('user-2', { name: 'Ivan', gameName: 'Ivan_Petrov', position: 'Сержант', server: 'tverskoi', organization: 'mvd' });
  server.cards.set('user-3', { name: 'Petr', server: 'tverskoi', organization: 'mvd' });
  server.cards.set('user-4', { name: 'Stranger', server: 'arbatskiy', organization: 'mvd' });
};

describe('deputies (ticket 16)', () => {
  it('lets the leader list the players of their faction and make one a deputy, or not', async () => {
    const { accounts, user } = await renderApp({ account: LEADER, profile: MVD, server: faction });
    await user.keyboard('{Control>}6{/Control}');
    const panel = await within(account()).findByRole('group', { name: 'Лидер фракции' });
    await user.click(within(panel).getByRole('button', { name: /Заместители/ }));
    const players = await within(panel).findByRole('list', { name: 'Игроки фракции' });
    // Only their own faction, on their own server — and not themselves.
    expect(within(players).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^Ivan · Ivan_PetrovСержант/),
      expect.stringMatching(/^Petr/),
    ]);

    await user.click(within(within(players).getAllByRole('listitem')[0]).getByRole('button', { name: 'Сделать заместителем' }));
    expect(accounts.server.roles.get('user-2')).toEqual([{ server: 'tverskoi', organization: 'mvd', role: 'deputy' }]);
    expect(await within(panel).findByText('1 назначено')).toBeInTheDocument();

    await user.click(within(within(players).getAllByRole('listitem')[0]).getByRole('button', { name: 'Снять заместителя' }));
    expect(accounts.server.roles.get('user-2')).toEqual([]);
  });

  it('is not there for a player who is not the leader', async () => {
    const { user } = await renderApp({ account: PLAYER, profile: MVD, server: faction });
    await user.keyboard('{Control>}6{/Control}');
    await within(account()).findByText('Ivan');
    expect(within(account()).queryByRole('group', { name: 'Лидер фракции' })).not.toBeInTheDocument();
  });
});

describe('memos (ticket 17)', () => {
  it('lets the leader write one, for as long as they choose', async () => {
    const { accounts, user } = await renderApp({ account: LEADER, profile: MVD, server: faction });
    await user.click(within(rail()).getByRole('button', { name: 'Памятки' }));
    const page = await screen.findByRole('group', { name: 'Памятки' });
    const form = await within(page).findByRole('form', { name: 'Новая памятка' });
    await user.type(within(form).getByRole('textbox', { name: 'Текст памятки' }), 'Завтра в 18:00 общее построение.');
    await user.click(within(form).getByRole('radio', { name: 'Неделя' }));
    await user.click(within(form).getByRole('button', { name: 'Опубликовать' }));

    expect(accounts.server.memos).toMatchObject([{ server: 'tverskoi', organization: 'mvd', authorName: 'Skyze', text: 'Завтра в 18:00 общее построение.' }]);
    const days = (Date.parse(accounts.server.memos[0].until) - Date.now()) / DAY;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
    expect(await within(page).findByRole('article', { name: 'Памятка от Skyze' })).toHaveTextContent('Завтра в 18:00 общее построение.');
  });

  it('shows a player of the faction the latest one on the home screen, and tells a new one over the game', async () => {
    const { platform } = await renderApp({
      account: PLAYER,
      profile: MVD,
      settings: { 'memos.seen': [] },
      server: (server) => {
        faction(server);
        server.memos.push(memo({}));
      },
    });
    const home = await screen.findByRole('button', { name: 'Памятка фракции' });
    expect(home).toHaveTextContent('Памятка лидера МВД · сегодня');
    expect(home).toHaveTextContent('С 20:00 рейд на склад в Южном порту.');
    await vi.waitFor(() => expect(platform.state.toast).toMatchObject({ title: 'Памятка лидера МВД', text: expect.stringMatching(/^С 20:00 рейд/) }));
    expect(platform.settings.get('memos.seen')).toEqual([1]);
  });

  it('does not tell over the game what was there before the first look', async () => {
    const { platform } = await renderApp({ account: PLAYER, profile: MVD, server: (server) => (faction(server), server.memos.push(memo({}))) });
    await screen.findByRole('button', { name: 'Памятка фракции' });
    await vi.waitFor(() => expect(platform.settings.get('memos.seen')).toEqual([1]));
    expect(platform.state.toast).toBeNull();
  });

  it('keeps the ones run out in the archive, and gives a player no form to write', async () => {
    const { user } = await renderApp({
      account: PLAYER,
      profile: MVD,
      server: (server) => {
        faction(server);
        server.memos.push(memo({ id: 2, text: 'Старая памятка', createdAt: new Date(Date.now() - 5 * DAY).toISOString(), until: new Date(Date.now() - DAY).toISOString() }));
      },
    });
    await user.click(within(rail()).getByRole('button', { name: 'Памятки' }));
    const page = await screen.findByRole('group', { name: 'Памятки' });
    expect(await within(page).findByText('Действующих памяток нет.')).toBeInTheDocument();
    expect(within(page).getByText('Архив · 1')).toBeInTheDocument();
    expect(within(page).queryByRole('form', { name: 'Новая памятка' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Памятка фракции' })).not.toBeInTheDocument();
  });

  it('asks a player signed out to sign in', async () => {
    const { user } = await renderApp({ profile: MVD });
    await user.click(within(rail()).getByRole('button', { name: 'Памятки' }));
    expect(screen.getByText(/Памятки от лидера видят игроки фракции, вошедшие в аккаунт/)).toBeInTheDocument();
  });
});
