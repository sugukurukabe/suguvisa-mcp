import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-10 sm:py-16">{children}</main>
      <SiteFooter />
    </>
  );
}
