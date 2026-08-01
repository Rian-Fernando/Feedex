import { currentUser } from '@/lib/auth';
import { MarketingNav } from '@/components/marketing/nav';
import { MarketingFooter } from '@/components/marketing/footer';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Drives whether the header offers "Dashboard" or "Sign in".
  const user = await currentUser();

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden">
      <MarketingNav authenticated={Boolean(user)} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
