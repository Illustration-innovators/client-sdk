const SESSION_EXPIRED_EVENT = "illustrata:hosted-tool-session-expired";

interface HostedToolSessionExpiredDetail {
  signInUrl: string;
}

export function buildHostedToolSignInUrl(
  apiBase: string,
  hostedToolSlug: string,
): string | null {
  try {
    const currentPage = new URL(window.location.href);
    const base = new URL(apiBase, currentPage);
    if (base.protocol !== "https:" && base.protocol !== "http:") return null;
    if (base.origin !== currentPage.origin) return null;
    return new URL(
      `/tools/${encodeURIComponent(hostedToolSlug)}`,
      base.origin,
    ).toString();
  } catch {
    return null;
  }
}

export function notifyHostedToolSessionExpired(
  apiBase: string,
  embedToken: string,
): string | null {
  if (!embedToken.startsWith("hosted:")) return null;
  const hostedToolSlug = embedToken.slice("hosted:".length);
  const signInUrl = buildHostedToolSignInUrl(apiBase, hostedToolSlug);
  if (!signInUrl) return null;

  window.dispatchEvent(
    new CustomEvent<HostedToolSessionExpiredDetail>(SESSION_EXPIRED_EVENT, {
      detail: { signInUrl },
    }),
  );
  return signInUrl;
}

export function onHostedToolSessionExpired(
  listener: (signInUrl: string) => void,
): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<HostedToolSessionExpiredDetail>)
      .detail;
    if (detail?.signInUrl) listener(detail.signInUrl);
  };
  window.addEventListener(SESSION_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
}

export function renderHostedToolSessionExpired(
  target: HTMLElement,
  signInUrl: string,
): void {
  renderHostedToolMessage(
    target,
    "Your session has expired",
    "For your security, sign in again to continue using the illustration tool.",
    { label: "Sign in again", signInUrl },
  );
}

export function renderHostedToolUnavailable(target: HTMLElement): void {
  renderHostedToolMessage(
    target,
    "We can't open this tool right now",
    "Please try again in a few minutes. If the problem continues, contact your portal administrator.",
  );
}

function renderHostedToolMessage(
  target: HTMLElement,
  headingText: string,
  messageText: string,
  action?: { label: string; signInUrl: string },
): void {
  const panel = document.createElement("main");
  panel.setAttribute("data-illustrata-hosted-tool-message", "");
  panel.setAttribute("role", "alert");
  panel.style.cssText = [
    "box-sizing:border-box",
    "max-width:560px",
    "margin:64px auto",
    "padding:32px",
    "border:1px solid #d7dce3",
    "border-radius:12px",
    "background:#fff",
    "box-shadow:0 12px 32px rgba(23,33,49,.08)",
    "color:#172131",
    'font:16px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    "text-align:center",
  ].join(";");

  const heading = document.createElement("h1");
  heading.textContent = headingText;
  heading.style.cssText =
    "margin:0 0 12px;font-size:24px;line-height:1.25;color:#172131;";

  const message = document.createElement("p");
  message.textContent = messageText;
  message.style.cssText = action
    ? "margin:0 0 24px;color:#526071;"
    : "margin:0;color:#526071;";

  panel.append(heading, message);
  let button: HTMLButtonElement | null = null;
  if (action) {
    button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.style.cssText = [
      "border:0",
      "border-radius:8px",
      "padding:11px 20px",
      "background:#1f5f4a",
      "color:#fff",
      'font:600 15px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      "cursor:pointer",
    ].join(";");
    button.addEventListener("click", () =>
      window.location.assign(action.signInUrl),
    );
    panel.append(button);
  }

  target.replaceChildren(panel);
  button?.focus();
}

