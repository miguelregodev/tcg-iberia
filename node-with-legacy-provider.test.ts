import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('./node-with-legacy-provider.js', import.meta.url), 'utf8');

function run(args: string[], env: Record<string, string> = {}) {
  const execSync = vi.fn();
  const process = {
    argv: ['node', 'wrapper', ...args],
    env: { ...env },
    exit: (code: number) => { throw new Error(`exit:${code}`); },
  };
  runInNewContext(source, { process, console: { error: vi.fn() }, require: () => ({ execSync }) });
  return { env: process.env, execSync };
}

describe('development compilation isolation', () => {
  it('isolates the default server and previews by their requested port', () => {
    expect(run(['next', 'dev']).env.NEXT_DEV_DIST_DIR).toBe('.next/dev-3000');
    expect(run(['next', 'dev', '--port', '34122']).env.NEXT_DEV_DIST_DIR).toBe('.next/dev-34122');
    expect(run(['next', 'dev', '-p', '34123']).env.NEXT_DEV_DIST_DIR).toBe('.next/dev-34123');
    expect(run(['next', 'dev', '--port=34124']).env.NEXT_DEV_DIST_DIR).toBe('.next/dev-34124');
    expect(run(['next', 'dev'], { PORT: '34125' }).env.NEXT_DEV_DIST_DIR).toBe('.next/dev-34125');
  });

  it('keeps production on the standard output directory and enables Redsys encryption', () => {
    const result = run(['next', 'build'], { NEXT_DEV_DIST_DIR: '.next/dev-3000' });
    expect(result.env.NEXT_DEV_DIST_DIR).toBeUndefined();
    expect(result.env.NODE_OPTIONS).toBe('--openssl-legacy-provider');
    expect(result.execSync).toHaveBeenCalledWith('next build', { stdio: 'inherit' });
  });

  it('rejects an invalid development port before executing Next', () => {
    expect(() => run(['next', 'dev', '--port', '../outside'])).toThrow('exit:1');
    expect(() => run(['next', 'dev', '--port', '65536'])).toThrow('exit:1');
  });
});
