import { collectContext } from './context';
import { styles } from './styles';
import type { FeedexApi, FeedexCategory, FeedexConfig } from './types';

/**
 * Feedex embeddable feedback widget.
 *
 * Design constraints, in priority order:
 *
 *   1. **Never break the host page.** The whole UI lives in a shadow root, all
 *      state is local, nothing is written to storage, and no global besides
 *      `window.Feedex` is defined.
 *   2. **Stay small.** No framework, no polyfills, no runtime dependencies.
 *   3. **Stay accessible.** The panel is a labelled dialog with focus
 *      management, Escape handling, and a live region for status changes.
 *
 * Installation is one tag:
 *
 *   <script src="https://feedex.rianfernando.com/widget.js"
 *           data-feedex-key="pk_fdx_..." defer></script>
 */

const VERSION = '0.1.0';

const CATEGORY_LABELS: Record<FeedexCategory, string> = {
  bug: 'Bug',
  feature: 'Feature',
  ui: 'UI issue',
  performance: 'Performance',
  content: 'Content',
  question: 'Question',
  other: 'Other',
};

const DEFAULTS = {
  position: 'bottom-right',
  accentColor: '#B58BF9',
  buttonLabel: 'Feedback',
  title: 'Send feedback',
  description: 'Found a bug or have an idea? Let us know.',
  successMessage: 'Thanks — your feedback has been received.',
  requireEmail: false,
  theme: 'auto',
  categories: ['bug', 'feature', 'ui', 'other'],
} satisfies Partial<FeedexConfig>;

const ICONS = {
  chat: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M17 9.5a6.5 6.5 0 0 1-9.4 5.8L3 16.5l1.3-4.4A6.5 6.5 0 1 1 17 9.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  close:
    '<svg viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

/**
 * Parses a 3- or 6-digit hex colour into RGB components.
 *
 * Used to derive the accent's alpha tints at runtime. Doing it here rather than
 * with `color-mix()` in CSS keeps the widget working on Safari 15, which is the
 * oldest browser the bundle targets.
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const value = hex.trim().replace(/^#/, '');

  const expanded =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;

  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;

  return [
    parseInt(expanded.slice(0, 2), 16),
    parseInt(expanded.slice(2, 4), 16),
    parseInt(expanded.slice(4, 6), 16),
  ];
}

/** Escapes text before it is placed into an HTML string. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

class FeedexWidget {
  private config: Required<Omit<FeedexConfig, 'user' | 'metadata' | 'hideButton' | 'host'>> &
    Pick<FeedexConfig, 'user' | 'metadata' | 'hideButton' | 'host'>;

  private host: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private panel: HTMLDivElement | null = null;
  private launcher: HTMLButtonElement | null = null;
  private form: HTMLFormElement | null = null;
  private open = false;
  private submitting = false;
  private lastFocused: Element | null = null;
  private schemeQuery: MediaQueryList | null = null;

  constructor(config: FeedexConfig) {
    this.config = {
      key: config.key,
      host: config.host,
      position: config.position ?? DEFAULTS.position,
      accentColor: config.accentColor ?? DEFAULTS.accentColor,
      buttonLabel: config.buttonLabel ?? DEFAULTS.buttonLabel,
      title: config.title ?? DEFAULTS.title,
      description: config.description ?? DEFAULTS.description,
      successMessage: config.successMessage ?? DEFAULTS.successMessage,
      requireEmail: config.requireEmail ?? DEFAULTS.requireEmail,
      theme: config.theme ?? DEFAULTS.theme,
      categories: config.categories?.length ? config.categories : [...DEFAULTS.categories],
      user: config.user,
      metadata: config.metadata,
      hideButton: config.hideButton,
    };
  }

  mount(): void {
    if (this.host) return;

    this.host = document.createElement('div');
    this.host.setAttribute('data-feedex', 'root');
    this.shadow = this.host.attachShadow({ mode: 'open' });

    const sheet = document.createElement('style');
    sheet.textContent = styles;
    this.shadow.appendChild(sheet);

    const root = document.createElement('div');
    root.className = 'fx-root';
    root.setAttribute('data-position', this.config.position);
    this.applyAccent(root);
    root.innerHTML = this.template();
    this.shadow.appendChild(root);

    document.body.appendChild(this.host);

    this.panel = this.shadow.querySelector('.fx-panel');
    this.launcher = this.shadow.querySelector('.fx-launcher');
    this.form = this.shadow.querySelector('.fx-form');

    this.applyScheme();
    this.bind();
  }

  /**
   * Sets the accent and its two alpha tints as custom properties.
   *
   * An unparseable accent leaves the stylesheet defaults in place rather than
   * writing an invalid value, so a bad configuration degrades to the default
   * indigo instead of an unstyled widget.
   */
  private applyAccent(root: HTMLElement): void {
    const rgb = hexToRgb(this.config.accentColor);
    if (!rgb) return;

    const [r, g, b] = rgb;
    root.style.setProperty('--fx-accent', this.config.accentColor);
    root.style.setProperty('--fx-accent-soft', `rgba(${r}, ${g}, ${b}, 0.14)`);
    root.style.setProperty('--fx-accent-ring', `rgba(${r}, ${g}, ${b}, 0.22)`);

    // Text on a filled accent surface: plum for light accents, white for dark
    // ones. Uses relative luminance so a custom accent stays readable.
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    root.style.setProperty('--fx-on-accent', luminance > 0.55 ? '#17101F' : '#ffffff');
  }

  private template(): string {
    const { buttonLabel, title, description, categories, requireEmail, hideButton } = this.config;

    const chips = categories
      .map(
        (category, index) => `
        <label class="fx-chip">
          <input type="radio" name="category" value="${escapeHtml(category)}"${index === 0 ? ' checked' : ''}>
          <span>${escapeHtml(CATEGORY_LABELS[category] ?? category)}</span>
        </label>`,
      )
      .join('');

    return `
      ${
        hideButton
          ? ''
          : `<button type="button" class="fx-launcher" aria-haspopup="dialog" aria-expanded="false" aria-controls="fx-panel">
               ${ICONS.chat}<span>${escapeHtml(buttonLabel)}</span>
             </button>`
      }
      <div class="fx-panel" id="fx-panel" role="dialog" aria-modal="false" aria-labelledby="fx-title" data-open="false">
        <div class="fx-view" data-view="form">
          <div class="fx-header">
            <div>
              <h2 class="fx-title" id="fx-title">${escapeHtml(title)}</h2>
              <p class="fx-subtitle">${escapeHtml(description)}</p>
            </div>
            <button type="button" class="fx-close" aria-label="Close feedback form">${ICONS.close}</button>
          </div>
          <form class="fx-form" novalidate>
            <fieldset class="fx-categories">
              <legend>What kind of feedback?</legend>
              ${chips}
            </fieldset>
            <div class="fx-field">
              <label class="fx-label" for="fx-description">Description</label>
              <textarea class="fx-textarea" id="fx-description" name="description"
                placeholder="Tell us what happened, or what you'd like to see." required
                maxlength="5000"></textarea>
            </div>
            <div class="fx-field">
              <label class="fx-label" for="fx-email">Email${requireEmail ? '' : ' (optional)'}</label>
              <input class="fx-input" id="fx-email" name="email" type="email"
                placeholder="you@example.com" autocomplete="email"${requireEmail ? ' required' : ''}>
            </div>
            <p class="fx-error" role="alert" hidden></p>
            <button type="submit" class="fx-submit">Send feedback</button>
            <p class="fx-footer">Powered by <a href="https://feedex.rianfernando.com" target="_blank" rel="noopener noreferrer">Feedex</a></p>
          </form>
        </div>
        <div class="fx-view" data-view="success" hidden>
          <div class="fx-success">
            <span class="fx-success-icon">${ICONS.check}</span>
            <strong>Feedback sent</strong>
            <p>${escapeHtml(this.config.successMessage)}</p>
          </div>
        </div>
        <div class="fx-visually-hidden" role="status" aria-live="polite"></div>
      </div>`;
  }

  private bind(): void {
    this.launcher?.addEventListener('click', () => this.toggle());
    this.shadow?.querySelector('.fx-close')?.addEventListener('click', () => this.setOpen(false));
    this.form?.addEventListener('submit', (event) => void this.submit(event));

    // Escape closes, and pointer-down outside dismisses. Both are registered on
    // the document because the shadow root does not receive events that never
    // reach it.
    document.addEventListener('keydown', this.onKeyDown, true);
    document.addEventListener('pointerdown', this.onPointerDown, true);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.open) {
      event.stopPropagation();
      this.setOpen(false);
    }
  };

  private onPointerDown = (event: Event): void => {
    if (!this.open || !this.host) return;
    // `composedPath` is what lets a click inside the shadow root be recognised
    // as "inside" from a listener bound on the document.
    if (!event.composedPath().includes(this.host)) {
      this.setOpen(false);
    }
  };

  private applyScheme(): void {
    const resolve = () => {
      const dark =
        this.config.theme === 'dark' ||
        (this.config.theme === 'auto' &&
          window.matchMedia?.('(prefers-color-scheme: dark)').matches);
      this.host?.setAttribute('data-scheme', dark ? 'dark' : 'light');
    };

    resolve();

    if (this.config.theme === 'auto' && window.matchMedia) {
      this.schemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.schemeQuery.addEventListener('change', resolve);
    }
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  setOpen(open: boolean, category?: FeedexCategory): void {
    if (!this.panel) return;

    this.open = open;
    this.panel.setAttribute('data-open', String(open));
    this.launcher?.setAttribute('aria-expanded', String(open));

    if (open) {
      this.lastFocused = document.activeElement;

      if (category) {
        const input = this.shadow?.querySelector<HTMLInputElement>(
          `input[name="category"][value="${category}"]`,
        );
        if (input) input.checked = true;
      }

      // Focus the description rather than the first chip: it is where the user
      // is going to type, and the chips already have a sensible default.
      window.setTimeout(() => {
        this.shadow?.querySelector<HTMLTextAreaElement>('#fx-description')?.focus();
      }, 60);
    } else if (this.lastFocused instanceof HTMLElement) {
      this.lastFocused.focus();
    }
  }

  private announce(message: string): void {
    const region = this.shadow?.querySelector('[role="status"]');
    if (region) region.textContent = message;
  }

  private showError(message: string): void {
    const element = this.shadow?.querySelector<HTMLParagraphElement>('.fx-error');
    if (!element) return;
    element.textContent = message;
    element.hidden = !message;
  }

  private async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.submitting || !this.form) return;

    const data = new FormData(this.form);
    const description = String(data.get('description') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const category = (String(data.get('category') ?? 'other') || 'other') as FeedexCategory;

    if (description.length < 5) {
      this.showError('Please describe the issue in a little more detail.');
      this.shadow?.querySelector<HTMLTextAreaElement>('#fx-description')?.focus();
      return;
    }

    if (this.config.requireEmail && !email) {
      this.showError('An email address is required.');
      this.shadow?.querySelector<HTMLInputElement>('#fx-email')?.focus();
      return;
    }

    this.showError('');
    this.setSubmitting(true);

    try {
      const response = await fetch(`${this.endpoint()}/api/v1/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // No cookies are sent: the endpoint is key-authenticated, and omitting
        // credentials keeps the CORS policy simple and safe.
        credentials: 'omit',
        body: JSON.stringify({
          publicKey: this.config.key,
          category,
          description,
          email: email || undefined,
          name: this.config.user?.name || undefined,
          context: collectContext(this.config.metadata),
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? 'Could not send your feedback.');
      }

      this.showSuccess();
    } catch (error) {
      this.showError(
        error instanceof Error ? error.message : 'Could not send your feedback. Please try again.',
      );
      this.announce('Feedback could not be sent.');
    } finally {
      this.setSubmitting(false);
    }
  }

  private setSubmitting(value: boolean): void {
    this.submitting = value;
    const button = this.shadow?.querySelector<HTMLButtonElement>('.fx-submit');
    if (button) {
      button.disabled = value;
      button.textContent = value ? 'Sending…' : 'Send feedback';
    }
  }

  private showSuccess(): void {
    const formView = this.shadow?.querySelector<HTMLElement>('[data-view="form"]');
    const successView = this.shadow?.querySelector<HTMLElement>('[data-view="success"]');

    if (formView) formView.hidden = true;
    if (successView) successView.hidden = false;

    this.announce(this.config.successMessage);
    this.form?.reset();

    // Close, then restore the form so the next open starts clean.
    window.setTimeout(() => {
      this.setOpen(false);
      window.setTimeout(() => {
        if (formView) formView.hidden = false;
        if (successView) successView.hidden = true;
      }, 300);
    }, 2200);
  }

  private endpoint(): string {
    if (this.config.host) return this.config.host.replace(/\/$/, '');
    return scriptOrigin() ?? 'https://feedex.rianfernando.com';
  }

  identify(user: { email?: string; name?: string }): void {
    this.config.user = { ...this.config.user, ...user };
    const input = this.shadow?.querySelector<HTMLInputElement>('#fx-email');
    if (input && user.email && !input.value) input.value = user.email;
  }

  setMetadata(metadata: Record<string, string>): void {
    this.config.metadata = { ...this.config.metadata, ...metadata };
  }

  destroy(): void {
    document.removeEventListener('keydown', this.onKeyDown, true);
    document.removeEventListener('pointerdown', this.onPointerDown, true);
    this.schemeQuery = null;
    this.host?.remove();
    this.host = null;
    this.shadow = null;
    this.panel = null;
  }
}

/** Origin the widget script itself was served from. */
function scriptOrigin(): string | null {
  const current =
    document.currentScript ?? document.querySelector<HTMLScriptElement>('script[data-feedex-key]');

  const src = current instanceof HTMLScriptElement ? current.src : null;
  if (!src) return null;

  try {
    return new URL(src).origin;
  } catch {
    return null;
  }
}

/** Reads configuration from `data-feedex-*` attributes on the script tag. */
function configFromScriptTag(): FeedexConfig | null {
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector<HTMLScriptElement>('script[data-feedex-key]');

  const key = script?.dataset.feedexKey;
  if (!key) return null;

  const data = script!.dataset;
  const categories = data.feedexCategories
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean) as FeedexCategory[] | undefined;

  return {
    key,
    host: data.feedexHost,
    position: data.feedexPosition as FeedexConfig['position'],
    accentColor: data.feedexAccent,
    buttonLabel: data.feedexLabel,
    title: data.feedexTitle,
    description: data.feedexDescription,
    theme: data.feedexTheme as FeedexConfig['theme'],
    requireEmail: data.feedexRequireEmail === 'true',
    hideButton: data.feedexHideButton === 'true',
    categories: categories?.length ? categories : undefined,
  };
}

let instance: FeedexWidget | null = null;

const api: FeedexApi = {
  init(config: FeedexConfig) {
    if (!config?.key) {
      console.warn('[Feedex] init() requires a project key.');
      return;
    }
    instance?.destroy();
    instance = new FeedexWidget(config);

    // `document.body` may not exist yet if the script is not deferred.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => instance?.mount(), { once: true });
    } else {
      instance.mount();
    }
  },
  open(category) {
    instance?.setOpen(true, category);
  },
  close() {
    instance?.setOpen(false);
  },
  identify(user) {
    instance?.identify(user);
  },
  setMetadata(metadata) {
    instance?.setMetadata(metadata);
  },
  destroy() {
    instance?.destroy();
    instance = null;
  },
  version: VERSION,
};

declare global {
  interface Window {
    Feedex?: FeedexApi;
  }
}

if (typeof window !== 'undefined') {
  window.Feedex = api;

  // Auto-boot when the script tag carries a key, so the common case is a
  // single tag with no additional JavaScript.
  const scriptConfig = configFromScriptTag();
  if (scriptConfig) api.init(scriptConfig);
}

export default api;
