
export type UnauthenticatedAuthContext = {
  authenticated: false;
  authKey: undefined;
};

export type AuthenticatedAuthContext = {
  authenticated: true;
  authKey: string;
};

// deno-lint-ignore no-explicit-any
export type AuthState = Record<string, any>;

export type AuthMiddlewareResponse<
  State extends AuthState = AuthState,
> = {
  authKey?: string;
  allowPublic?: boolean;
  state: State;
};

export type AuthMiddleware<
  State extends AuthState = AuthState,
> = () => Promise<AuthMiddlewareResponse<State>>;

