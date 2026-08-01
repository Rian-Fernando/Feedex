import type { Metadata } from 'next';

import { siteConfig } from '@/config/site';
import { Hero } from '@/components/marketing/hero';
import { ProductTour } from '@/components/marketing/product-tour';
import {
  CallToAction,
  Developers,
  Faq,
  Features,
  OpenSource,
  Section,
} from '@/components/marketing/sections';
import { HomeStructuredData } from '@/components/seo/structured-data';

export const metadata: Metadata = {
  // The root layout supplies the title template; the home page is the one route
  // that should use the full brand title verbatim.
  title: {
    absolute: siteConfig.title,
  },
  description: siteConfig.description,
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return (
    <>
      <HomeStructuredData />

      <Hero />

      <Features />

      <Section
        id="tour"
        eyebrow="How it works"
        title="From a bug on someone's screen to a fix on yours"
        description="The whole loop, end to end. Step through it, or let it play."
      >
        <ProductTour />
      </Section>

      <Developers />

      <OpenSource />

      <Faq />

      <CallToAction />
    </>
  );
}
