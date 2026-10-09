// Migration vers Context : la logique a été déplacée dans
// `src/context/NotificationsContext.jsx` (voir le commentaire d'en-tête
// pour le pourquoi). On garde ce fichier comme re-export pour ne pas
// casser les imports existants de `useNotifications`.
export { useNotifications } from '@features/notifications/providers/notifications-provider'
