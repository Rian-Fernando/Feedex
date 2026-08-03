import { collectContext } from './context';
import { styles } from './styles';
import {
  DEFAULT_LIMITS,
  isImage,
  prepareAttachment,
  type AttachmentLimits,
  type PreparedAttachment,
} from './attachments';
import type { FeedexApi, FeedexCategory, FeedexConfig, FeedexLauncherIcon } from './types';

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
  launcherIcon: 'chat',
  title: 'Send feedback',
  description: 'Found a bug or have an idea? Let us know.',
  successMessage: 'Thanks — your feedback has been received.',
  requireEmail: false,
  theme: 'auto',
  attachments: true,
  categories: ['bug', 'feature', 'ui', 'other'],
} satisfies Partial<FeedexConfig>;

const ICONS = {
  chat: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M17 9.5a6.5 6.5 0 0 1-9.4 5.8L3 16.5l1.3-4.4A6.5 6.5 0 1 1 17 9.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  bug: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7 5.5a3 3 0 0 1 6 0M5 9H2m16 0h-3M5 13.5H2.6M17.4 13.5H15M6.6 4.2 5.2 2.8m8.2 1.4 1.4-1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><rect x="5" y="5.5" width="10" height="11" rx="5" stroke="currentColor" stroke-width="1.5"/></svg>',
  spark:
    '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.2l1.9 4.7 4.9 1.9-4.9 1.9L10 15.4 8.1 10.7 3.2 8.8l4.9-1.9L10 2.2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  close:
    '<svg viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  paperclip:
    '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.4 7.3 8.1 12.6a3.3 3.3 0 0 1-4.7-4.7l5.3-5.3a2.2 2.2 0 0 1 3.1 3.1l-5.3 5.3a1.1 1.1 0 1 1-1.6-1.6l4.9-4.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function launcherGlyph(icon: FeedexLauncherIcon): string {
  if (icon === 'none') return '';
  return ICONS[icon] ?? ICONS.chat;
}

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

type ResolvedConfig = Required<
  Omit<FeedexConfig, 'user' | 'metadata' | 'hideButton' | 'host' | 'disableRemoteConfig'>
> &
  Pick<FeedexConfig, 'user' | 'metadata' | 'hideButton' | 'host' | 'disableRemoteConfig'>;

class FeedexWidget {
  private config: ResolvedConfig;

  private host: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private panel: HTMLDivElement | null = null;
  private launcher: HTMLButtonElement | null = null;
  private form: HTMLFormElement | null = null;
  private open = false;
  private submitting = false;
  private lastFocused: Element | null = null;
  private schemeQuery: MediaQueryList | null = null;

  private limits: AttachmentLimits = DEFAULT_LIMITS;
  private attachments: PreparedAttachment[] = [];

  /**
   * Set by `destroy()`, and checked after the config await in `start()`.
   *
   * Without it, tearing the widget down during boot — which the host app does
   * on every theme switch — would let the in-flight instance mount itself
   * afterwards, leaving an orphaned second widget on the page.
   */
  private destroyed = false;

  /**
   * Fields the embedding page set explicitly.
   *
   * Remembered so that dashboard-managed settings can be merged underneath
   * them: whoever wrote the snippet gets the last word, and everything they
   * left alone follows the project's configuration.
   */
  private readonly explicit: Set<keyof FeedexConfig>;

  constructor(config: FeedexConfig) {
    this.explicit = new Set(
      (Object.keys(config) as Array<keyof FeedexConfig>).filter(
        (name) => config[name] !== undefined,
      ),
    );

    this.config = {
      key: config.key,
      host: config.host,
      position: config.position ?? DEFAULTS.position,
      accentColor: config.accentColor ?? DEFAULTS.accentColor,
      buttonLabel: config.buttonLabel ?? DEFAULTS.buttonLabel,
      launcherIcon: config.launcherIcon ?? DEFAULTS.launcherIcon,
      title: config.title ?? DEFAULTS.title,
      description: config.description ?? DEFAULTS.description,
      successMessage: config.successMessage ?? DEFAULTS.successMessage,
      requireEmail: config.requireEmail ?? DEFAULTS.requireEmail,
      theme: config.theme ?? DEFAULTS.theme,
      attachments: config.attachments ?? DEFAULTS.attachments,
      categories: config.categories?.length ? config.categories : [...DEFAULTS.categories],
      user: config.user,
      metadata: config.metadata,
      hideButton: config.hideButton,
      disableRemoteConfig: config.disableRemoteConfig,
    };
  }

  /**
   * Pulls the project's dashboard-managed appearance settings.
   *
   * Deliberately best-effort. If the request fails, times out, or the instance
   * is older than this endpoint, the widget carries on with what the snippet
   * gave it — a feedback button that renders in the wrong colour is a far
   * better outcome than one that never renders.
   */
  private async loadRemoteConfig(): Promise<void> {
    if (this.config.disableRemoteConfig) return;

    let timer: number | undefined;

    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      if (controller) {
        timer = window.setTimeout(() => controller.abort(), 3000);
      }

      const response = await fetch(
        `${this.endpoint()}/api/v1/widget-config?key=${encodeURIComponent(this.config.key)}`,
        { credentials: 'omit', signal: controller?.signal },
      );

      if (!response.ok) return;

      const body = (await response.json()) as {
        data?: { widget?: Record<string, unknown> };
      };

      const remote = body.data?.widget;
      if (remote) this.applyRemoteConfig(remote);
    } catch {
      // Offline, blocked by an extension, aborted, or an older instance.
    } finally {
      if (timer !== undefined) window.clearTimeout(timer);
    }
  }

  private applyRemoteConfig(remote: Record<string, unknown>): void {
    const take = <K extends keyof FeedexConfig>(name: K, value: unknown): void => {
      // An explicit value in the snippet always wins, and a null or absent
      // remote field means "not configured" rather than "clear it".
      if (this.explicit.has(name) || value === undefined || value === null) return;
      (this.config as Record<string, unknown>)[name as string] = value;
    };

    take('position', remote.position);
    take('accentColor', remote.accentColor);
    take('buttonLabel', remote.buttonLabel);
    take('launcherIcon', remote.launcherIcon);
    take('title', remote.title);
    take('description', remote.description);
    take('successMessage', remote.successMessage);
    take('requireEmail', remote.requireEmail);
    take('theme', remote.theme);

    if (Array.isArray(remote.categories) && remote.categories.length > 0) {
      take('categories', remote.categories);
    }

    const attachments = remote.attachments as Partial<AttachmentLimits> & { enabled?: boolean };
    if (attachments && typeof attachments === 'object') {
      take('attachments', attachments.enabled);
      this.limits = {
        maxCount: attachments.maxCount ?? DEFAULT_LIMITS.maxCount,
        maxBytes: attachments.maxBytes ?? DEFAULT_LIMITS.maxBytes,
        maxTotalBytes: attachments.maxTotalBytes ?? DEFAULT_LIMITS.maxTotalBytes,
        accept: attachments.accept ?? DEFAULT_LIMITS.accept,
      };
    }
  }

  /**
   * Fetches configuration, then renders.
   *
   * The order matters: rendering first would show the default purple pill and
   * then repaint it in the project's colour a moment later, which reads as a
   * broken third-party script on someone else's site. Waiting costs a few
   * hundred milliseconds before a floating button appears, which nobody
   * notices, and the request is edge-cached.
   */
  async start(): Promise<void> {
    if (this.host) return;
    await this.loadRemoteConfig();
    if (!this.destroyed) this.mount();
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
    const {
      buttonLabel,
      launcherIcon,
      title,
      description,
      categories,
      requireEmail,
      hideButton,
      attachments,
    } = this.config;

    const chips = categories
      .map(
        (category, index) => `
        <label class="fx-chip">
          <input type="radio" name="category" value="${escapeHtml(category)}"${index === 0 ? ' checked' : ''}>
          <span>${escapeHtml(CATEGORY_LABELS[category] ?? category)}</span>
        </label>`,
      )
      .join('');

    const attachField = attachments
      ? `<div class="fx-field">
           <input type="file" class="fx-file" id="fx-file" accept="${escapeHtml(this.limits.accept)}" multiple>
           <button type="button" class="fx-attach">
             ${ICONS.paperclip}<span>Add screenshot or file</span>
           </button>
           <ul class="fx-thumbs"></ul>
         </div>`
      : '';

    return `
      ${
        hideButton
          ? ''
          : `<button type="button" class="fx-launcher" aria-haspopup="dialog" aria-expanded="false" aria-controls="fx-panel">
               ${launcherGlyph(launcherIcon)}<span>${escapeHtml(buttonLabel)}</span>
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
            ${attachField}
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

    const fileInput = this.shadow?.querySelector<HTMLInputElement>('.fx-file');
    const attachButton = this.shadow?.querySelector<HTMLButtonElement>('.fx-attach');

    attachButton?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', () => {
      const files = Array.from(fileInput.files ?? []);
      // Cleared so picking the same file twice in a row still fires `change`.
      fileInput.value = '';
      void this.addFiles(files);
    });

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

  /* ------------------------------ attachments ----------------------------- */

  private async addFiles(files: File[]): Promise<void> {
    if (files.length === 0) return;

    this.showError('');
    const button = this.shadow?.querySelector<HTMLButtonElement>('.fx-attach');
    const label = button?.querySelector('span');

    // Compressing a large screenshot takes a beat, and a button that looks
    // inert during it invites a second click and a duplicate attachment.
    if (button) button.disabled = true;
    if (label) label.textContent = 'Processing…';

    try {
      for (const file of files) {
        if (this.attachments.length >= this.limits.maxCount) {
          this.showError(`Up to ${this.limits.maxCount} files can be attached.`);
          break;
        }

        try {
          const prepared = await prepareAttachment(file, this.limits);
          const total = this.attachments.reduce((sum, item) => sum + item.size, 0) + prepared.size;

          if (total > this.limits.maxTotalBytes) {
            if (prepared.preview) URL.revokeObjectURL(prepared.preview);
            this.showError(
              `Attachments must total under ${Math.round(this.limits.maxTotalBytes / 1024)} KB.`,
            );
            break;
          }

          this.attachments.push(prepared);
        } catch (error) {
          this.showError(error instanceof Error ? error.message : 'That file could not be added.');
        }
      }
    } finally {
      if (button) button.disabled = false;
      if (label) label.textContent = 'Add screenshot or file';
      this.renderThumbs();
    }
  }

  private removeAttachment(index: number): void {
    const [removed] = this.attachments.splice(index, 1);
    // The object URL is a live reference to the file; without revoking it the
    // bytes stay held for the lifetime of the host page.
    if (removed?.preview) URL.revokeObjectURL(removed.preview);
    this.renderThumbs();
    this.showError('');
  }

  private clearAttachments(): void {
    for (const item of this.attachments) {
      if (item.preview) URL.revokeObjectURL(item.preview);
    }
    this.attachments = [];
    this.renderThumbs();
  }

  private renderThumbs(): void {
    const list = this.shadow?.querySelector<HTMLUListElement>('.fx-thumbs');
    if (!list) return;

    list.textContent = '';

    this.attachments.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'fx-thumb';

      if (item.preview && isImage(item.type)) {
        const img = document.createElement('img');
        img.src = item.preview;
        img.alt = item.name;
        li.appendChild(img);
      } else {
        const span = document.createElement('span');
        span.className = 'fx-thumb-file';
        span.textContent = (item.name.split('.').pop() ?? 'file').slice(0, 5);
        li.appendChild(span);
      }

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'fx-thumb-remove';
      remove.setAttribute('aria-label', `Remove ${item.name}`);
      remove.innerHTML = ICONS.close;
      remove.addEventListener('click', () => this.removeAttachment(index));
      li.appendChild(remove);

      list.appendChild(li);
    });
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
          attachments: this.attachments.length
            ? this.attachments.map((item) => ({
                name: item.name,
                type: item.type,
                data: item.data,
              }))
            : undefined,
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
    this.clearAttachments();

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
    this.destroyed = true;
    document.removeEventListener('keydown', this.onKeyDown, true);
    document.removeEventListener('pointerdown', this.onPointerDown, true);
    this.schemeQuery = null;

    for (const item of this.attachments) {
      if (item.preview) URL.revokeObjectURL(item.preview);
    }
    this.attachments = [];

    this.host?.remove();
    this.host = null;
    this.shadow = null;
    this.panel = null;
    this.form = null;
    this.launcher = null;
  }
}

/**
 * Origin the widget script itself was served from.
 *
 * Checked in order of reliability. The last of these matters: when the widget
 * is booted through `Feedex.init()` rather than the `data-feedex-key`
 * attribute, `document.currentScript` is null and there is no tagged script to
 * find, so without a `src`-based lookup the origin would silently fall back to
 * the hosted instance — and a self-hosted or local install would post its
 * feedback to the wrong server.
 */
function scriptOrigin(): string | null {
  const candidates = [
    document.currentScript,
    document.querySelector('script[data-feedex-key]'),
    document.querySelector('script[src*="/widget.js"]'),
  ];

  for (const candidate of candidates) {
    if (!(candidate instanceof HTMLScriptElement) || !candidate.src) continue;

    try {
      return new URL(candidate.src, window.location.href).origin;
    } catch {
      // Malformed src; try the next candidate.
    }
  }

  return null;
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

  /*
    Absent attributes stay `undefined` rather than becoming `false`, because
    the constructor records which keys were set explicitly and merges the
    project's dashboard settings under everything that was not. Collapsing an
    absent attribute to a value would pin the setting and make the dashboard
    control appear to do nothing.
  */
  const flag = (value: string | undefined): boolean | undefined =>
    value === undefined ? undefined : value === 'true';

  return {
    key,
    host: data.feedexHost,
    position: data.feedexPosition as FeedexConfig['position'],
    accentColor: data.feedexAccent,
    buttonLabel: data.feedexLabel,
    launcherIcon: data.feedexIcon as FeedexConfig['launcherIcon'],
    title: data.feedexTitle,
    description: data.feedexDescription,
    theme: data.feedexTheme as FeedexConfig['theme'],
    requireEmail: flag(data.feedexRequireEmail),
    hideButton: flag(data.feedexHideButton),
    attachments: flag(data.feedexAttachments),
    disableRemoteConfig: flag(data.feedexNoRemoteConfig),
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
    const widget = new FeedexWidget(config);
    instance = widget;

    // `document.body` may not exist yet if the script is not deferred.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => void widget.start(), { once: true });
    } else {
      void widget.start();
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
