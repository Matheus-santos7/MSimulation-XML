export interface PasswordHasherPort {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
  authFailureDelay(): Promise<void>;
  readonly dummyPasswordHash: string;
}
