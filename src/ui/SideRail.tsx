import { useEffect, useRef, useState, type ReactNode } from 'react';

/** A section of the app in the side menu. */
export interface RailItem {
  id: string;
  label: string;
  icon: ReactNode;
  /** Not there yet, or nothing to show: shown dimmed, with the reason as its tip. */
  disabled?: boolean;
  hint?: string;
  onSelect: () => void;
}

/** How long the menu stays after the mouse has left it. */
export const HIDE_DELAY = 500;

/**
 * The side menu (direction C): hidden while playing, it slides in when the mouse comes to the left edge of the
 * window — a thin line there shows where — or at a tap of Alt, and goes again half a second after the mouse
 * leaves. Ctrl+1…9 opens the numbered sections from the keyboard; Esc closes the menu first.
 */
export function SideRail({
  top,
  items,
  current,
  tip,
  onTipSeen,
}: {
  /** Above the sections: the server's mark. */
  top?: ReactNode;
  items: RailItem[];
  current?: string;
  /** The first time: a word on where the menu is. */
  tip?: boolean;
  onTipSeen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);
  const latest = useRef({ items, open });
  latest.current = { items, open };

  const cancelHide = () => window.clearTimeout(hideTimer.current);
  const show = () => {
    cancelHide();
    setOpen(true);
    if (tip) onTipSeen?.();
  };
  const scheduleHide = () => {
    cancelHide();
    hideTimer.current = window.setTimeout(() => setOpen(false), HIDE_DELAY);
  };
  useEffect(() => cancelHide, []);

  const select = (item: RailItem) => {
    if (item.disabled) return;
    setOpen(false);
    item.onSelect();
  };

  useEffect(() => {
    // Alt alone opens and closes the menu: pressed and let go with no other key in between.
    let altAlone = false;
    const onDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        altAlone = !e.repeat;
        return;
      }
      altAlone = false;
      const { items: list, open: isOpen } = latest.current;
      const digit = /^Digit([1-9])$/.exec(e.code);
      if (digit && e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        const item = list[Number(digit[1]) - 1];
        if (item && !item.disabled) {
          e.preventDefault();
          setOpen(false);
          item.onSelect();
        }
        return;
      }
      // Before the overlay's own Esc, which would step back or hide the window.
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setOpen(false);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== 'Alt' || !altAlone) return;
      altAlone = false;
      // Windows would otherwise move the focus to the (absent) window menu.
      e.preventDefault();
      setOpen((v) => !v);
      if (tip) onTipSeen?.();
    };
    window.addEventListener('keydown', onDown, true);
    window.addEventListener('keyup', onUp, true);
    return () => {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
    };
  }, [tip, onTipSeen]);

  return (
    <>
      <div className="rail-edge" aria-hidden="true" onMouseEnter={show} />
      {/* Closed, it is out of reach of the keyboard and of screen readers too. */}
      <nav
        className="rail"
        aria-label="Разделы"
        data-open={open}
        aria-hidden={!open}
        inert={!open}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
      >
        {top}
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            className="rail__item"
            aria-current={current === item.id ? 'page' : undefined}
            disabled={item.disabled}
            title={item.hint ?? (i < 9 ? `${item.label} · Ctrl+${i + 1}` : item.label)}
            onClick={() => select(item)}
          >
            {item.icon}
            <span className="rail__label">{item.label}</span>
          </button>
        ))}
      </nav>
      {tip && !open && (
        <div className="rail-tip" role="note">
          <span>
            Разделы — у левого края: наведите туда мышь или нажмите <span className="kbd">Alt</span>.
          </span>
          <button className="link" type="button" onClick={onTipSeen}>
            Понятно
          </button>
        </div>
      )}
    </>
  );
}
