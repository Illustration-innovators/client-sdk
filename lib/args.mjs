/** Minimal argument parser: `--name value`, `--flag`, `--no-flag`, positionals. */
export function parseArgs(argv, { booleans = [], strings = [] } = {}) {
  const flags = {};
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) { positionals.push(arg); continue; }
    const raw = arg.slice(2);
    const [name, inline] = raw.split('=', 2);
    if (name.startsWith('no-') && booleans.includes(name.slice(3))) { flags[camel(name.slice(3))] = false; continue; }
    if (booleans.includes(name)) { flags[camel(name)] = inline === undefined ? true : inline !== 'false'; continue; }
    if (strings.includes(name)) {
      const value = inline ?? argv[index + 1];
      if (value === undefined || (inline === undefined && value.startsWith('--'))) throw new Error(`--${name} needs a value`);
      if (inline === undefined) index += 1;
      flags[camel(name)] = value;
      continue;
    }
    throw new Error(`Unknown option --${name}`);
  }
  return { flags, positionals };
}

function camel(name) {
  return name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/** Runs an async CLI main, printing a short error and exiting 1 on failure. */
export function runCli(main) {
  main(process.argv.slice(2)).then((code) => {
    if (typeof code === 'number' && code !== 0) process.exitCode = code;
  }, (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    if (process.env.ILLUSTRATA_DEBUG && error instanceof Error) console.error(error.stack);
    process.exitCode = 1;
  });
}
