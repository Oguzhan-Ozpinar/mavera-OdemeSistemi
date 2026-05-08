import { DonationFlow } from "@/components/donation-flow";
import { brandThemeStyle, getBranding, parseInitialDonation } from "@/lib/branding";
import { getIbanAccounts } from "@/lib/iban";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: PageProps) {
  const ibanAccounts = await getIbanAccounts();
  const branding = getBranding();
  const initialDonation = parseInitialDonation((await searchParams) ?? {});

  return (
    <main className="min-h-[100svh] bg-slate-50" style={brandThemeStyle(branding.color)}>
      <section className="mx-auto flex min-h-[100svh] w-full max-w-3xl flex-col gap-3 px-3 py-3 sm:px-6 sm:py-6 lg:max-w-4xl">
        <DonationFlow branding={branding} ibanAccounts={ibanAccounts} initialDonation={initialDonation} />
      </section>
    </main>
  );
}
