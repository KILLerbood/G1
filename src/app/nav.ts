/** G1 navigation: one numbered index used by the rail, the dock, G+number and the Ctrl+K palette. */
export type NavItem = { path: string; icon: string; label: [string, string]; group: 'work' | 'team' | 'more'; key?: string };

export const NAV: NavItem[] = [
  { path: '/', icon: 'bolt', label: ['يومي', 'Focus'], group: 'work', key: '1' },
  { path: '/contacts', icon: 'contacts', label: ['العملاء', 'Clients'], group: 'work', key: '2' },
  { path: '/sales-tools/pipeline', icon: 'board', label: ['المسار', 'Pipeline'], group: 'work', key: '3' },
  { path: '/tasks', icon: 'tasks', label: ['المهام', 'Tasks'], group: 'work', key: '4' },
  { path: '/schedule', icon: 'calendar', label: ['الجدول', 'Schedule'], group: 'work', key: '5' },
  { path: '/companies', icon: 'building', label: ['الشركات', 'Companies'], group: 'work', key: '6' },
  { path: '/inbox', icon: 'inbox', label: ['المحادثات', 'Inbox'], group: 'team', key: '7' },
  { path: '/announcements', icon: 'megaphone', label: ['الإعلانات', 'Announcements'], group: 'team', key: '8' },
  { path: '/sales-tools/reports', icon: 'chart', label: ['التقارير', 'Reports'], group: 'team', key: '9' },
  { path: '/sales-tools', icon: 'tools', label: ['أدوات البيع', 'Sales tools'], group: 'more' },
  { path: '/sales-tools/templates', icon: 'template', label: ['القوالب', 'Templates'], group: 'more' },
  { path: '/sales-tools/activity', icon: 'activity', label: ['سجل النشاط', 'Activity log'], group: 'more' },
  { path: '/overview', icon: 'grid', label: ['نظرة عامة', 'Overview'], group: 'more' },
  { path: '/settings', icon: 'settings', label: ['الإعدادات', 'Settings'], group: 'more' },
  { path: '/profile', icon: 'user', label: ['حسابي', 'Profile'], group: 'more' }
];

/** Is a nav item the current page? The most specific path wins (/sales-tools vs /sales-tools/pipeline). */
export function isActive(path: string, pathname: string): boolean {
  if (path === '/') return pathname === '/';
  if (!(pathname === path || pathname.startsWith(path + '/'))) return false;
  return !NAV.some((n) => n.path !== path && n.path.startsWith(path + '/') && (pathname === n.path || pathname.startsWith(n.path + '/')));
}
export const navByKey = (k: string) => NAV.find((n) => n.key === k);
