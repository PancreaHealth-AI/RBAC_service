export interface RequestUser {
  sub: string;
  email?: string;
  username?: string;
  roles?: string[];
  sessionId?: string;
}