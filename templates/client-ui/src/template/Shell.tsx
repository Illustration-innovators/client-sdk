import type { ReactNode } from "react";

/** Page frame shared by every product: header, content, footer. */
export function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-full bg-surface font-sans text-ink">
      <header className="bg-accent px-6 py-4 text-on-accent">
        <h1 className="font-heading text-xl font-semibold">{title}</h1>
      </header>
      <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">{children}</main>
      <footer className="border-t border-line px-6 py-4 text-xs text-muted">
        For producer use only. Hypothetical illustration; not a contract.
      </footer>
    </div>
  );
}
