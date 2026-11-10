// Windows only. When Playwright stops the browser-test API server it
// force-kills it, and some of the embedded Postgres worker processes can
// survive, holding the data folder open. This stops ONLY processes that
// (a) run this project's own embedded Postgres binary and (b) have lost
// their parent process — i.e. leftovers. A Postgres belonging to a test
// run that is still going has a living parent and is never touched.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const embeddedDir = path.resolve(here, '../../node_modules/@embedded-postgres').replace(/\\/g, '/').toLowerCase();

export function reapOrphanedTestPostgres() {
  if (process.platform !== 'win32') return [];
  const script = `
    $all = Get-CimInstance Win32_Process
    $ids = @{}; foreach ($p in $all) { $ids[[int]$p.ProcessId] = $true }
    $all | Where-Object { $_.Name -eq 'postgres.exe' -and $_.CommandLine } |
      ForEach-Object { '{0}|{1}|{2}' -f $_.ProcessId, ($ids.ContainsKey([int]$_.ParentProcessId)), $_.CommandLine }`;
  let output;
  try {
    output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' });
  } catch {
    return [];
  }
  const stopped = [];
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const [pid, parentAlive, ...cmd] = line.split('|');
    const commandLine = cmd.join('|').replace(/\\/g, '/').toLowerCase();
    if (parentAlive === 'False' && commandLine.includes(embeddedDir)) {
      try {
        process.kill(Number(pid));
        stopped.push(Number(pid));
      } catch {
        // already gone
      }
    }
  }
  return stopped;
}
