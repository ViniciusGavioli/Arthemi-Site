declare module 'bcrypt' {
  export function compare(plainText: string, hash: string): Promise<boolean>;
}
