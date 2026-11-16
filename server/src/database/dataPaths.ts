import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the canonical BLIND WAR repository root reliably regardless of `process.cwd()`.
 * Walks upward from this module until `package.json` (blind-war) is located.
 */
export function resolveProjectRoot(): string {
  let cursor = THIS_DIR;
  for (let i = 0; i < 6; i += 1) {
    const pkgPath = path.join(cursor, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { name?: string };
        if (pkg.name === 'blind-war') {
          return cursor;
        }
      } catch {
        return cursor;
      }
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return process.cwd();
}

/**
 * Canonical persistent data directory (`<projectRoot>/data` or `BLIND_WAR_DATA_DIR`).
 * Anchoring to the project root ensures restarting the server from any terminal directory
 * always reuses the same files instead of creating new ones.
 */
export function resolveDataDirectory(): string {
  if (process.env.BLIND_WAR_DATA_DIR && process.env.BLIND_WAR_DATA_DIR.trim().length > 0) {
    return path.resolve(process.env.BLIND_WAR_DATA_DIR.trim());
  }
  return path.resolve(resolveProjectRoot(), 'data');
}

/** Resolve a canonical persistent file inside `data/`. */
export function resolveDataFilePath(fileName: string): string {
  return path.resolve(resolveDataDirectory(), fileName);
}

/** Remove stale `.tmp` staging files left by an unexpected process termination. */
export function sweepStaleTempFilesSync(dirPath: string): void {
  try {
    if (!fs.existsSync(dirPath)) return;
    for (const entry of fs.readdirSync(dirPath)) {
      if (entry.endsWith('.tmp')) {
        try {
          fs.unlinkSync(path.join(dirPath, entry));
        } catch {
          // Ignore locked temp file
        }
      }
    }
  } catch {
    // Ignore directory read error
  }
}

/**
 * Atomically write text/JSON content to `targetPath` using a single `.tmp` staging file
 * and optional single `.bak` snapshot of the previous valid file.
 */
export function atomicWriteTextFileSync(
  targetPath: string,
  content: string,
  options?: { readonly createBackup?: boolean; readonly mode?: number; readonly validateJsonBackup?: boolean },
): void {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });

  const tmpPath = `${targetPath}.tmp`;
  const bakPath = `${targetPath}.bak`;

  try {
    if (options?.createBackup && fs.existsSync(targetPath)) {
      try {
        const existingRaw = fs.readFileSync(targetPath, 'utf-8');
        let canBackup = existingRaw.trim().length > 0;
        if (canBackup && options?.validateJsonBackup !== false) {
          JSON.parse(existingRaw);
        }
        if (canBackup) {
          const bakTmpPath = `${bakPath}.tmp`;
          fs.writeFileSync(bakTmpPath, existingRaw, { encoding: 'utf-8', mode: options?.mode });
          try {
            fs.renameSync(bakTmpPath, bakPath);
          } catch {
            fs.copyFileSync(bakTmpPath, bakPath);
            if (fs.existsSync(bakTmpPath)) fs.unlinkSync(bakTmpPath);
          }
        }
      } catch {
        // Existing primary file is unreadable or corrupt: never overwrite a healthy `.bak` with corrupt data
      }
    }

    fs.writeFileSync(tmpPath, content, { encoding: 'utf-8', mode: options?.mode });
    try {
      fs.renameSync(tmpPath, targetPath);
    } catch {
      // Windows antivirus / indexer fallback when rename encounters transient EPERM/EBUSY
      fs.copyFileSync(tmpPath, targetPath);
    }
  } finally {
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
