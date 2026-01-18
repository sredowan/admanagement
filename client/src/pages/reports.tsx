import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "@/lib/date";
import { isWithinInterval, parseISO, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import type { Client, Invoice, AdCost, Payment, InvoiceWithDetails, Expense } from "@shared/schema";
import { cn } from "@/lib/utils";
import {
    Loader2,
    Printer,
    TrendingUp,
    TrendingDown,
    Wallet,
    Receipt,
    PiggyBank,
    AlertTriangle,
    CheckCircle2,
    Clock,
} from "lucide-react";



export default function ReportsPage() {
    const [selectedClientId, setSelectedClientId] = useState<string>("all");
    const [dateRange, setDateRange] = useState({
        start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
        end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    });

    // Fetch Data
    const { data: clients, isLoading: loadingClients, error: clientsError } = useQuery<Client[]>({
        queryKey: ["/api/clients"],
    });

    const { data: invoices, isLoading: loadingInvoices, error: invoicesError } = useQuery<InvoiceWithDetails[]>({
        queryKey: ["/api/invoices"],
    });

    const { data: adCosts, isLoading: loadingAdCosts, error: adCostsError } = useQuery<AdCost[]>({
        queryKey: ["/api/ad-costs"],
    });

    const { data: payments, isLoading: loadingPayments, error: paymentsError } = useQuery<Payment[]>({
        queryKey: ["/api/payments"],
    });

    const { data: expenses, isLoading: loadingExpenses, error: expensesError } = useQuery<Expense[]>({
        queryKey: ["/api/expenses"],
    });

    const isLoading = loadingClients || loadingInvoices || loadingAdCosts || loadingPayments || loadingExpenses;
    const error = clientsError || invoicesError || adCostsError || paymentsError || expensesError;

    // Helper: Calculate profit margin for an invoice
    const calculateInvoiceProfitMargin = (inv: InvoiceWithDetails) => {
        const adItems = inv.items?.filter(i => i.itemType === "AdCost") || [];
        const otherItems = inv.items?.filter(i => i.itemType !== "AdCost") || [];

        const adCostSum = adItems.reduce((s, i) => s + (i.actualCost || 0), 0);
        const otherCostSum = otherItems.reduce((s, i) => s + (i.actualCost || 0), 0);

        const usdSpend = adCostSum / (inv.fbDollarRate || 122);
        const supplierCost = usdSpend * (inv.supplierDollarRate || 128);
        const bkashFee = inv.includeBkashFee ? inv.subtotal * ((inv.bkashFeePercent || 1.8) / 100) : 0;

        const invoiceTotalCost = supplierCost + otherCostSum + bkashFee;
        const invoiceTotalProfit = inv.totalAmount - invoiceTotalCost;
        const profitMargin = inv.totalAmount > 0 ? invoiceTotalProfit / inv.totalAmount : 0;

        return { invoiceTotalCost, invoiceTotalProfit, profitMargin, supplierCost, otherCostSum, bkashFee };
    };

    // Process Data
    const reportData = useMemo(() => {
        if (isLoading || error || !clients || !invoices || !adCosts || !payments || !expenses) return null;

        // Filter Helpers
        const isClientMatch = (cid: string) => selectedClientId === "all" || cid === selectedClientId;
        const isDateMatch = (dateStr: string) => {
            if (!dateStr) return false;
            try {
                return isWithinInterval(parseISO(dateStr), {
                    start: parseISO(dateRange.start),
                    end: parseISO(dateRange.end),
                });
            } catch (e) {
                console.error("Invalid date:", dateStr);
                return false;
            }
        };

        // Filtered Entities
        const filteredInvoices = (invoices || []).filter(
            (inv) => isClientMatch(inv.clientId) && isDateMatch(inv.invoiceDate)
        );
        const filteredPayments = (payments || []).filter(
            (pay) => isClientMatch(pay.clientId) && isDateMatch(pay.date)
        );
        const filteredAdCosts = (adCosts || []).filter(
            (cost) => isClientMatch(cost.clientId) && isDateMatch(cost.date)
        );
        const filteredExpenses = (expenses || []).filter((exp) => {
            if (!isDateMatch(exp.date)) return false;
            if (selectedClientId === "all") {
                // For agency report, show Agency expenses + all Client expenses?
                // Or just Agency? User said "only if i choose the expense related to client"
                // Let's show all for the "All Clients" view
                return true;
            }
            // For specific client, only show expenses linked to them
            return exp.spendingType === "Client" && exp.linkedClientId === selectedClientId;
        });

        // Basic Aggregations
        const totalBilled = filteredInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
        const totalReceived = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalAdSpendBDT = filteredAdCosts.reduce((sum, c) => sum + c.spendBdt, 0);
        const totalAgencyExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

        // Collection Rate
        const collectionRate = totalBilled > 0 ? (totalReceived / totalBilled) * 100 : 0;

        // Profit Calculation (Cash Basis: Based on PAYMENTS received)
        let totalGrossProfit = 0;
        let totalRealizedCost = 0;

        filteredPayments.forEach(pay => {
            const inv = invoices.find(i => i.id === pay.invoiceId);
            if (!inv) return;

            const { profitMargin, invoiceTotalCost } = calculateInvoiceProfitMargin(inv);

            // Realized Profit = Payment Amount * Profit Margin
            totalGrossProfit += (pay.amount * profitMargin);
            // Realized Cost = Payment Amount * (1 - Profit Margin)
            totalRealizedCost += (pay.amount * (1 - profitMargin));
        });

        // Gross Profit Margin Percentage
        const grossProfitMargin = totalReceived > 0 ? (totalGrossProfit / totalReceived) * 100 : 0;

        // Net Income = Gross Profit - Filtered Expenses
        const totalNetIncome = totalGrossProfit - totalAgencyExpenses;
        const netProfitMargin = totalReceived > 0 ? (totalNetIncome / totalReceived) * 100 : 0;

        const totalDue = totalBilled - totalReceived;

        // Accounts Receivable Aging
        const today = new Date();
        const agingBuckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };

        filteredInvoices.forEach(inv => {
            if (inv.dueAmount <= 0) return;
            const invoiceDate = parseISO(inv.invoiceDate);
            const daysOutstanding = differenceInDays(today, invoiceDate);

            if (daysOutstanding <= 30) agingBuckets.current += inv.dueAmount;
            else if (daysOutstanding <= 60) agingBuckets.days30 += inv.dueAmount;
            else if (daysOutstanding <= 90) agingBuckets.days60 += inv.dueAmount;
            else if (daysOutstanding <= 120) agingBuckets.days90 += inv.dueAmount;
            else agingBuckets.over90 += inv.dueAmount;
        });

        // Payment Method Breakdown
        const paymentMethodBreakdown = { Cash: 0, bKash: 0, "Financial Statement": 0 };
        filteredPayments.forEach(pay => {
            if (pay.method in paymentMethodBreakdown) {
                paymentMethodBreakdown[pay.method as keyof typeof paymentMethodBreakdown] += pay.amount;
            }
        });

        // Invoice Status Summary
        const invoiceStatusCount = { Paid: 0, Partial: 0, Pending: 0, Overdue: 0, Draft: 0 };
        filteredInvoices.forEach(inv => {
            if (inv.status in invoiceStatusCount) {
                invoiceStatusCount[inv.status as keyof typeof invoiceStatusCount]++;
            }
        });

        return {
            totalBilled,
            totalReceived,
            totalAdSpendBDT,
            totalGrossProfit,
            totalRealizedCost,
            totalAgencyExpenses,
            totalNetIncome,
            totalDue,
            collectionRate,
            grossProfitMargin,
            netProfitMargin,
            agingBuckets,
            paymentMethodBreakdown,
            invoiceStatusCount,
            filteredInvoices,
            filteredPayments,
            filteredAdCosts,
            filteredExpenses
        };
    }, [clients, invoices, adCosts, payments, expenses, selectedClientId, dateRange, isLoading, error]);

    // Chart Data - Now uses REALIZED profit from payments
    const chartData = useMemo(() => {
        if (!reportData || !invoices || !payments) return [];

        const clientMap = new Map<string, { name: string; billed: number; received: number; profit: number }>();

        // Initialize with filtered invoices
        reportData.filteredInvoices.forEach(inv => {
            const cName = clients?.find(c => c.id === inv.clientId)?.companyName || "Unknown";
            if (!clientMap.has(cName)) {
                clientMap.set(cName, { name: cName, billed: 0, received: 0, profit: 0 });
            }
            const cur = clientMap.get(cName)!;
            cur.billed += inv.totalAmount;
        });

        // Add realized profit from payments
        reportData.filteredPayments.forEach(pay => {
            const inv = invoices.find(i => i.id === pay.invoiceId);
            if (!inv) return;

            const cName = clients?.find(c => c.id === pay.clientId)?.companyName || "Unknown";
            if (!clientMap.has(cName)) {
                clientMap.set(cName, { name: cName, billed: 0, received: 0, profit: 0 });
            }

            const cur = clientMap.get(cName)!;
            cur.received += pay.amount;

            const { profitMargin } = calculateInvoiceProfitMargin(inv);
            cur.profit += (pay.amount * profitMargin);
        });

        return Array.from(clientMap.values());
    }, [reportData, clients, invoices, payments]);

    // Payment Method Pie Data
    const paymentMethodPieData = useMemo(() => {
        if (!reportData) return [];
        return Object.entries(reportData.paymentMethodBreakdown)
            .filter(([_, value]) => value > 0)
            .map(([name, value]) => ({ name, value }));
    }, [reportData]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", minimumFractionDigits: 0 }).format(amount);

    const formatPercent = (value: number) => `${value.toFixed(1)}%`;

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-destructive/15 text-destructive p-4 rounded-md">
                    <h3 className="font-bold">Error Loading Data</h3>
                    <p>{error.message}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-8">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
                    <p className="text-muted-foreground">Comprehensive financial analysis & performance metrics</p>
                </div>
                <div className="flex flex-wrap gap-2 items-end">
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Start Date</label>
                        <Input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="w-[140px]"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium">End Date</label>
                        <Input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="w-[140px]"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium">Client</label>
                        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="All Clients" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Clients</SelectItem>
                                {clients?.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="outline" onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" /> Print Report
                    </Button>
                </div>
            </div>

            {/* Key Performance Indicators */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {/* Total Revenue */}
                <Card className="col-span-2 md:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Receipt className="h-3 w-3" /> Total Billed
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold font-mono">{formatCurrency(reportData?.totalBilled || 0)}</div>
                    </CardContent>
                </Card>

                {/* Total Received */}
                <Card className="col-span-2 md:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Wallet className="h-3 w-3" /> Collected
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-green-600 font-mono">{formatCurrency(reportData?.totalReceived || 0)}</div>
                    </CardContent>
                </Card>

                {/* Collection Rate */}
                <Card className="col-span-2 md:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" /> Collection Rate
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={cn(
                            "text-xl font-bold font-mono",
                            (reportData?.collectionRate || 0) >= 80 ? "text-green-600" :
                                (reportData?.collectionRate || 0) >= 50 ? "text-amber-600" : "text-red-600"
                        )}>
                            {formatPercent(reportData?.collectionRate || 0)}
                        </div>
                        <Progress value={reportData?.collectionRate || 0} className="mt-2 h-1" />
                    </CardContent>
                </Card>

                {/* Gross Profit */}
                <Card className="col-span-2 md:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <PiggyBank className="h-3 w-3" /> Gross Profit
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-blue-600 font-mono">{formatCurrency(reportData?.totalGrossProfit || 0)}</div>
                        <p className="text-xs text-muted-foreground">Margin: {formatPercent(reportData?.grossProfitMargin || 0)}</p>
                    </CardContent>
                </Card>

                {/* Agency Expenses */}
                <Card className="col-span-2 md:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" /> Expenses
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-red-600 font-mono">-{formatCurrency(reportData?.totalAgencyExpenses || 0)}</div>
                    </CardContent>
                </Card>

                {/* Net Income */}
                <Card className="col-span-2 md:col-span-1 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Net Income
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={cn(
                            "text-xl font-bold font-mono",
                            (reportData?.totalNetIncome || 0) >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600"
                        )}>
                            {formatCurrency(reportData?.totalNetIncome || 0)}
                        </div>
                        <p className="text-xs text-green-600/70 dark:text-green-500/70">Net Margin: {formatPercent(reportData?.netProfitMargin || 0)}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Accounts Receivable Aging & Payment Methods */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Accounts Receivable Aging */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-amber-500" />
                            Accounts Receivable Aging
                        </CardTitle>
                        <CardDescription>Outstanding balances by days overdue</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-5 gap-2 text-center">
                            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                                <p className="text-xs text-muted-foreground">Current</p>
                                <p className="text-lg font-bold text-green-600 font-mono">{formatCurrency(reportData?.agingBuckets.current || 0)}</p>
                                <p className="text-xs text-green-600">0-30 days</p>
                            </div>
                            <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
                                <p className="text-xs text-muted-foreground">31-60</p>
                                <p className="text-lg font-bold text-yellow-600 font-mono">{formatCurrency(reportData?.agingBuckets.days30 || 0)}</p>
                                <p className="text-xs text-yellow-600">days</p>
                            </div>
                            <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                                <p className="text-xs text-muted-foreground">61-90</p>
                                <p className="text-lg font-bold text-orange-600 font-mono">{formatCurrency(reportData?.agingBuckets.days60 || 0)}</p>
                                <p className="text-xs text-orange-600">days</p>
                            </div>
                            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                                <p className="text-xs text-muted-foreground">91-120</p>
                                <p className="text-lg font-bold text-red-600 font-mono">{formatCurrency(reportData?.agingBuckets.days90 || 0)}</p>
                                <p className="text-xs text-red-600">days</p>
                            </div>
                            <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700">
                                <p className="text-xs text-muted-foreground">120+</p>
                                <p className="text-lg font-bold text-red-700 font-mono">{formatCurrency(reportData?.agingBuckets.over90 || 0)}</p>
                                <p className="text-xs text-red-700 flex items-center justify-center gap-1">
                                    <AlertTriangle className="h-3 w-3" /> Critical
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Total Outstanding</span>
                            <span className="text-lg font-bold font-mono">{formatCurrency(reportData?.totalDue || 0)}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Top Clients by Revenue */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-blue-500" />
                            Top Clients
                        </CardTitle>
                        <CardDescription>By realized profit in period</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {chartData.length > 0 ? (
                            <div className="space-y-3">
                                {chartData
                                    .sort((a, b) => b.profit - a.profit)
                                    .slice(0, 5)
                                    .map((client, index) => {
                                        const profitMargin = client.received > 0 ? (client.profit / client.received) * 100 : 0;
                                        const collectionRate = client.billed > 0 ? (client.received / client.billed) * 100 : 0;
                                        return (
                                            <div key={client.name} className="space-y-1">
                                                <div className="flex items-center justify-between">
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
                                                        <span className="font-medium text-sm truncate max-w-[120px]">{client.name}</span>
                                                    </div>
                                                    <span className="text-green-600 font-mono font-bold text-sm">
                                                        {formatCurrency(client.profit)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 ml-8 text-xs text-muted-foreground">
                                                    <span>Margin: <span className="font-mono">{formatPercent(profitMargin)}</span></span>
                                                    <span>Collected: <span className="font-mono">{formatPercent(collectionRate)}</span></span>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        ) : (
                            <div className="h-[180px] flex items-center justify-center text-muted-foreground">
                                No data in this period
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Performance Chart */}
            <div className="print:break-inside-avoid">
                <Card>
                    <CardHeader>
                        <CardTitle>Client Performance Overview</CardTitle>
                        <CardDescription>Billed vs Collected vs Realized Profit by Client</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                                <Legend />
                                <Bar dataKey="billed" name="Billed" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="received" name="Collected" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="profit" name="Realized Profit" fill="#22c55e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Invoice Status Summary */}
            <div className="grid grid-cols-5 gap-3 print:hidden">
                <Card className="text-center">
                    <CardContent className="pt-4">
                        <Badge variant="default" className="mb-1">Paid</Badge>
                        <p className="text-2xl font-bold">{reportData?.invoiceStatusCount.Paid || 0}</p>
                    </CardContent>
                </Card>
                <Card className="text-center">
                    <CardContent className="pt-4">
                        <Badge variant="secondary" className="mb-1">Partial</Badge>
                        <p className="text-2xl font-bold">{reportData?.invoiceStatusCount.Partial || 0}</p>
                    </CardContent>
                </Card>
                <Card className="text-center">
                    <CardContent className="pt-4">
                        <Badge variant="secondary" className="mb-1">Pending</Badge>
                        <p className="text-2xl font-bold">{reportData?.invoiceStatusCount.Pending || 0}</p>
                    </CardContent>
                </Card>
                <Card className="text-center">
                    <CardContent className="pt-4">
                        <Badge variant="destructive" className="mb-1">Overdue</Badge>
                        <p className="text-2xl font-bold">{reportData?.invoiceStatusCount.Overdue || 0}</p>
                    </CardContent>
                </Card>
                <Card className="text-center">
                    <CardContent className="pt-4">
                        <Badge variant="outline" className="mb-1">Draft</Badge>
                        <p className="text-2xl font-bold">{reportData?.invoiceStatusCount.Draft || 0}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Tables */}
            <div className="space-y-6 print:break-before-page">
                <h2 className="text-xl font-bold">Invoice Details</h2>
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Invoice #</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Billed</TableHead>
                                <TableHead className="text-right">Paid</TableHead>
                                <TableHead className="text-right">Realized Profit</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData?.filteredInvoices
                                .slice()
                                .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
                                .map(inv => {
                                    const { profitMargin, invoiceTotalProfit } = calculateInvoiceProfitMargin(inv);
                                    // Realized profit = paidAmount * profitMargin
                                    const realizedProfit = inv.paidAmount * profitMargin;
                                    const potentialProfit = invoiceTotalProfit;

                                    return (
                                        <TableRow key={inv.id}>
                                            <TableCell className="font-medium">
                                                <Link href={`/invoices/${inv.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                                                    {inv.invoiceNumber}
                                                </Link>
                                            </TableCell>
                                            <TableCell>{clients?.find(c => c.id === inv.clientId)?.companyName}</TableCell>
                                            <TableCell>{format(parseISO(inv.invoiceDate), "MMM d, yyyy")}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(inv.totalAmount)}</TableCell>
                                            <TableCell className="text-right font-mono text-blue-600">{formatCurrency(inv.paidAmount)}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="font-mono text-green-600">{formatCurrency(realizedProfit)}</div>
                                                {inv.paidAmount < inv.totalAmount && (
                                                    <div className="text-xs text-muted-foreground">
                                                        of {formatCurrency(potentialProfit)} potential
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant={inv.status === "Paid" ? "default" : inv.status === "Partial" ? "secondary" : "outline"}>
                                                    {inv.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            {reportData?.filteredInvoices.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No invoices found for this period</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Expense Details */}
            <div className="space-y-6 print:break-before-page">
                <h2 className="text-xl font-bold">Expense Details</h2>
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData?.filteredExpenses
                                .slice()
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .map(exp => (
                                    <TableRow key={exp.id}>
                                        <TableCell className="font-mono text-sm">{format(new Date(exp.date), "MMM d, yyyy")}</TableCell>
                                        <TableCell>
                                            <Badge variant={exp.spendingType === "Client" ? "secondary" : "outline"}>
                                                {exp.spendingType === "Client" ? "Client" : "Agency"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{exp.category}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{exp.description || "-"}</TableCell>
                                        <TableCell className="text-right font-mono text-red-600">-{formatCurrency(exp.amount)}</TableCell>
                                    </TableRow>
                                ))}
                            {reportData?.filteredExpenses.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No expenses found for this period</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
