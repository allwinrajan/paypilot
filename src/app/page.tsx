// Main screen: chat on the left (plain English -> invoice), invoice table on the right.
// Both are placeholders for now; real logic arrives on Day 2-3 (see CLAUDE.md roadmap).

const placeholderRows = [
  { client: "Acme GmbH", amount: "$1,200.00", due: "2026-11-01", status: "Overdue" },
  { client: "Northwind Ltd", amount: "$850.00", due: "2026-11-20", status: "Sent" },
  { client: "Lumen Studio", amount: "$400.00", due: "2026-10-15", status: "Paid" },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <h1 className="text-xl font-semibold">PayPilot</h1>
        <span className="text-sm text-zinc-500">PayPal sandbox</span>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[380px_1fr]">
        {/* Left: chat */}
        <section className="flex min-h-[420px] flex-col rounded-lg border border-zinc-200 dark:border-zinc-800">
          <h2 className="border-b border-zinc-200 px-4 py-3 font-medium dark:border-zinc-800">Assistant</h2>
          <div className="flex-1 space-y-3 p-4 text-sm">
            <p className="max-w-[85%] rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
              Describe an invoice in plain English, for example: &quot;Bill Acme GmbH $1,200 for the logo
              redesign, due in 14 days.&quot;
            </p>
          </div>
          <form className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
            <input
              disabled
              placeholder="Chat coming soon"
              className="flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            />
            <button
              disabled
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white opacity-50"
            >
              Send
            </button>
          </form>
        </section>

        {/* Right: invoice table (will become AG Grid synced from PayPal) */}
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
          <h2 className="border-b border-zinc-200 px-4 py-3 font-medium dark:border-zinc-800">
            Invoices <span className="text-sm font-normal text-zinc-500">(sample data)</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Client</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Due</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {placeholderRows.map((row) => (
                  <tr key={row.client} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-2">{row.client}</td>
                    <td className="px-4 py-2">{row.amount}</td>
                    <td className="px-4 py-2">{row.due}</td>
                    <td className="px-4 py-2">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
