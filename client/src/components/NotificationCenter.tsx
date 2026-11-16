import React, { useEffect, useRef, useState } from 'react';
import type { ClientNotificationItem } from '../../../shared/src/index.js';

export interface NotificationCenterProps {
  readonly notifications: readonly ClientNotificationItem[];
  readonly onMarkRead: (id: string) => void;
  readonly onMarkAllRead: () => void;
  readonly onClearAll: () => void;
  readonly onNavigate?: (screen: string) => void;
}

const CATEGORY_ICON: Readonly<Record<ClientNotificationItem['category'], string>> = {
  invitation: '📩',
  match_start: '⚔️',
  message: '💬',
  account: '👤',
  update: '✨',
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onNavigate,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  return (
    <div className="bw-notif-wrapper" ref={containerRef}>
      <button
        type="button"
        className="bw-notif-bell-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications (${unreadCount} non lue${unreadCount > 1 ? 's' : ''})`}
        title="Centre de notifications"
      >
        🔔
        {unreadCount > 0 && <span className="bw-notif-badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="bw-notif-popover" role="dialog" aria-label="Notifications">
          <div className="bw-notif-popover-header">
            <strong>Notifications ({unreadCount} non lue{unreadCount > 1 ? 's' : ''})</strong>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="bw-btn bw-btn-ghost bw-btn-sm"
                  onClick={onMarkAllRead}
                >
                  ✓ Tout lire
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  className="bw-btn bw-btn-ghost bw-btn-sm"
                  onClick={onClearAll}
                >
                  Effacer
                </button>
              )}
            </div>
          </div>

          <div className="bw-notif-popover-list">
            {notifications.length === 0 ? (
              <div style={{ padding: '1.1rem', textAlign: 'center' }} className="bw-muted-small">
                Aucune notification pour le moment.
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`bw-notif-item ${!n.read ? 'unread' : ''}`}
                  onClick={() => {
                    onMarkRead(n.id);
                    if (n.targetScreen && onNavigate) {
                      onNavigate(n.targetScreen);
                      setOpen(false);
                    }
                  }}
                >
                  <span className="bw-notif-item-title">
                    {CATEGORY_ICON[n.category]} {n.title}
                  </span>
                  <span className="bw-notif-item-msg">{n.message}</span>
                  <span className="bw-notif-item-time">
                    {new Date(n.createdAtIso).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {!n.read ? ' • Non lu' : ''}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
