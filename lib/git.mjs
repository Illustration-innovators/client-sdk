import { execFileSync } from 'node:child_process';

export function sourceCommitFor(directory, env = process.env) {
  const commit = env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Full source commit required (40 hex characters)');
  return commit;
}

export function commitMessageFor(directory, commit, env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true') return '';
  return execFileSync('git', ['log', '-1', '--format=%B', commit], { cwd: directory, encoding: 'utf8' }).trim();
}
