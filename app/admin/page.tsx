import { BadgeCheck, Download, LogOut, RefreshCcw, ShieldAlert } from "lucide-react";
import { isAdminSession } from "@/lib/admin-auth";
import { listRecords, type PocketRecord } from "@/lib/pocketbase";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type TransactionRecord = PocketRecord & {
  amount?: number;
  currency?: string;
  status?: string;
  frequency?: string;
  donation_note?: string;
  installment?: number;
  foreign_card?: boolean;
  payment_mode?: string;
  error_code?: string;
  error_message?: string;
  nkolay_payment_id?: string;
  client_ref_code?: string;
  recurring_count?: number;
  total_committed_amount?: number;
  created?: string;
  expand?: {
    donor?: {
      full_name?: string;
      email?: string;
      phone_e164?: string;
    };
  };
};

type SubscriptionRecord = PocketRecord & {
  nkolay_instruction_id?: string;
  amount?: number;
  status?: string;
  next_payment_date?: string;
  failure_reason?: string;
  installment_count?: number;
  installment_period_days?: number;
  total_committed_amount?: number;
  created?: string;
  expand?: {
    donor?: {
      full_name?: string;
      email?: string;
      phone_e164?: string;
    };
    transaction?: {
      donation_note?: string;
      status?: string;
    };
  };
};

type EventRecord = PocketRecord & {
  type?: string;
  provider?: string;
  payload?: unknown;
  created?: string;
  transaction?: string;
};

function money(value: unknown, currency = "TRY") {
  const amount = Number(value ?? 0);
  return `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function statusClass(status?: string) {
  switch (status) {
    case "success":
    case "active":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "failed":
    case "cancelled":
      return "bg-red-50 text-red-700 border-red-100";
    case "awaiting_3d":
    case "awaiting_subscription_confirmation":
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-100";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function isSameDay(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function isSameMonth(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function sumSuccess(records: TransactionRecord[], predicate: (record: TransactionRecord) => boolean) {
  return records
    .filter((record) => record.status === "success" && predicate(record))
    .reduce((total, record) => total + Number(record.amount ?? 0), 0);
}

async function getAdminData() {
  const [transactions, events, subscriptions] = await Promise.all([
    listRecords<TransactionRecord>("transactions", "?sort=-created&perPage=100&expand=donor"),
    listRecords<EventRecord>("payment_events", "?sort=-created&perPage=120"),
    listRecords<SubscriptionRecord>("subscriptions", "?sort=-created&perPage=100&expand=donor,transaction")
  ]);

  return {
    transactions: transactions.items,
    events: events.items,
    subscriptions: subscriptions.items
  };
}

function LoginCard({ error }: { error?: string | string[] }) {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-slate-50 px-4">
      <form action="/api/admin/login" method="post" className="w-full max-w-sm rounded-lg bg-white p-6 shadow-soft">
        <h1 className="text-2xl font-semibold text-slate-950">Admin</h1>
        <p className="mt-2 text-sm text-slate-600">Odeme ve log paneline erismek icin giris yapin.</p>
        {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Kullanici adi veya sifre hatali.</p> : null}
        <label className="mt-5 block">
          <span className="text-sm font-medium text-slate-700">Kullanici adi</span>
          <input name="username" defaultValue="admin" className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3" />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700">Sifre</span>
          <input name="password" type="password" defaultValue="admin123" className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3" />
        </label>
        <button className="mt-5 w-full rounded-lg bg-[var(--brand-700,#047857)] px-4 py-3 font-semibold text-white">Giris yap</button>
      </form>
    </main>
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = (await searchParams) ?? {};
  const loggedIn = await isAdminSession();
  if (!loggedIn) return <LoginCard error={params.error} />;

  let data: Awaited<ReturnType<typeof getAdminData>> | null = null;
  let dataError = "";

  try {
    data = await getAdminData();
  } catch (error) {
    dataError = error instanceof Error ? error.message : "PocketBase verileri alinamadi.";
  }

  const transactions = data?.transactions ?? [];
  const subscriptions = data?.subscriptions ?? [];
  const events = data?.events ?? [];
  const todayTotal = sumSuccess(transactions, (record) => isSameDay(record.created));
  const monthTotal = sumSuccess(transactions, (record) => isSameMonth(record.created));
  const failedCount = transactions.filter((record) => record.status === "failed").length;
  const activeRecurring = subscriptions.filter((record) => record.status === "active" || record.status === "pending").length;

  return (
    <main className="min-h-[100svh] bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Odeme Admin</h1>
            <p className="mt-1 text-sm text-slate-600">Nkolay odemeleri, hatalar, loglar ve tekrarli odeme iptalleri.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/api/admin/transactions.csv" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
              <Download className="h-4 w-4" />
              CSV indir
            </a>
            <form action="/api/admin/logout" method="post">
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                <LogOut className="h-4 w-4" />
                Cikis
              </button>
            </form>
          </div>
        </header>

        {params.cancelled ? <p className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">Tekrarli odeme iptal edildi.</p> : null}
        {params.error ? <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">Islem tamamlanamadi: {String(params.error)}</p> : null}
        {dataError ? (
          <section className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-4 w-4" />
              PocketBase baglantisi okunamadi
            </div>
            <p className="mt-2">{dataError}</p>
          </section>
        ) : null}

        <section className="grid gap-3 md:grid-cols-4">
          <Metric title="Bugun tamamlanan" value={money(todayTotal)} />
          <Metric title="Bu ay tamamlanan" value={money(monthTotal)} />
          <Metric title="Basarisiz odeme" value={failedCount.toLocaleString("tr-TR")} />
          <Metric title="Tekrarli odeme" value={activeRecurring.toLocaleString("tr-TR")} />
        </section>

        <section className="rounded-lg bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Odemeler</h2>
            <span className="text-sm text-slate-500">Son {transactions.length} kayit</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2">Bagisci</th>
                  <th className="px-3 py-2">Tutar</th>
                  <th className="px-3 py-2">Taksit</th>
                  <th className="px-3 py-2">Not</th>
                  <th className="px-3 py-2">Nkolay</th>
                  <th className="px-3 py-2">Hata</th>
                  <th className="px-3 py-2">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((record) => (
                  <tr key={record.id} className="bg-slate-50 align-top">
                    <td className="rounded-l-lg px-3 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(record.status)}`}>{record.status ?? "-"}</span>
                    </td>
                    <td className="px-3 py-3">
                      <strong className="block text-slate-900">{record.expand?.donor?.full_name ?? "-"}</strong>
                      <span className="text-xs text-slate-500">{record.expand?.donor?.email ?? ""}</span>
                    </td>
                    <td className="px-3 py-3">
                      <strong>{money(record.amount, record.currency ?? "TRY")}</strong>
                      {record.total_committed_amount ? <span className="block text-xs text-slate-500">Toplam {money(record.total_committed_amount, record.currency ?? "TRY")}</span> : null}
                    </td>
                    <td className="px-3 py-3">{record.installment ?? 1}</td>
                    <td className="max-w-56 px-3 py-3 text-slate-600">{record.donation_note || "-"}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      <span className="block">Ref: {record.client_ref_code ?? record.id}</span>
                      <span className="block">Pay: {record.nkolay_payment_id ?? "-"}</span>
                    </td>
                    <td className="max-w-72 px-3 py-3 text-xs text-red-700">
                      {record.error_code ? <strong className="block">{record.error_code}</strong> : null}
                      {record.error_message ?? "-"}
                    </td>
                    <td className="rounded-r-lg px-3 py-3 text-xs text-slate-500">{record.created ? new Date(record.created).toLocaleString("tr-TR") : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Tekrarli Odemeler</h2>
            <div className="mt-3 grid gap-3">
              {subscriptions.map((record) => (
                <div key={record.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(record.status)}`}>{record.status ?? "-"}</span>
                      <p className="mt-2 font-semibold text-slate-950">{record.expand?.donor?.full_name ?? "-"}</p>
                      <p className="text-xs text-slate-500">{record.expand?.donor?.email ?? ""}</p>
                      <p className="mt-2 text-sm text-slate-700">
                        {money(record.amount)} x {record.installment_count ?? "-"} odeme · toplam {money(record.total_committed_amount)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Talimat: {record.nkolay_instruction_id ?? "-"}</p>
                      {record.failure_reason ? <p className="mt-2 text-xs text-red-700">{record.failure_reason}</p> : null}
                    </div>
                    {record.nkolay_instruction_id && record.status !== "cancelled" ? (
                      <form action={`/api/admin/subscriptions/${record.id}/cancel`} method="post">
                        <input type="hidden" name="instructionNumber" value={record.nkolay_instruction_id} />
                        <button className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                          <RefreshCcw className="h-4 w-4" />
                          Iptal et
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))}
              {subscriptions.length === 0 ? <p className="text-sm text-slate-500">Tekrarli odeme kaydi yok.</p> : null}
            </div>
          </div>

          <div className="rounded-lg bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Nkolay Loglari</h2>
            <div className="mt-3 max-h-[620px] space-y-3 overflow-auto pr-1">
              {events.map((event) => (
                <details key={event.id} className="rounded-lg border border-slate-200 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                    {event.type ?? "event"} · {event.provider ?? "-"} · {event.created ? new Date(event.created).toLocaleString("tr-TR") : "-"}
                  </summary>
                  <pre className="mt-3 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                    {JSON.stringify(event.payload ?? {}, null, 2)}
                  </pre>
                </details>
              ))}
              {events.length === 0 ? <p className="text-sm text-slate-500">Log kaydi yok.</p> : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        <BadgeCheck className="h-4 w-4 text-[var(--brand-700,#047857)]" />
        {title}
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
