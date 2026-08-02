import { currentUser } from '@/lib/auth';
import { MarketingNav } from '@/components/marketing/nav';
import { MarketingFooter } from '@/components/marketing/footer';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Drives whether the header offers "Dashboard" or "Sign in".
  const user = await currentUser();

  return (
    /*
      The marketing site is always dark. There is no theme toggle here on
      purpose — the landing page has one personality, and the switch belongs to
      the application chrome.

      Scoping `dark` to this wrapper rather than toggling it on <html> keeps
      that free of JavaScript: the design tokens are declared under `.dark`, so
      they simply cascade, and `color-scheme` inherits with them. No flash, and
      a visitor whose stored preference is light still sees the intended page.

      No background here on purpose. The backdrop paints the ground from a
      fixed `-z-10` layer, and a negative-z child paints *behind* its parent's
      background when the parent creates no stacking context — so a background
      on this element would simply hide the canvas.

      `overflow-x-clip`, not `hidden`: both clip horizontally, but `hidden`
      makes the element a scroll container, which silently disables
      `position: sticky` for every descendant.
    */
    <div className="dark flex min-h-dvh flex-col overflow-x-clip text-fg">
      <MarketingNav authenticated={Boolean(user)} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
