// Feature notifications — façade publique
// Phase 4 restructuration architecture.
export { default as NotificationsBell }   from './components/notifications-bell'
export { default as NotificationsPanel }  from './components/notifications-panel'
export { useNotifications }               from './hooks/use-notifications'
export { NotificationsProvider }          from './providers/notifications-provider'
// Re-export depuis shared/ (déplacé Sprint 9 S9.a.2 pour respecter
// flux unidirectionnel — utilisé par cart, admin et plus).
export {
  NOTIF_I18N,
  formatRelativeTime,
  localizeNotifText,
} from '@shared/lib/i18n/notifications-i18n'
// API user + admin
export {
  getMyNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllReadNotifications,
  getAdminFeed,
  adminDeleteNotification,
  adminSendNotification,
} from './api/notifications'
