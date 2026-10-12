/**
 * M7 — local role model. UX-level gating (single-user offline app);
 * server-side enforcement is via Supabase RLS (supabase/schema.sql).
 * Roles: reader (read/search/export) < editor (+mutate/sync) < admin (+restore/repair/delete-snapshots).
 */
export const ROLES = ["reader", "editor", "admin"];

const MATRIX = {
  read: ["reader", "editor", "admin"],
  export: ["reader", "editor", "admin"],
  create: ["editor", "admin"],
  append: ["editor", "admin"],
  comment: ["editor", "admin"],
  edit: ["editor", "admin"],
  deleteCommentary: ["editor", "admin"],
  import: ["editor", "admin"],
  snapshot: ["editor", "admin"],
  sync: ["editor", "admin"],
  restore: ["admin"],
  repair: ["admin"],
  deleteSnapshot: ["admin"],
};

export function can(role, action) {
  return (MATRIX[action] || []).includes(role);
}

export function roleRank(role) {
  return ROLES.indexOf(role);
}

export function validRole(r) {
  return ROLES.includes(r) ? r : "editor";
}
