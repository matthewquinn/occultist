export interface Scope {
  public(): Scope;
  auth(): Scope;
  use(): Scope;
}
