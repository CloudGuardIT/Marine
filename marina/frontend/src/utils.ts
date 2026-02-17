export const STATUS_LABELS: Record<string, string> = {
  parked: 'חונה',
  in_water: 'במים',
  transit: 'בהעברה',
  maintenance: 'תחזוקה',
  available: 'פנוי',
  occupied: 'תפוס',
  reserved: 'שמור',
  pending: 'ממתין',
  accepted: 'אושר',
  in_progress: 'בביצוע',
  completed: 'הושלם',
  cancelled: 'בוטל',
  active: 'פעיל',
};

export const ACTION_LABELS: Record<string, string> = {
  vessel_created: 'כלי שייט נוצר',
  vessel_updated: 'כלי שייט עודכן',
  vessel_deleted: 'כלי שייט נמחק',
  vessel_launched: 'כלי שייט הושק',
  vessel_retrieved: 'כלי שייט נשלף',
  vessel_maintenance: 'תחזוקה',
  tractor_requested: 'בקשת טרקטור',
  tractor_accepted: 'בקשה אושרה',
  tractor_started: 'עבודה החלה',
  tractor_cancelled: 'בקשה בוטלה',
  tractor_auto_assigned: 'הקצאה אוטומטית',
  tractor_escalated: 'עדיפות עלתה',
  tractor_timeout: 'חזרה לתור',
  tractor_stale_alert: 'התראת עיכוב',
  reservation_expired: 'הזמנה פגה',
  spot_sync_fix: 'תיקון מקום',
  user_login: 'כניסה למערכת',
};

export const VESSEL_TYPES: Record<string, string> = {
  sailboat: 'מפרשית',
  motorboat: 'סירת מנוע',
  jetski: 'אופנוע ים',
  yacht: 'יאכטה',
  fishing: 'סירת דיג',
  other: 'אחר',
};

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('he-IL');
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'עכשיו';
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}
