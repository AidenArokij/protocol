import { CloseIcon, InfoIcon } from './icons';
import type { Notices } from './notice';

/** A notice from the repository under the overlay's header: what it says, a page to open, and a cross to close it. */
export function NoticeBanner({ notices }: { notices: Notices }) {
  const { notice } = notices;
  if (!notice) return null;
  return (
    <div className="update notice" role="status" aria-label="Объявление">
      <InfoIcon />
      <div className="update__text">
        <strong>{notice.title}</strong>
        {notice.text && <span>{notice.text}</span>}
      </div>
      <span className="sp" />
      {notice.link && (
        <button className="btn btn--primary update__go" type="button" onClick={() => notices.open(notice.link!.url)}>
          {notice.link.label}
        </button>
      )}
      <button className="icon-btn" type="button" aria-label="Скрыть объявление" title="Скрыть" onClick={notices.dismiss}>
        <CloseIcon size={16} />
      </button>
    </div>
  );
}
