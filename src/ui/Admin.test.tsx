import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FakeAccounts } from '../account/fake';
import { renderApp } from '../test/renderApp';

const SKYZE = { id: 'user-1', name: 'Skyze', via: 'discord' as const };
const IVAN = { name: 'Ivan', gameName: 'Ivan_Petrov', position: 'Сержант', server: 'tverskoi', organization: 'mvd' };
const settings = () => screen.getByRole('group', { name: 'Настройки' });
const account = () => within(settings()).getByRole('region', { name: 'Аккаунт' });
const settingsNav = () => within(settings()).getByRole('navigation', { name: 'Разделы настроек' });
const admin = () => within(settings()).getByRole('region', { name: 'Администратор' });

describe('roles: a player asks to be the leader', () => {
  it('sends their card to the server, and a request to be the leader of their faction', async () => {
    const { accounts, user } = await renderApp({ account: SKYZE, profile: { organization: 'mvd' }, settings: { player: { gameName: 'Sky_Ze' } } });
    await vi.waitFor(() => expect(accounts.server.cards.get('user-1')).toEqual({ name: 'Skyze', gameName: 'Sky_Ze', server: 'tverskoi', organization: 'mvd' }));

    await user.keyboard('{Control>}6{/Control}');
    await user.click(await within(account()).findByRole('button', { name: 'Я лидер фракции' }));
    await user.type(within(account()).getByRole('textbox', { name: 'Чем подтвердить' }), 'пост о назначении на форуме');
    await user.click(within(account()).getByRole('button', { name: 'Отправить заявку' }));

    expect(await within(account()).findByText(/Заявка на лидера МВД .* ждёт ответа администратора/)).toBeInTheDocument();
    expect(accounts.server.requests).toMatchObject([
      { userId: 'user-1', server: 'tverskoi', organization: 'mvd', note: 'пост о назначении на форуме', status: 'pending' },
    ]);
    expect(within(account()).queryByRole('button', { name: 'Я лидер фракции' })).not.toBeInTheDocument();
  });

  it('has nothing to ask without a faction', async () => {
    const { user } = await renderApp({ account: SKYZE });
    await user.keyboard('{Control>}6{/Control}');
    await within(account()).findByText('Skyze');
    expect(within(account()).queryByRole('button', { name: 'Я лидер фракции' })).not.toBeInTheDocument();
  });

  it('shows the leader on their card, as in the mockup', async () => {
    const { user } = await renderApp({
      account: SKYZE,
      profile: { organization: 'mvd' },
      server: (server) => server.roles.set('user-1', [{ server: 'tverskoi', organization: 'mvd', role: 'leader' }]),
    });
    await user.keyboard('{Control>}6{/Control}');
    expect(await within(account()).findByText('Лидер')).toHaveClass('role');
    expect(within(account()).queryByRole('button', { name: 'Я лидер фракции' })).not.toBeInTheDocument();
  });
});

describe('the admin screen', () => {
  const withIvan = (server: FakeAccounts['server']) => {
    server.admins.add('user-1');
    server.cards.set('user-2', IVAN);
    server.requests.push({ id: 1, userId: 'user-2', server: 'tverskoi', organization: 'mvd', note: 'назначен 28.09', status: 'pending', createdAt: '2026-09-30T10:00:00Z' });
  };
  const openAdmin = async (user: Awaited<ReturnType<typeof renderApp>>['user']) => {
    await user.keyboard('{Control>}5{/Control}');
    await user.click(await within(settingsNav()).findByRole('button', { name: 'Администратор' }));
  };

  it('is there for the admin only', async () => {
    const { user } = await renderApp({ account: SKYZE });
    await user.keyboard('{Control>}5{/Control}');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(within(settingsNav()).queryByRole('button', { name: 'Администратор' })).not.toBeInTheDocument();
  });

  it('answers the leader requests: approved, the player leads that faction on that server', async () => {
    const { accounts, user } = await renderApp({ account: SKYZE, server: withIvan });
    await openAdmin(user);
    const requests = await within(admin()).findByRole('list', { name: 'Заявки лидеров' });
    expect(requests).toHaveTextContent('Ivan · Ivan_PetrovЛидер МВД · Тверской«назначен 28.09»');

    await user.click(within(requests).getByRole('button', { name: 'Одобрить' }));
    expect(accounts.server.roles.get('user-2')).toEqual([{ server: 'tverskoi', organization: 'mvd', role: 'leader' }]);
    expect(await within(admin()).findByText('Новых заявок нет')).toBeInTheDocument();
  });

  it('turns a request down', async () => {
    const { accounts, user } = await renderApp({ account: SKYZE, server: withIvan });
    await openAdmin(user);
    await user.click(within(await within(admin()).findByRole('list', { name: 'Заявки лидеров' })).getByRole('button', { name: 'Отклонить' }));
    expect(accounts.server.requests[0].status).toBe('rejected');
    expect(accounts.server.roles.get('user-2')).toBeUndefined();
  });

  it('finds a player and makes them the leader of their faction, or takes it back', async () => {
    const { accounts, user } = await renderApp({ account: SKYZE, server: withIvan });
    await openAdmin(user);
    await user.type(within(admin()).getByRole('searchbox', { name: 'Найти игрока' }), 'petrov{Enter}');
    const found = await within(admin()).findByRole('list', { name: 'Игроки' });
    expect(found).toHaveTextContent('Ivan · Ivan_PetrovТверской · МВД · Сержант');

    await user.click(within(found).getByRole('button', { name: 'Сделать лидером МВД · Тверской' }));
    expect(accounts.server.roles.get('user-2')).toEqual([{ server: 'tverskoi', organization: 'mvd', role: 'leader' }]);
    expect(await within(found).findByText('Лидер МВД · Тверской')).toBeInTheDocument();

    await user.click(within(found).getByRole('button', { name: 'Снять: Лидер МВД · Тверской' }));
    expect(accounts.server.roles.get('user-2')).toEqual([]);
  });
});
