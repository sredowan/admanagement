import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  AlertCircle,
  Users,
  FileText,
  Plus,
  ArrowRight,
  Wallet,
  Receipt,
  PiggyBank,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Target,
} from "lucide-react";
import type { DashboardMetrics, Invoice, Client, Payment, Expense } from "@shared/schema";
import { format } from "@/lib/date";
import { isWithinInterval, parseISO, startOfMonth, endOfMonth, subMonths, differenceInDays } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard"],
  });

  const { data: recentInvoices, isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: allInvoices } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: payments } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  // Advanced analytics calculations
  const analytics = useMemo(() => {
    if (!allInvoices || !payments || !expenses) return null;

    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    // This month's revenue
    const thisMonthPayments = payments.filter(p => {
      try {
        return isWithinInterval(parseISO(p.date), { start: thisMonthStart, end: thisMonthEnd });
      } catch { return false; }
    });
    const thisMonthRevenue = thisMonthPayments.reduce((sum, p) => sum + p.amount, 0);

    // Last month's revenue
    const lastMonthPayments = payments.filter(p => {
      try {
        return isWithinInterval(parseISO(p.date), { start: lastMonthStart, end: lastMonthEnd });
      } catch { return false; }
    });
    const lastMonthRevenue = lastMonthPayments.reduce((sum, p) => sum + p.amount, 0);

    // Revenue change
    const revenueChange = lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0;

    // This month's expenses
    const thisMonthExpenses = expenses.filter(e => {
      try {
        return isWithinInterval(parseISO(e.date), { start: thisMonthStart, end: thisMonthEnd });
      } catch { return false; }
    });
    const thisMonthExpenseTotal = thisMonthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    // Collection rate
    const totalBilled = allInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
    const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
    const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

    // Aging buckets
    const agingBuckets = { current: 0, overdue30: 0, overdue60: 0, overdue90: 0 };
    allInvoices.forEach(inv => {
      if (inv.dueAmount <= 0) return;
      const invoiceDate = parseISO(inv.invoiceDate);
      const daysOutstanding = differenceInDays(now, invoiceDate);

      if (daysOutstanding <= 30) agingBuckets.current += inv.dueAmount;
      else if (daysOutstanding <= 60) agingBuckets.overdue30 += inv.dueAmount;
      else if (daysOutstanding <= 90) agingBuckets.overdue60 += inv.dueAmount;
      else agingBuckets.overdue90 += inv.dueAmount;
    });

    // Invoice status breakdown
    const statusBreakdown = { Paid: 0, Partial: 0, Pending: 0, Overdue: 0, Draft: 0 };
    allInvoices.forEach(inv => {
      if (inv.status in statusBreakdown) {
        statusBreakdown[inv.status as keyof typeof statusBreakdown]++;
      }
    });

    // Top clients by revenue
    const clientRevenue: Record<string, number> = {};
    payments.forEach(p => {
      clientRevenue[p.clientId] = (clientRevenue[p.clientId] || 0) + p.amount;
    });
    const topClients = Object.entries(clientRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([clientId, revenue]) => ({
        clientId,
        clientName: clients?.find(c => c.id === clientId)?.companyName || "Unknown",
        revenue,
      }));

    // Monthly trend (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(now, i));
      const monthEnd = endOfMonth(subMonths(now, i));
      const monthPayments = payments.filter(p => {
        try {
          return isWithinInterval(parseISO(p.date), { start: monthStart, end: monthEnd });
        } catch { return false; }
      });
      const monthExpenses = expenses.filter(e => {
        try {
          return isWithinInterval(parseISO(e.date), { start: monthStart, end: monthEnd });
        } catch { return false; }
      });
      monthlyTrend.push({
        month: format(monthStart, "MMM"),
        revenue: monthPayments.reduce((sum, p) => sum + p.amount, 0),
        expenses: monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
      });
    }

    return {
      thisMonthRevenue,
      lastMonthRevenue,
      revenueChange,
      thisMonthExpenseTotal,
      collectionRate,
      agingBuckets,
      statusBreakdown,
      topClients,
      monthlyTrend,
    };
  }, [allInvoices, payments, expenses, clients]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      Paid: "default",
      Pending: "secondary",
      Overdue: "destructive",
      Draft: "outline",
      Partial: "secondary",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const getClientName = (clientId: string) => {
    const client = clients?.find((c) => c.id === clientId);
    return client?.companyName || "Unknown Client";
  };

  const isLoading = metricsLoading || invoicesLoading;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Financial Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild data-testid="button-new-invoice">
            <Link href="/invoices/new">
              <Plus className="h-4 w-4 mr-2" />
              New Invoice
            </Link>
          </Button>
          <Button variant="outline" asChild data-testid="button-add-ad-cost">
            <Link href="/ad-costs">
              <DollarSign className="h-4 w-4 mr-2" />
              Add Ad Cost
            </Link>
          </Button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            {/* Total Billed */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Receipt className="h-3 w-3" /> Total Billed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold font-mono">{formatCurrency(metrics?.totalBilled || 0)}</div>
                <p className="text-xs text-muted-foreground">{metrics?.invoiceCount || 0} invoices</p>
              </CardContent>
            </Card>

            {/* Total Collected */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Wallet className="h-3 w-3" /> Collected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-green-600 font-mono">{formatCurrency(metrics?.totalReceived || 0)}</div>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>

            {/* Outstanding */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Outstanding
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-amber-600 font-mono">{formatCurrency(metrics?.totalOutstanding || 0)}</div>
                <p className="text-xs text-muted-foreground">{metrics?.pendingInvoices || 0} pending</p>
              </CardContent>
            </Card>

            {/* Net Profit */}
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
                  <PiggyBank className="h-3 w-3" /> Net Profit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn(
                  "text-xl font-bold font-mono",
                  (metrics?.totalProfit || 0) >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600"
                )}>
                  {formatCurrency(metrics?.totalProfit || 0)}
                </div>
                <p className="text-xs text-green-600/70 dark:text-green-500/70">Realized</p>
              </CardContent>
            </Card>

            {/* Collection Rate */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Target className="h-3 w-3" /> Collection Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn(
                  "text-xl font-bold font-mono",
                  (analytics?.collectionRate || 0) >= 80 ? "text-green-600" :
                    (analytics?.collectionRate || 0) >= 50 ? "text-amber-600" : "text-red-600"
                )}>
                  {formatPercent(analytics?.collectionRate || 0)}
                </div>
                <Progress value={analytics?.collectionRate || 0} className="mt-1 h-1" />
              </CardContent>
            </Card>

            {/* Active Clients */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" /> Clients
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold font-mono">{metrics?.clientCount || 0}</div>
                <p className="text-xs text-muted-foreground">Active</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* This Month Performance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              This Month Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-blue-600">
              {formatCurrency(analytics?.thisMonthRevenue || 0)}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {(analytics?.revenueChange || 0) > 0 ? (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              ) : (analytics?.revenueChange || 0) < 0 ? (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              ) : null}
              <span className={cn(
                "text-sm font-medium",
                (analytics?.revenueChange || 0) > 0 ? "text-green-600" :
                  (analytics?.revenueChange || 0) < 0 ? "text-red-600" : "text-muted-foreground"
              )}>
                {Math.abs(analytics?.revenueChange || 0).toFixed(1)}% vs last month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              This Month Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-red-600">
              -{formatCurrency(analytics?.thisMonthExpenseTotal || 0)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Agency costs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              This Month Net
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold font-mono",
              ((analytics?.thisMonthRevenue || 0) - (analytics?.thisMonthExpenseTotal || 0)) >= 0
                ? "text-green-600" : "text-red-600"
            )}>
              {formatCurrency((analytics?.thisMonthRevenue || 0) - (analytics?.thisMonthExpenseTotal || 0))}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Revenue - Expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts & Lists Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Revenue vs Expenses Trend</CardTitle>
            <CardDescription>Last 6 months comparison</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px]">
            {analytics?.monthlyTrend && analytics.monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.monthlyTrend}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Area type="monotone" dataKey="revenue" stroke="#22c55e" fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                  <Area type="monotone" dataKey="expenses" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpenses)" name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accounts Receivable Aging */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              A/R Aging
            </CardTitle>
            <CardDescription>Outstanding by days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded bg-green-50 dark:bg-green-950/30">
              <span className="text-sm">Current (0-30)</span>
              <span className="font-mono font-bold text-green-600">{formatCurrency(analytics?.agingBuckets.current || 0)}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-yellow-50 dark:bg-yellow-950/30">
              <span className="text-sm">31-60 Days</span>
              <span className="font-mono font-bold text-yellow-600">{formatCurrency(analytics?.agingBuckets.overdue30 || 0)}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-orange-50 dark:bg-orange-950/30">
              <span className="text-sm">61-90 Days</span>
              <span className="font-mono font-bold text-orange-600">{formatCurrency(analytics?.agingBuckets.overdue60 || 0)}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-red-50 dark:bg-red-950/30">
              <span className="text-sm flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> 90+ Days
              </span>
              <span className="font-mono font-bold text-red-600">{formatCurrency(analytics?.agingBuckets.overdue90 || 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Invoices */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg font-semibold">Recent Invoices</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/invoices" data-testid="link-view-all-invoices">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : recentInvoices && recentInvoices.length > 0 ? (
              <div className="space-y-1">
                {recentInvoices.slice(0, 5).map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/invoices/${invoice.id}`}
                    className="flex items-center justify-between py-3 px-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                    data-testid={`link-invoice-${invoice.id}`}
                  >
                    <div>
                      <p className="font-medium">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {getClientName(invoice.clientId)} &bull;{" "}
                        {format(new Date(invoice.invoiceDate), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <span className="font-mono text-sm font-medium">
                        {formatCurrency(invoice.totalAmount)}
                      </span>
                      {getStatusBadge(invoice.status)}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No invoices yet</p>
                <Button variant="ghost" asChild className="mt-2">
                  <Link href="/invoices/new">Create your first invoice</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Clients & Invoice Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Top Clients</CardTitle>
            <CardDescription>By lifetime revenue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics?.topClients && analytics.topClients.length > 0 ? (
              analytics.topClients.map((client, index) => (
                <div key={client.clientId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      index === 0 ? "bg-amber-100 text-amber-700" :
                        index === 1 ? "bg-gray-100 text-gray-600" :
                          index === 2 ? "bg-orange-100 text-orange-700" :
                            "bg-slate-100 text-slate-600"
                    )}>
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium truncate max-w-[120px]">{client.clientName}</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-green-600">{formatCurrency(client.revenue)}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-muted-foreground">No client data</div>
            )}

            {/* Invoice Status Mini Summary */}
            <div className="border-t pt-4 mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Invoice Status</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold text-green-600">{analytics?.statusBreakdown.Paid || 0}</div>
                  <div className="text-xs text-muted-foreground">Paid</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-blue-600">{analytics?.statusBreakdown.Partial || 0}</div>
                  <div className="text-xs text-muted-foreground">Partial</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-amber-600">{analytics?.statusBreakdown.Pending || 0}</div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-600">{analytics?.statusBreakdown.Overdue || 0}</div>
                  <div className="text-xs text-muted-foreground">Overdue</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
