import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/renderApp';

const rail = () => screen.getByRole('navigation', { name: 'Разделы' });
const settings = () => screen.getByRole('group', { name: 'Настройки' });
/** The account: the first block of the settings. */
const account = () => within(settings()).getByRole('region', { name: 'Аккаунт' });
const settingsNav = () => within(settings()).getByRole('navigation', { name: 'Разделы настроек' });
const SKYZE = { id: 'user-1', name: 'Skyze', avatar: 'https://cdn.discordapp.com/avatars/1/a.png' };

describe('the account, in the settings', () => {
  it('signs in with Discord, optionally: the browser opens, and the player comes back signed in', async () => {
    const { accounts, user } = await renderApp();
    await user.click(within(rail()).getByRole('button', { name: 'Профиль' }));
    // A page of its own (direction C): its name in the header, no search.
    expect(document.querySelector('.brand')).toHaveTextContent('Настройки');
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(within(settingsNav()).getByRole('button', { name: /Аккаунт/ })).toHaveAttribute('aria-current', 'true');
    expect(account()).toHaveTextContent('без него всё работает как раньше');

    await user.click(within(account()).getByRole('button', { name: 'Войти через Discord' }));
    expect(accounts.calls).toEqual(['signIn']);
    expect(account()).toHaveTextContent('Подтвердите вход в браузере');
    expect(within(account()).queryByRole('button', { name: 'Войти через Discord' })).not.toBeInTheDocument();

    accounts.finishSignIn(SKYZE);
    expect(await within(account()).findByText('Skyze')).toBeInTheDocument();
    expect(within(account()).getByRole('img', { name: 'Аватар Skyze' })).toHaveAttribute('src', SKYZE.avatar);
    expect(account()).toHaveTextContent('SkyzeТверской · Без организации');
    // Who is signed in, on top of the settings' column and at the foot of the side column.
    expect(within(settingsNav()).getByRole('button', { name: /Skyze/ })).toHaveTextContent('SkyzeDiscord');
    expect(within(rail()).getByRole('button', { name: 'Профиль: Skyze' }).querySelector('img')).toHaveAttribute('src', SKYZE.avatar);
  });

  it('can give up the sign-in, and says when it failed', async () => {
    const { accounts, user } = await renderApp();
    await user.click(within(rail()).getByRole('button', { name: 'Профиль' }));
    await user.click(within(account()).getByRole('button', { name: 'Войти через Discord' }));
    await user.click(within(account()).getByRole('button', { name: 'Отмена' }));
    expect(accounts.calls).toEqual(['signIn', 'cancelSignIn']);
    expect(await within(account()).findByRole('button', { name: 'Войти через Discord' })).toBeInTheDocument();
    expect(account()).not.toHaveTextContent('Не удалось войти');

    await user.click(within(account()).getByRole('button', { name: 'Войти через Discord' }));
    accounts.finishSignIn('failed');
    expect(await within(account()).findByText(/Не удалось войти/)).toBeInTheDocument();
    expect(within(account()).getByRole('button', { name: 'Войти через Discord' })).toBeInTheDocument();
  });

  it('knows the player signed in before, and signs out', async () => {
    const { accounts, user } = await renderApp({ account: SKYZE });
    await user.click(await within(rail()).findByRole('button', { name: 'Профиль: Skyze' }));
    expect(account()).toHaveTextContent('Skyze');
    await user.click(within(account()).getByRole('button', { name: 'Выйти' }));
    expect(accounts.calls).toEqual(['signOut']);
    expect(await within(account()).findByRole('button', { name: 'Войти через Discord' })).toBeInTheDocument();
    expect(within(settingsNav()).getByRole('button', { name: /Аккаунт/ })).toHaveTextContent('Вход не выполнен');
    expect(within(rail()).getByRole('button', { name: 'Профиль' })).toBeInTheDocument();
  });

  it('lists the parts of the settings in a column: the account on top, then the rest', async () => {
    const { user } = await renderApp();
    await user.click(within(rail()).getByRole('button', { name: 'Настройки' }));
    expect(within(settingsNav()).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'АккаунтВход не выполнен',
      'Основное',
      'Внешний вид',
      'Закреплённые',
      'Законы и обновления',
      'Клавиши',
      'О программе',
    ]);
    await user.click(within(settingsNav()).getByRole('button', { name: 'Клавиши' }));
    expect(within(settingsNav()).getByRole('button', { name: 'Клавиши' })).toHaveAttribute('aria-current', 'true');
    expect(within(settingsNav()).getByRole('button', { name: /Аккаунт/ })).not.toHaveAttribute('aria-current');
  });

  it('opens with Ctrl+6 and closes with Esc', async () => {
    const { user } = await renderApp();
    await user.keyboard('{Control>}6{/Control}');
    expect(account()).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Настройки' })).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Поиск по законам' })).toHaveFocus();
  });
});
