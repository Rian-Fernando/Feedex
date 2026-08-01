/** Public contract of the embeddable widget. */

export type FeedexCategory =
  'bug' | 'feature' | 'ui' | 'performance' | 'content' | 'question' | 'other';

export interface FeedexConfig {
  /** Project public key, `pk_fdx_…`. Required. */
  key: string;
  /** Origin of the Feedex instance. Defaults to the script's own origin. */
  host?: string;
  position?: 'bottom-right' | 'bottom-left';
  accentColor?: string;
  buttonLabel?: string;
  title?: string;
  description?: string;
  successMessage?: string;
  requireEmail?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  categories?: FeedexCategory[];
  /** Hides the floating button; the widget is then opened via `Feedex.open()`. */
  hideButton?: boolean;
  /** Pre-fills the reporter fields when the host app already knows the user. */
  user?: { email?: string; name?: string };
  /** Arbitrary key/value pairs attached to every submission. */
  metadata?: Record<string, string>;
}

export interface FeedexApi {
  /** Boots the widget. Called automatically when the script tag carries a key. */
  init(config: FeedexConfig): void;
  open(category?: FeedexCategory): void;
  close(): void;
  /** Associates subsequent submissions with a known user. */
  identify(user: { email?: string; name?: string }): void;
  /** Merges into the metadata sent with every submission. */
  setMetadata(metadata: Record<string, string>): void;
  destroy(): void;
  readonly version: string;
}

export interface ClientContext {
  url: string;
  path: string;
  referrer?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  device?: 'desktop' | 'tablet' | 'mobile';
  viewport?: { width: number; height: number };
  screen?: { width: number; height: number };
  language?: string;
  timezone?: string;
  custom?: Record<string, string>;
}
