export type AuthUser = {
  id: string;
  name: string;
  email: string;
  username?: string;
  nickname?: string;
};

export type AuthApiUser = {
  id: number | string;
  username: string;
  email?: string;
  nickname?: string;
};

export type AuthApiPayload = {
  access: string;
  refresh: string;
  user: AuthApiUser;
};

export type RefreshTokenPayload = {
  access: string;
  refresh?: string;
};
