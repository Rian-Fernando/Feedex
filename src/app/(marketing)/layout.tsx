import { currentUser } from '@/lib/auth';
import { MarketingNav } from '@/components/marketing/nav';
import { MarketingFooter } from '@/components/marketing/footer';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Drives whether the header offers "Dashboard" or "Sign in".
  const user = await currentUser();

  return (
    /*
      `overflow-x-clip`, not `hidden`. Both clip horizontally, but `hidden`
      makes the element a scroll container, which silently disables
      `position: sticky` for every descendant — including the pinned hero.
      `clip` has no such side effect.
    */
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <MarketingNav authenticated={Boolean(user)} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
