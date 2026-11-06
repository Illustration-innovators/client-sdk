/** A product the portal links but this UI cannot serve. Shown, never guessed around. */
export function ConfigError({ name, problem }: { name: string; problem: string }) {
  return (
    <div role="alert" className="rounded-md border border-danger/40 bg-danger/5 p-4 text-sm">
      <p className="font-semibold">{name} is not configured correctly</p>
      <p className="mt-1">{problem}</p>
    </div>
  );
}
