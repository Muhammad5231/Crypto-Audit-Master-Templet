'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Documentation Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Built-in documentation using Accordion sections.
// Beginner-friendly language, clear examples, code-formatted formulas.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  BookOpen,
  Upload,
  Columns3,
  GitBranch,
  Calculator,
  Receipt,
  Percent,
  ShieldCheck,
  IndianRupee,
  Scale,
  PackageOpen,
  AlertTriangle,
} from 'lucide-react'

// ── Documentation sections data ────────────────────────────
// Each section has an icon, title, and rich content (JSX).

const sections = [
  {
    id: 'what-is-cam',
    icon: <BookOpen className="h-4 w-4 text-teal-500" />,
    title: 'What is Crypto Audit Master?',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Crypto Audit Master</strong> is a tool that helps you audit
          your cryptocurrency spot trades and calculate your Indian tax liability. It processes your
          exchange CSV files, matches buy-sell pairs using FIFO (First-In-First-Out), and generates a
          comprehensive report with realized profits, open holdings, and tax breakdowns.
        </p>
        <div className="p-3 rounded-xl bg-muted/50 text-sm space-y-1">
          <p>✅ Upload CSV files from any Indian crypto exchange</p>
          <p>✅ Automatic buy-sell matching (FIFO method)</p>
          <p>✅ Indian crypto tax calculation (30% + 4% cess)</p>
          <p>✅ TDS, GST, and fee tracking</p>
          <p>✅ Open holdings management</p>
          <p>✅ Export reports for your CA</p>
        </div>
      </div>
    ),
  },
  {
    id: 'upload-csv',
    icon: <Upload className="h-4 w-4 text-teal-500" />,
    title: 'How to Upload CSV Files',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Uploading your trade data is the first step. Here&apos;s how to do it:
        </p>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Export your trade history from your exchange as a CSV file</li>
          <li>Go to the <strong className="text-foreground">Upload CSV</strong> page</li>
          <li>Drag and drop your CSV file or click to browse</li>
          <li>The system will automatically detect columns and validate rows</li>
          <li>After upload, click <strong className="text-foreground">Process Report</strong> to generate your audit</li>
        </ol>
        <div className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/20 text-sm">
          <strong className="text-teal-600 dark:text-teal-400">Tip:</strong> You can upload multiple CSV files
          to the same workspace. Each upload adds to the existing trade data.
        </div>
      </div>
    ),
  },
  {
    id: 'column-names',
    icon: <Columns3 className="h-4 w-4 text-teal-500" />,
    title: 'Supported CSV Column Names & Aliases',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          The system automatically recognizes many common column names. Here are the supported
          fields and their aliases:
        </p>
        <div className="space-y-2">
          {[
            { field: 'Trade Time', aliases: 'trade_time, datetime, date, time, timestamp, traded_at, executed_at, order_date, trade_date' },
            { field: 'Pair / Contract', aliases: 'contract, symbol, pair, instrument, market, trading_pair, ticker' },
            { field: 'Quantity', aliases: 'qty, quantity, amount, volume, executed_qty, fill_qty, trade_qty' },
            { field: 'Side (Buy/Sell)', aliases: 'side, type, direction, trade_type, order_type, action, buy_sell' },
            { field: 'Executed Price', aliases: 'price, executed_price, fill_price, trade_price, avg_price, rate' },
            { field: 'Fees', aliases: 'fee, fees, trading_fee, commission, brokerage, fee_amount' },
            { field: 'TDS', aliases: 'tds, tds_amount, tax_deducted, tds_deducted' },
            { field: 'Order Value', aliases: 'order_value, trade_value, total, value, amount_inr' },
            { field: 'Trade Status', aliases: 'status, trade_status, order_status, execution_status' },
          ].map((item) => (
            <div key={item.field} className="p-2 rounded-lg bg-muted/50">
              <p className="text-xs font-semibold">{item.field}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{item.aliases}</p>
            </div>
          ))}
        </div>
        <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20 text-sm">
          <strong className="text-orange-600 dark:text-orange-400">Note:</strong> If your CSV columns
          aren&apos;t auto-detected, you&apos;ll be prompted to manually map each column to the correct field.
        </div>
      </div>
    ),
  },
  {
    id: 'fifo-matching',
    icon: <GitBranch className="h-4 w-4 text-teal-500" />,
    title: 'How FIFO Matching Works',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">FIFO (First-In-First-Out)</strong> means your earliest
          buy trades are matched with sell trades first. This is the standard method for calculating
          realized gains.
        </p>
        <div className="p-3 rounded-xl bg-muted/50 text-sm space-y-2">
          <p className="font-semibold">Example:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li><strong className="text-foreground">Buy 1:</strong> 0.5 BTC @ ₹25,00,000 on 1 Jan</li>
            <li><strong className="text-foreground">Buy 2:</strong> 0.3 BTC @ ₹28,00,000 on 15 Feb</li>
            <li><strong className="text-foreground">Sell:</strong> 0.6 BTC @ ₹30,00,000 on 1 Mar</li>
          </ol>
          <p className="mt-2">The sell of 0.6 BTC matches with:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Full Buy 1 (0.5 BTC) — profit on 0.5 × (30L − 25L) = <span className="text-green-600 dark:text-green-400">₹2,50,000</span></li>
            <li>Partial Buy 2 (0.1 BTC) — profit on 0.1 × (30L − 28L) = <span className="text-green-600 dark:text-green-400">₹20,000</span></li>
          </ul>
          <p>Remaining: Buy 2 has 0.2 BTC left as an <strong className="text-foreground">open holding</strong></p>
        </div>
      </div>
    ),
  },
  {
    id: 'realized-profit',
    icon: <Calculator className="h-4 w-4 text-teal-500" />,
    title: 'How Realized Profit is Calculated',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Realized profit is the gain or loss when a sell trade is matched with a buy trade through FIFO.
        </p>
        <div className="p-3 rounded-xl bg-muted/50 font-mono text-sm space-y-1">
          <p>Gross Profit = Sell Value − Buy Value</p>
          <p>where:</p>
          <p>  Sell Value = Sell Price × Matched Qty</p>
          <p>  Buy Value = Buy Price × Matched Qty</p>
        </div>
        <p className="text-sm text-muted-foreground">
          After deducting fees, GST, TDS, and tax, you get the <strong className="text-foreground">Final Net Profit</strong>.
        </p>
      </div>
    ),
  },
  {
    id: 'fees-handling',
    icon: <Receipt className="h-4 w-4 text-teal-500" />,
    title: 'How Fees are Handled',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Trading fees are deducted from your profit. The system uses a <strong className="text-foreground">CSV-first</strong> approach:
        </p>
        <div className="p-3 rounded-xl bg-muted/50 text-sm space-y-1">
          <p>1. <strong>CSV-provided fee</strong> → Used directly if &gt; 0</p>
          <p>2. <strong>Exchange default fee</strong> → Applied if CSV fee is 0 or missing</p>
          <p>3. <strong>No fee</strong> → If both are absent, fee = 0</p>
        </div>
        <p className="text-sm text-muted-foreground">
          When a BUY lot is partially matched, fees are proportionally allocated:
        </p>
        <div className="p-3 rounded-xl bg-muted/50 font-mono text-sm">
          Matched Fee = Original Fee × (Matched Qty / Original Qty)
        </div>
      </div>
    ),
  },
  {
    id: 'gst-calculation',
    icon: <Percent className="h-4 w-4 text-teal-500" />,
    title: 'How GST is Calculated',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          GST (Goods and Services Tax) at <strong className="text-foreground">18%</strong> is applied
          only on trading fees — not on trade value or profit. This is because exchange fees are
          considered a service.
        </p>
        <div className="p-3 rounded-xl bg-muted/50 font-mono text-sm">
          GST = Total Trading Fees × 18%
        </div>
        <p className="text-sm text-muted-foreground">
          Both buy-side and sell-side fees attract GST. The GST percentage can be configured in
          Exchange Settings if your exchange charges a different rate.
        </p>
      </div>
    ),
  },
  {
    id: 'tds-handling',
    icon: <ShieldCheck className="h-4 w-4 text-teal-500" />,
    title: 'How TDS is Handled',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          TDS (Tax Deducted at Source) is <strong className="text-foreground">1%</strong> of the sell
          trade value, deducted by the exchange at the time of each sell. Similar to fees, TDS follows
          a CSV-first approach:
        </p>
        <div className="p-3 rounded-xl bg-muted/50 text-sm space-y-1">
          <p>1. <strong>CSV-provided TDS</strong> → Used directly if &gt; 0</p>
          <p>2. <strong>Default TDS %</strong> → Applied on sell value if CSV TDS is 0 or missing</p>
        </div>
        <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-sm">
          <strong className="text-blue-600 dark:text-blue-400">Important:</strong> TDS is NOT an additional
          tax. It is a prepaid credit against your total tax liability. When calculating your final net
          profit, TDS is added back because it was already deducted from your proceeds.
        </div>
      </div>
    ),
  },
  {
    id: 'direct-tax',
    icon: <IndianRupee className="h-4 w-4 text-teal-500" />,
    title: 'How Direct Crypto Tax is Calculated',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Under Section 115BBH of the Income Tax Act, virtual digital assets are taxed at a flat rate
          with no offset for losses:
        </p>
        <div className="p-3 rounded-xl bg-muted/50 font-mono text-sm space-y-2">
          <p>Base Crypto Tax = Gross Positive Gain × 30%</p>
          <p>Cess = Base Crypto Tax × 4%</p>
          <p>Total Direct Tax = Base Crypto Tax + Cess</p>
        </div>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Key points:</strong>
        </p>
        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
          <li>Only positive gains are taxed — losses cannot reduce your tax</li>
          <li>The 4% Health & Education Cess applies on top of the 30% base tax</li>
          <li>TDS already deducted is a credit against this total tax liability</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'net-profit-diff',
    icon: <Scale className="h-4 w-4 text-teal-500" />,
    title: 'Net Profit in Hand vs Final Net Profit',
    content: (
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium mb-2">Net Profit in Hand</p>
          <p className="text-sm text-muted-foreground mb-2">
            This is what you actually receive after all immediate deductions:
          </p>
          <div className="p-3 rounded-xl bg-muted/50 font-mono text-sm">
            Net Profit in Hand = Gross Profit − Fees − GST − TDS
          </div>
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Final Net Profit</p>
          <p className="text-sm text-muted-foreground mb-2">
            This is your true bottom line after accounting for the tax you owe and the TDS credit:
          </p>
          <div className="p-3 rounded-xl bg-muted/50 font-mono text-sm">
            Final Net Profit = Net Profit in Hand − Direct Tax + TDS
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            TDS is added back because it was already taken from your sell proceeds (reducing your
            &quot;in hand&quot; amount), but it counts as a credit against your tax bill.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'open-holdings',
    icon: <PackageOpen className="h-4 w-4 text-teal-500" />,
    title: 'What Open Holdings Mean',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          An <strong className="text-foreground">open holding</strong> is a buy trade (or portion of a
          buy trade) that has not yet been matched with a sell trade. These represent crypto you
          currently hold.
        </p>
        <div className="space-y-2">
          <div className="p-3 rounded-xl bg-muted/50 text-sm">
            <p className="font-semibold">Fully Unmatched</p>
            <p className="text-muted-foreground">The entire buy lot has no corresponding sell — you still hold all of it.</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/50 text-sm">
            <p className="font-semibold">Partially Matched</p>
            <p className="text-muted-foreground">Some quantity has been sold, but a portion remains unmatched and still held.</p>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/20 text-sm">
          <strong className="text-teal-600 dark:text-teal-400">Note:</strong> Open holdings show your
          buy price and invested value only. Market value and unrealized P&L are not shown as they
          require live market data.
        </div>
      </div>
    ),
  },
  {
    id: 'disclaimer',
    icon: <AlertTriangle className="h-4 w-4 text-orange-500" />,
    title: 'Tax Disclaimer',
    content: (
      <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20 text-sm space-y-2">
        <p className="text-muted-foreground">
          This platform provides audit and tax-review assistance. It is <strong className="text-foreground">not a substitute</strong> for
          professional tax filing advice.
        </p>
        <ul className="text-muted-foreground list-disc list-inside space-y-1">
          <li>Tax laws and rates may change</li>
          <li>Individual circumstances may vary</li>
          <li>The calculations are based on current Indian crypto tax provisions</li>
          <li>Always consult a qualified Chartered Accountant for tax filing</li>
        </ul>
      </div>
    ),
  },
]

// ── Main Documentation Component ───────────────────────────

export default function DocumentationPage() {
  return (
    <div className="space-y-6">
      {/* ── Header Card ── */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10">
              <BookOpen className="h-5 w-5 text-teal-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Documentation</h2>
              <p className="text-sm text-muted-foreground">
                Everything you need to know about Crypto Audit Master
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Documentation Accordion ── */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardContent className="p-4">
          <Accordion type="multiple" className="w-full">
            {sections.map((section) => (
              <AccordionItem key={section.id} value={section.id}>
                <AccordionTrigger className="text-sm hover:no-underline">
                  <div className="flex items-center gap-2">
                    {section.icon}
                    <span>{section.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {section.content}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}
