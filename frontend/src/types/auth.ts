export type UserRole = "USER" | "ADMIN";

export type AccountStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

export interface AccountView {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
}

export interface AuthSessionItem {
  id: string;
  client: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
}

export interface AdminUserDetails {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  registeredAt: string;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
  deletedAt: string | null;
  activeSessionCount: number;
  sessionActivity: {
    activeSessionCount: number;
    mostRecentActivityAt: string | null;
    oldestActiveSessionCreatedAt: string | null;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminUserListResponse {
  users: AdminUserListItem[];
  pagination: PaginationMeta;
}

export interface ActorSummary {
  id: string;
  username: string;
  email: string;
}

export interface AdminAuditLogEntry {
  id: string;
  actorId: string | null;
  actor: ActorSummary | null;
  targetId: string | null;
  target: ActorSummary | null;
  action: string;
  timestamp: string;
  metadata: Record<string, unknown> | null;
}

export interface AdminAuditLogResponse {
  events: AdminAuditLogEntry[];
  pagination: PaginationMeta;
}

export interface AuthSuccessPayload {
  user: AccountView;
  csrfToken: string;
}
