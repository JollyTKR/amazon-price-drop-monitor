declare module "better-sqlite3" {
  namespace Database {
    interface Statement<BindParameters extends unknown[] | object = unknown[]> {
      run(...params: BindParameters extends unknown[] ? BindParameters : [BindParameters]): RunResult;
      get(...params: BindParameters extends unknown[] ? BindParameters : [BindParameters]): unknown;
      all(...params: BindParameters extends unknown[] ? BindParameters : [BindParameters]): unknown[];
    }

    interface RunResult {
      changes: number;
      lastInsertRowid: number | bigint;
    }
  }

  interface Database {
    exec(sql: string): this;
    pragma(source: string): unknown;
    prepare<BindParameters extends unknown[] | object = unknown[]>(source: string): Database.Statement<BindParameters>;
    close(): void;
  }

  interface DatabaseConstructor {
    new (filename: string, options?: { readonly?: boolean; fileMustExist?: boolean; timeout?: number; verbose?: (message?: unknown, ...additionalArgs: unknown[]) => void }): Database;
    (filename: string, options?: { readonly?: boolean; fileMustExist?: boolean; timeout?: number; verbose?: (message?: unknown, ...additionalArgs: unknown[]) => void }): Database;
  }

  const Database: DatabaseConstructor;
  export = Database;
}
