export type AdminRole = 'ADMIN' | 'INVENTORY' | 'STAFF' | 'USER' | '';

const INTERNAL_ROLES = ['ADMIN', 'INVENTORY', 'STAFF'];

export function normalizeRole(role?: string | null): AdminRole {
  const normalized = String(role || '').trim().toUpperCase();
  if (normalized === 'ADMIN' || normalized === 'INVENTORY' || normalized === 'STAFF' || normalized === 'USER') {
    return normalized;
  }
  return '';
}

export function isInternalRole(role?: string | null) {
  return INTERNAL_ROLES.includes(normalizeRole(role));
}

export function canManageUsers(role?: string | null) {
  return normalizeRole(role) === 'ADMIN';
}

export function canManageVouchers(role?: string | null) {
  return normalizeRole(role) === 'ADMIN';
}

export function canViewStats(role?: string | null) {
  return normalizeRole(role) === 'ADMIN';
}

export function canManageBanners(role?: string | null) {
  return normalizeRole(role) === 'ADMIN';
}

export function canManageProducts(role?: string | null) {
  return ['ADMIN', 'INVENTORY'].includes(normalizeRole(role));
}

export function canDeleteProducts(role?: string | null) {
  return normalizeRole(role) === 'ADMIN';
}

export function canManageOrders(role?: string | null) {
  return ['ADMIN', 'STAFF'].includes(normalizeRole(role));
}

export function canHandleChat(role?: string | null) {
  return ['ADMIN', 'STAFF'].includes(normalizeRole(role));
}

export function canManagePosts(role?: string | null) {
  return ['ADMIN', 'STAFF'].includes(normalizeRole(role));
}

export function canManageReviews(role?: string | null) {
  return ['ADMIN', 'STAFF'].includes(normalizeRole(role));
}

export function canAccessPath(path: string, role?: string | null) {
  const normalizedPath = path.split('?')[0].replace(/\/+$/, '') || '/';

  if (normalizedPath === '/' || normalizedPath === '/dashboard' || normalizedPath === '/notifications') {
    return isInternalRole(role);
  }
  if (normalizedPath === '/stats') return canViewStats(role);
  if (normalizedPath === '/products' || normalizedPath.startsWith('/products/')) return canManageProducts(role);
  if (normalizedPath === '/orders') return canManageOrders(role);
  if (normalizedPath === '/chat') return canHandleChat(role);
  if (normalizedPath === '/users') return canManageUsers(role);
  if (normalizedPath === '/posts') return canManagePosts(role);
  if (normalizedPath === '/vouchers') return canManageVouchers(role);
  if (normalizedPath === '/reviews') return canManageReviews(role);

  return false;
}
