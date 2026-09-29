import { useState } from 'react';
import type { Organization, ServerPack } from '../core';
import { useAccount } from '../account/AccountContext';
import type { Account } from '../account/types';
import { DiscordIcon, ProfileIcon, ServerIcon } from './icons';

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

/** The top of the settings' column: who is signed in, or that nobody is. Leads to the account block. */
export function AccountCard({ current, onSelect }: { current: boolean; onSelect: () => void }) {
  const { status } = useAccount();
  const account = status.kind === 'signed-in' ? status.account : null;
  return (
    <button className="setnav__account" type="button" aria-current={current ? 'true' : undefined} onClick={onSelect}>
      {account ? <Avatar account={account} size={36} /> : <span className="setnav__nobody"><ProfileIcon size={22} /></span>}
      <span className="setnav__who">
        <span className="setnav__name">{account ? account.name : 'Аккаунт'}</span>
        <span className="setnav__via">{account ? 'Discord' : 'Вход не выполнен'}</span>
      </span>
    </button>
  );
}

const FAILED = {
  failed: 'Не удалось войти. Проверьте интернет и попробуйте ещё раз.',
  unsupported: 'Вход работает только в самом хелпере, не в браузере.',
  cancelled: '',
};

/**
 * The account, first in the settings. Signed in: the player's card of the mockup (avatar, name,
 * server · faction, Discord) and signing out. Signed out: signing in with Discord, optional for now.
 */
export function AccountSection({ server, organization }: { server: ServerPack['server']; organization?: Organization }) {
  const { status, signIn, cancelSignIn, signOut } = useAccount();
  const faction = organization && organization.id !== 'none' ? organization.name : 'Без организации';

  if (status.kind === 'signed-in') {
    const { account } = status;
    return (
      <>
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
        <div className="set__row">
          <span className="set__label">Скоро: настройки, избранное и закреплённое — на всех ваших компьютерах.</span>
          <span className="sp" />
          <button className="settings__button" type="button" onClick={signOut}>
            Выйти
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="login">
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
  );
}
