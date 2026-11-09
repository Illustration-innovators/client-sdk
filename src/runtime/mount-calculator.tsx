import { createElement, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { buildCalculatorProductQuery, callEmbedProduct, reportClientError, type CalculatorProductRequestOptions } from './api/embed-client';
import { createBrowserWorkspace } from './api/browser-workspace';
import { createWorkspaceRuntime } from './api/workspace-client';
import { runTemplate } from './template-entry';
import type { TemplateMount } from './types';

export function runCalculator(
  embedType: string,
  Calculator: ComponentType<any>,
  css: string,
  productBacked: boolean,
  buildQuery = buildCalculatorProductQuery,
) {
  const mount: TemplateMount = (shadowRoot, props) => {
    const style = document.createElement('style');
    style.textContent = css;
    const container = document.createElement('div');
    container.setAttribute('data-illustrata-template', embedType);
    shadowRoot.append(style, container);
    const runtime = productBacked ? {
      products: props.products.map(product => ({ ...product, variants: product.variants.map(variant => ({ ...variant })) })),
      launchContext: props.launchContext ?? null,
      workspace: createWorkspaceRuntime(props.apiBase, props.embedToken, props.workspace)
        ?? createBrowserWorkspace(props.embedToken, props.products, props.browserWorkspace),
      calculate: <T,>(slug: string, inputs: Record<string, unknown>, options: CalculatorProductRequestOptions = {}) =>
        callEmbedProduct<T>(props.apiBase, props.embedToken, slug, inputs, { query: buildQuery(options), signal: options.signal }),
      reportError: (error: unknown, context?: Record<string, unknown>) =>
        reportClientError(props.apiBase, props.embedToken, error instanceof Error ? error.message : 'Calculator runtime error', context),
    } : undefined;
    const root = createRoot(container);
    root.render(createElement(Calculator, productBacked ? { runtime, host: shadowRoot.host } : {}));
    return () => { root.unmount(); container.remove(); style.remove(); };
  };
  runTemplate(embedType, mount);
}
