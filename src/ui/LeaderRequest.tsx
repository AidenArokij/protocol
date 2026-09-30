import { useState } from 'react';
import type { Organization } from '../core';
import { factionName, serverName } from './AdminView';
import { useCapabilities, useRoles } from './roles';

/**
 * A player of a faction asks to be its leader (ticket 15); the admin answers in their part of the settings.
 * Nothing to ask without a faction, or for a role they already have here.
 */
export function LeaderRequestRow({ server, organization }: { server: string; organization?: Organization }) {
  const { mine, api, refresh, publish } = useRoles();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [failed, setFailed] = useState(false);
  const can = useCapabilities({ server, organization });
  if (!mine || !organization || !can.has('faction.lead-request')) return null;

  const request = mine.request;
  if (request?.status === 'pending') {
    return (
      <div className="set__row">
        <span className="set__label">
          Заявка на лидера {factionName(request.server, request.organization)} на сервере {serverName(request.server)} ждёт ответа
          администратора.
        </span>
      </div>
    );
  }
  const turnedDown = request?.status === 'rejected' && request.server === server && request.organization === organization.id;
  if (!open) {
    return (
      <div className="set__row">
        <span className="set__label">{turnedDown ? 'Заявку на лидера отклонили.' : 'Лидер фракции? Администратор выдаст роль по заявке.'}</span>
        <span className="sp" />
        <button className="settings__button" type="button" onClick={() => setOpen(true)}>
          {turnedDown ? 'Подать снова' : 'Я лидер фракции'}
        </button>
      </div>
    );
  }

  const send = async () => {
    try {
      // The admin finds the player by their card: it goes first, as it is now.
      await publish();
      await api.requestLeader(server, organization.id, note);
      setOpen(false);
      setFailed(false);
      await refresh();
    } catch {
      setFailed(true);
    }
  };
  return (
    <div className="leader-req">
      <label className="set__row">
        <span className="set__label pcard__field">Чем подтвердить</span>
        <input
          className="presets__input"
          type="text"
          aria-label="Чем подтвердить"
          placeholder="Ссылка на пост о назначении на форуме"
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {failed && (
        <p className="login__error" role="alert">
          Не удалось отправить заявку — проверьте интернет.
        </p>
      )}
      <div className="set__row">
        <span className="set__label">
          Лидер {organization.name} · {serverName(server)}
        </span>
        <span className="sp" />
        <button className="link-btn" type="button" onClick={() => setOpen(false)}>
          Отмена
        </button>
        <button className="settings__button" type="button" onClick={() => void send()}>
          Отправить заявку
        </button>
      </div>
    </div>
  );
}
