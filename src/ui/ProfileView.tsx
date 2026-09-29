import { useState } from 'react';
import { useAccount } from '../account/AccountContext';
import type { Account } from '../account/types';
import { BackIcon, DiscordIcon, ProfileIcon } from './icons';

/** The player's Discord avatar, or the profile icon when they have none or it can't be loaded (offline). */
export function Avatar({ account, size, label }: { account: Account; size: number; label?: string }) {
  const [broken, setBroken] = useState(false);
  if (!account.avatar || broken) return <ProfileIcon size={size} />;
  return (
    <img
      className="avatar"
      src={account.avatar}
      alt={label ?? ''}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

const FAILED = {
  failed: 'Не удалось войти. Проверьте интернет и попробуйте ещё раз.',
  unsupported: 'Вход работает только в самом хелпере, не в браузере.',
  cancelled: '',
};

/** The profile (2.1): signing in with Discord, optional for now; who is signed in, and signing out. */
export function ProfileView({ backLabel, onBack }: { backLabel: string; onBack: () => void }) {
  const { status, signIn, cancelSignIn, signOut } = useAccount();

  return (
    <div className="settings" role="group" aria-label="Профиль">
      <button className="back" type="button" onClick={onBack}>
        <BackIcon />
        <span>{backLabel}</span>
      </button>
      <h2 className="art__title">Профиль</h2>

      {status.kind === 'signed-in' ? (
        <section className="set profile" aria-label="Аккаунт">
          <div className="profile__who">
            <Avatar account={status.account} size={56} label={`Аватар ${status.account.name}`} />
            <div className="profile__names">
              <span className="profile__name">{status.account.name}</span>
              <span className="profile__via">
                <DiscordIcon size={14} /> Вход через Discord
              </span>
            </div>
            <span className="sp" />
            <button className="settings__button" type="button" onClick={signOut}>
              Выйти
            </button>
          </div>
          <p className="set__hint">
            Скоро здесь будут игровой ник и должность, а настройки, избранное и закреплённое станут одинаковыми на всех ваших компьютерах.
          </p>
        </section>
      ) : (
        <section className="set profile" aria-label="Вход">
          <p className="profile__lead">
            Войдите через Discord — скоро через аккаунт придут памятки от лидера фракции, а настройки, избранное и закреплённое будут
            одинаковыми на всех ваших компьютерах. Пока вход по желанию: без него всё работает как раньше.
          </p>
          {status.kind === 'signing-in' ? (
            <div className="profile__wait">
              <span>Подтвердите вход в браузере — он открылся в Discord.</span>
              <span className="sp" />
              <button className="settings__button" type="button" onClick={cancelSignIn}>
                Отмена
              </button>
            </div>
          ) : (
            <>
              {status.kind === 'signed-out' && status.error && (
                <p className="profile__error" role="alert">
                  {FAILED[status.error]}
                </p>
              )}
              <button className="profile__discord" type="button" disabled={status.kind === 'loading'} onClick={signIn}>
                <DiscordIcon size={20} />
                Войти через Discord
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
