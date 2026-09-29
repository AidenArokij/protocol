import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/renderApp';

const rail = () => screen.getByRole('navigation', { name: 'Разделы' });
const profile = () => screen.getByRole('group', { name: 'Профиль' });
const SKYZE = { id: 'user-1', name: 'Skyze', avatar: 'https://cdn.discordapp.com/avatars/1/a.png' };

describe('the profile', () => {
  it('signs in with Discord, optionally: the browser opens, and the player comes back signed in', async () => {
    const { accounts, user } = await renderApp();
    await user.click(within(rail()).getByRole('button', { name: 'Профиль' }));
    expect(profile()).toHaveTextContent('без него всё работает как раньше');

    await user.click(within(profile()).getByRole('button', { name: 'Войти через Discord' }));
    expect(accounts.calls).toEqual(['signIn']);
    expect(profile()).toHaveTextContent('Подтвердите вход в браузере');
    expect(within(profile()).queryByRole('button', { name: 'Войти через Discord' })).not.toBeInTheDocument();

    accounts.finishSignIn(SKYZE);
    expect(await within(profile()).findByText('Skyze')).toBeInTheDocument();
    expect(within(profile()).getByRole('img', { name: 'Аватар Skyze' })).toHaveAttribute('src', SKYZE.avatar);
    // The side column shows who is signed in.
    expect(within(rail()).getByRole('button', { name: 'Профиль: Skyze' }).querySelector('img')).toHaveAttribute('src', SKYZE.avatar);
  });

  it('can give up the sign-in, and says when it failed', async () => {
    const { accounts, user } = await renderApp();
    await user.click(within(rail()).getByRole('button', { name: 'Профиль' }));
    await user.click(within(profile()).getByRole('button', { name: 'Войти через Discord' }));
    await user.click(within(profile()).getByRole('button', { name: 'Отмена' }));
    expect(accounts.calls).toEqual(['signIn', 'cancelSignIn']);
    expect(await within(profile()).findByRole('button', { name: 'Войти через Discord' })).toBeInTheDocument();
    expect(profile()).not.toHaveTextContent('Не удалось войти');

    await user.click(within(profile()).getByRole('button', { name: 'Войти через Discord' }));
    accounts.finishSignIn('failed');
    expect(await within(profile()).findByText(/Не удалось войти/)).toBeInTheDocument();
    expect(within(profile()).getByRole('button', { name: 'Войти через Discord' })).toBeInTheDocument();
  });

  it('knows the player signed in before, and signs out', async () => {
    const { accounts, user } = await renderApp({ account: SKYZE });
    await user.click(await within(rail()).findByRole('button', { name: 'Профиль: Skyze' }));
    expect(profile()).toHaveTextContent('Skyze');
    await user.click(within(profile()).getByRole('button', { name: 'Выйти' }));
    expect(accounts.calls).toEqual(['signOut']);
    expect(await within(profile()).findByRole('button', { name: 'Войти через Discord' })).toBeInTheDocument();
    expect(within(rail()).getByRole('button', { name: 'Профиль' })).toBeInTheDocument();
  });

  it('opens with Ctrl+6 and closes with Esc', async () => {
    const { user } = await renderApp();
    await user.keyboard('{Control>}6{/Control}');
    expect(profile()).toBeInTheDocument();
    expect(within(rail()).getByRole('button', { name: 'Профиль' })).toHaveAttribute('aria-current', 'page');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Профиль' })).not.toBeInTheDocument();
  });
});
