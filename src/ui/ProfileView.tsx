import { useState } from 'react';
import type { Organization, ServerPack } from '../core';
import { useAccount } from '../account/AccountContext';
import type { Account } from '../account/types';
import { DiscordIcon, ServerIcon } from './icons';

/**
 * The player's Discord avatar; without one, or when it can't be loaded (offline), their initials on a
 * gradient, as in the mockup.
 */
export function Avatar({ account, size, label }: { account: Account; size: number; label?: string }) {
  const [broken, setBroken] = useState(false);
  if (!account.avatar || broken) {
    const initials = account.name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '?';
    return (
      <span className="avatar avatar--initials" role={label ? 'img' : undefined} aria-label={label} style={{ width: size, height: size, fontSize: size * 0.36 }}>
        {initials}
      </span>
    );
  }
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

/**
 * The profile (direction C). Signed out: the sign-in screen of the mockup — optional for now, so it lives
 * here rather than before the helper. Signed in: the player's card; the sync, the stats and the leader's
 * tiles come with their own tickets.
 */
export function ProfileView({ server, organization }: { server: ServerPack['server']; organization?: Organization }) {
  const { status, signIn, cancelSignIn, signOut } = useAccount();
  const faction = organization && organization.id !== 'none' ? organization.name : 'Без организации';

  if (status.kind === 'signed-in') {
    const { account } = status;
    return (
      <div className="profile" role="group" aria-label="Профиль">
        <div className="pcard">
          <Avatar account={account} size={52} label={`Аватар ${account.name}`} />
          <div className="pcard__who">
            <div className="pcard__name">{account.name}</div>
            <div className="pcard__meta">
              <ServerIcon id={server.id} size={14} />
              {server.name} · {faction}
            </div>
          </div>
          <span className="sp" />
          <span className="pcard__via" title="Вход через Discord">
            <DiscordIcon size={18} />
          </span>
        </div>
        <button className="link-btn profile__out" type="button" onClick={signOut}>
          Выйти
        </button>
      </div>
    );
  }

  return (
    <div className="profile" role="group" aria-label="Профиль">
      <div className="login">
        <div className="login__logo" aria-hidden="true">
          РО
        </div>
        <h2 className="login__title">РО Хелпер</h2>
        <p className="login__lead">Войдите — скоро настройки, закреплённое и избранное будут с вами на любом компьютере.</p>
        {status.kind === 'signing-in' ? (
          <div className="login__wait">
            <span>Подтвердите вход в браузере — он открылся в Discord.</span>
            <button className="settings__button" type="button" onClick={cancelSignIn}>
              Отмена
            </button>
          </div>
        ) : (
          <>
            {status.kind === 'signed-out' && status.error && (
              <p className="login__error" role="alert">
                {FAILED[status.error]}
              </p>
            )}
            <button className="oauth oauth--discord" type="button" disabled={status.kind === 'loading'} onClick={signIn}>
              <DiscordIcon size={20} />
              Войти через Discord
            </button>
          </>
        )}
        <small className="login__note">
          Вход по желанию: без него всё работает как раньше. Мы получим ник, аватар и почту из Discord. После входа интернет не нужен.
        </small>
      </div>
    </div>
  );
}
