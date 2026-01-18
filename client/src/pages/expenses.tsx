import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { expenseFormSchema, accountFormSchema, insertTransferSchema, type Account, type Expense, type Transfer, type Client } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "@/lib/date";
import { isWithinInterval, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import {
    Trash2,
    Wallet,
    FileText,
    TrendingDown,
    TrendingUp,
    Building2,
    Smartphone,
    Banknote,
    PiggyBank,
    BarChart3,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Pencil,
    ArrowRightLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, any> = {
    Rent: Building2,
    Salary: Banknote,
    Utility: TrendingDown,
    Food: PiggyBank,
    Transport: TrendingUp,
    Misc: FileText,
};

const CATEGORY_COLORS: Record<string, string> = {
    Rent: "bg-purple-100 text-purple-600",
    Salary: "bg-blue-100 text-blue-600",
    Utility: "bg-amber-100 text-amber-600",
    Food: "bg-green-100 text-green-600",
    Transport: "bg-cyan-100 text-cyan-600",
    Misc: "bg-gray-100 text-gray-600",
};

export default function ExpensesPage() {
    const { toast } = useToast();
    const [dateFilter, setDateFilter] = useState({
        start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
        end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    });
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [editAccountData, setEditAccountData] = useState({ name: "", type: "Bank", balance: "" });

    const { data: accounts, isLoading: loadingAccounts } = useQuery<Account[]>({
        queryKey: ["/api/accounts"],
    });

    const { data: expenses, isLoading: loadingExpenses } = useQuery<Expense[]>({
        queryKey: ["/api/expenses"],
    });

    const { data: transfers, isLoading: loadingTransfers } = useQuery<Transfer[]>({
        queryKey: ["/api/transfers"],
    });

    const { data: clients } = useQuery<Client[]>({
        queryKey: ["/api/clients"],
    });

    const form = useForm({
        resolver: zodResolver(expenseFormSchema),
        defaultValues: {
            date: new Date().toISOString().split('T')[0],
            amount: "0",
            category: "",
            description: "",
            accountId: "",
            spendingType: "Agency",
            linkedClientId: "",
        },
    });

    const accountForm = useForm({
        resolver: zodResolver(accountFormSchema),
        defaultValues: {
            name: "",
            type: "Financial Statement",
            balance: "0",
            isDefault: false,
        },
    });

    const transferForm = useForm({
        resolver: zodResolver(insertTransferSchema),
        defaultValues: {
            fromAccountId: "",
            toAccountId: "",
            amount: 0,
            date: new Date().toISOString().split('T')[0],
            notes: "",
        },
    });

    const createExpenseMutation = useMutation({
        mutationFn: async (data: any) => {
            return apiRequest("POST", "/api/expenses", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
            queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
            toast({ title: "Expense recorded successfully" });
            form.reset({
                date: new Date().toISOString().split('T')[0],
                amount: "0",
                category: "",
                description: "",
                accountId: "",
                spendingType: "Agency",
                linkedClientId: "",
            });
        },
    });

    const createAccountMutation = useMutation({
        mutationFn: async (data: any) => {
            const payload = { ...data, balance: Number(data.balance) };
            return apiRequest("POST", "/api/accounts", payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
            toast({ title: "Account created" });
            accountForm.reset();
        },
    });

    const deleteExpenseMutation = useMutation({
        mutationFn: async (id: string) => {
            return apiRequest("DELETE", `/api/expenses/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
            queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
            toast({ title: "Expense deleted" });
        },
    });

    const deleteAccountMutation = useMutation({
        mutationFn: async (id: string) => {
            return apiRequest("DELETE", `/api/accounts/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
            toast({ title: "Account deleted" });
        },
    });

    const updateAccountMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const payload = { ...data, balance: Number(data.balance) };
            return apiRequest("PATCH", `/api/accounts/${id}`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
            toast({ title: "Account updated successfully" });
            setEditingAccount(null);
        },
    });

    const createTransferMutation = useMutation({
        mutationFn: async (data: any) => {
            return apiRequest("POST", "/api/transfers", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
            queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
            toast({ title: "Transfer completed successfully" });
            transferForm.reset();
            setTransferDialogOpen(false);
        },
    });

    const [transferDialogOpen, setTransferDialogOpen] = useState(false);

    const openEditDialog = (account: Account) => {
        setEditingAccount(account);
        setEditAccountData({
            name: account.name,
            type: account.type,
            balance: String(account.balance || 0),
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-BD", {
            style: "currency",
            currency: "BDT",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const categories = ["Rent", "Salary", "Utility", "Food", "Transport", "Misc"];

    // Analytics calculations
    const analytics = useMemo(() => {
        if (!expenses) return null;

        const isDateMatch = (dateStr: string) => {
            try {
                return isWithinInterval(parseISO(dateStr), {
                    start: parseISO(dateFilter.start),
                    end: parseISO(dateFilter.end),
                });
            } catch { return false; }
        };

        // Current period expenses
        const currentPeriodExpenses = expenses.filter(e => isDateMatch(e.date));
        const totalExpenses = currentPeriodExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

        // Previous period for comparison
        const prevStart = subMonths(parseISO(dateFilter.start), 1);
        const prevEnd = subMonths(parseISO(dateFilter.end), 1);
        const prevPeriodExpenses = expenses.filter(e => {
            try {
                return isWithinInterval(parseISO(e.date), { start: prevStart, end: prevEnd });
            } catch { return false; }
        });
        const prevTotalExpenses = prevPeriodExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

        // Percent change
        const percentChange = prevTotalExpenses > 0
            ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100
            : 0;

        // Category breakdown
        const categoryBreakdown: Record<string, number> = {};
        currentPeriodExpenses.forEach(e => {
            categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + Number(e.amount);
        });

        // Top category
        const topCategory = Object.entries(categoryBreakdown)
            .sort((a, b) => b[1] - a[1])[0];

        // Chart data
        const chartData = Object.entries(categoryBreakdown).map(([name, value]) => ({
            name,
            amount: value,
            percent: totalExpenses > 0 ? (value / totalExpenses) * 100 : 0,
        }));

        // Daily average
        const daysDiff = Math.max(1, Math.ceil(
            (parseISO(dateFilter.end).getTime() - parseISO(dateFilter.start).getTime()) / (1000 * 60 * 60 * 24)
        ));
        const dailyAverage = totalExpenses / daysDiff;

        // Expense count
        const expenseCount = currentPeriodExpenses.length;

        return {
            totalExpenses,
            prevTotalExpenses,
            percentChange,
            categoryBreakdown,
            topCategory,
            chartData,
            dailyAverage,
            expenseCount,
            filteredExpenses: currentPeriodExpenses,
        };
    }, [expenses, dateFilter]);

    // Total balance across all accounts
    const totalBalance = useMemo(() => {
        return accounts?.reduce((sum, acc) => sum + (acc.balance || 0), 0) || 0;
    }, [accounts]);

    const getAccountIcon = (type: string) => {
        switch (type) {
            case "Financial Statement": return Building2;
            case "Mobile": return Smartphone;
            case "Cash": return Banknote;
            default: return Wallet;
        }
    };

    return (
        <div className="p-6 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Accounting</h1>
                    <p className="text-muted-foreground">Comprehensive overview of agency financials and accounts</p>
                </div>
                <div className="flex flex-wrap gap-2 items-end print:hidden">
                    <Button variant="outline" onClick={() => setTransferDialogOpen(true)}>
                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                        Transfer Money
                    </Button>
                    <div className="space-y-1">
                        <label className="text-xs font-medium">From</label>
                        <Input
                            type="date"
                            value={dateFilter.start}
                            onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                            className="w-[140px]"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium">To</label>
                        <Input
                            type="date"
                            value={dateFilter.end}
                            onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                            className="w-[140px]"
                        />
                    </div>
                </div>
            </div>

            {/* Account Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Total Balance Card */}
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                            <Wallet className="h-4 w-4" /> Total Balance
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 font-mono">
                            {formatCurrency(totalBalance)}
                        </div>
                        <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
                            Across {accounts?.length || 0} accounts
                        </p>
                    </CardContent>
                </Card>

                {/* Total Expenses Card */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <TrendingDown className="h-4 w-4" /> Period Expenses
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600 font-mono">
                            -{formatCurrency(analytics?.totalExpenses || 0)}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                            {(analytics?.percentChange || 0) > 0 ? (
                                <ArrowUpRight className="h-3 w-3 text-red-500" />
                            ) : (analytics?.percentChange || 0) < 0 ? (
                                <ArrowDownRight className="h-3 w-3 text-green-500" />
                            ) : null}
                            <span className={cn(
                                "text-xs",
                                (analytics?.percentChange || 0) > 0 ? "text-red-500" : "text-green-500"
                            )}>
                                {Math.abs(analytics?.percentChange || 0).toFixed(1)}% vs last month
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Daily Average Card */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4" /> Daily Average
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono">
                            {formatCurrency(analytics?.dailyAverage || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {analytics?.expenseCount || 0} transactions
                        </p>
                    </CardContent>
                </Card>

                {/* Top Category Card */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" /> Top Category
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {analytics?.topCategory ? (
                            <>
                                <div className="text-2xl font-bold">{analytics.topCategory[0]}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {formatCurrency(analytics.topCategory[1])}
                                    ({((analytics.topCategory[1] / (analytics.totalExpenses || 1)) * 100).toFixed(0)}% of total)
                                </p>
                            </>
                        ) : (
                            <div className="text-muted-foreground">No data</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Account Cards */}
            <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Wallet className="h-5 w-5" /> Accounts
                </h2>
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {accounts?.map((account) => {
                        const IconComponent = getAccountIcon(account.type);
                        return (
                            <Card key={account.id} className="hover:shadow-md transition-shadow">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            "h-8 w-8 rounded-full flex items-center justify-center",
                                            account.type === "Bank" ? "bg-blue-100 text-blue-600" :
                                                account.type === "Mobile" ? "bg-pink-100 text-pink-600" :
                                                    "bg-green-100 text-green-600"
                                        )}>
                                            <IconComponent className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-sm font-medium">{account.name}</CardTitle>
                                            <p className="text-xs text-muted-foreground">{account.type}</p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className={cn(
                                        "text-xl font-bold font-mono",
                                        (account.balance || 0) >= 0 ? "text-green-600" : "text-red-600"
                                    )}>
                                        {formatCurrency(account.balance || 0)}
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-xs px-2"
                                            onClick={() => openEditDialog(account)}
                                        >
                                            <Pencil className="h-3 w-3 mr-1" /> Edit
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-xs text-red-500 hover:text-red-600 px-2"
                                            onClick={() => {
                                                if (confirm('Delete this account?')) deleteAccountMutation.mutate(account.id);
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                    {(!accounts || accounts.length === 0) && (
                        <Card className="border-dashed">
                            <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
                                No accounts yet. Create one below.
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Category Breakdown & Chart */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Category Breakdown */}
                <Card>
                    <CardHeader>
                        <CardTitle>Expense by Category</CardTitle>
                        <CardDescription>Breakdown of expenses in selected period</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {analytics?.chartData.map((cat) => {
                                const IconComponent = CATEGORY_ICONS[cat.name] || FileText;
                                const colorClass = CATEGORY_COLORS[cat.name] || "bg-gray-100 text-gray-600";
                                return (
                                    <div key={cat.name} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={cn("h-8 w-8 rounded flex items-center justify-center", colorClass)}>
                                                    <IconComponent className="h-4 w-4" />
                                                </div>
                                                <span className="font-medium">{cat.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-mono font-bold">{formatCurrency(cat.amount)}</span>
                                                <span className="text-xs text-muted-foreground ml-2">({cat.percent.toFixed(0)}%)</span>
                                            </div>
                                        </div>
                                        <Progress value={cat.percent} className="h-2" />
                                    </div>
                                );
                            })}
                            {(!analytics?.chartData || analytics.chartData.length === 0) && (
                                <div className="text-center py-8 text-muted-foreground">
                                    No expenses in this period
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Expense Distribution</CardTitle>
                        <CardDescription>Visual breakdown by category</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {analytics?.chartData && analytics.chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analytics.chartData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" tickFormatter={(val) => formatCurrency(val)} />
                                    <YAxis type="category" dataKey="name" width={80} />
                                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                                    <Bar dataKey="amount" fill="#ef4444" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                No data to display
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="expenses" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="expenses">Record Expense</TabsTrigger>
                    <TabsTrigger value="history">Expense History</TabsTrigger>
                    <TabsTrigger value="transfers">Transfer History</TabsTrigger>
                    <TabsTrigger value="accounts">Manage Accounts</TabsTrigger>
                </TabsList>

                <TabsContent value="expenses" className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-3">
                        <Card className="lg:col-span-1">
                            <CardHeader>
                                <CardTitle>New Expense</CardTitle>
                                <CardDescription>Record a new expense transaction</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit((data) => createExpenseMutation.mutate(data))} className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="date"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Date</FormLabel>
                                                    <FormControl>
                                                        <Input type="date" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="category"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Category</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select category" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {categories.map((cat) => (
                                                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="spendingType"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Expense For</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select type" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Agency">Agency</SelectItem>
                                                            <SelectItem value="Client">Client</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {form.watch("spendingType") === "Client" && (
                                            <FormField
                                                control={form.control}
                                                name="linkedClientId"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Select Client</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select client" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {clients?.map((client) => (
                                                                    <SelectItem key={client.id} value={client.id}>{client.companyName}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        )}

                                        <FormField
                                            control={form.control}
                                            name="accountId"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Paid From</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select account" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {accounts?.map((acc) => (
                                                                <SelectItem key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance || 0)})</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="amount"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Amount</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="description"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Description</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Optional note" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button type="submit" className="w-full" disabled={createExpenseMutation.isPending}>
                                            <TrendingDown className="mr-2 h-4 w-4" />
                                            Record Expense
                                        </Button>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>

                        {/* Recent Quick View */}
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle>Recent Expenses</CardTitle>
                                <CardDescription>Last 10 transactions</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {expenses?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10).map(expense => {
                                        const IconComponent = CATEGORY_ICONS[expense.category] || FileText;
                                        const colorClass = CATEGORY_COLORS[expense.category] || "bg-gray-100 text-gray-600";
                                        return (
                                            <div key={expense.id} className="flex items-center justify-between py-2 border-b last:border-0">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("h-10 w-10 rounded flex items-center justify-center", colorClass)}>
                                                        <IconComponent className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">{expense.category}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {format(new Date(expense.date), "MMM d, yyyy")} {expense.description && `• ${expense.description}`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-bold text-red-600 font-mono">-{formatCurrency(expense.amount)}</span>
                                                    <Button variant="ghost" size="icon" onClick={() => deleteExpenseMutation.mutate(expense.id)}>
                                                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {(!expenses || expenses.length === 0) && (
                                        <p className="text-center text-muted-foreground py-8">No expenses recorded yet</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle>Expense History</CardTitle>
                            <CardDescription>All expenses in selected period ({analytics?.expenseCount || 0} transactions)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Account</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {analytics?.filteredExpenses
                                        ?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map(expense => {
                                            const account = accounts?.find(a => a.id === expense.accountId);
                                            return (
                                                <TableRow key={expense.id}>
                                                    <TableCell className="font-mono text-sm">{format(new Date(expense.date), "MMM d, yyyy")}</TableCell>
                                                    <TableCell>
                                                        {expense.spendingType === "Client" ? (
                                                            <div className="flex flex-col">
                                                                <Badge variant="secondary" className="w-fit">Client</Badge>
                                                                <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                                                                    {clients?.find(c => c.id === expense.linkedClientId)?.companyName || "Unknown Client"}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <Badge variant="outline">Agency</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{expense.category}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">{expense.description || "-"}</TableCell>
                                                    <TableCell>{account?.name || "-"}</TableCell>
                                                    <TableCell className="text-right font-mono font-bold text-red-600">
                                                        -{formatCurrency(expense.amount)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" onClick={() => deleteExpenseMutation.mutate(expense.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    {(!analytics?.filteredExpenses || analytics.filteredExpenses.length === 0) && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                No expenses in this period
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="transfers">
                    <Card>
                        <CardHeader>
                            <CardTitle>Transfer History</CardTitle>
                            <CardDescription>Recent account-to-account transfers</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>From</TableHead>
                                        <TableHead>To</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transfers?.map(transfer => (
                                        <TableRow key={transfer.id}>
                                            <TableCell className="font-mono text-xs">{format(new Date(transfer.date), "MMM d, yyyy")}</TableCell>
                                            <TableCell>
                                                {accounts?.find(a => a.id === transfer.fromAccountId)?.name || "Unknown"}
                                            </TableCell>
                                            <TableCell>
                                                {accounts?.find(a => a.id === transfer.toAccountId)?.name || "Unknown"}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{transfer.notes || "-"}</TableCell>
                                            <TableCell className="text-right font-mono font-bold">
                                                {formatCurrency(transfer.amount)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {(!transfers || transfers.length === 0) && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                No transfers recorded yet
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="accounts">
                    <Card className="max-w-md">
                        <CardHeader>
                            <CardTitle>Add New Account</CardTitle>
                            <CardDescription>Create a new money source account</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...accountForm}>
                                <form onSubmit={accountForm.handleSubmit((data) => createAccountMutation.mutate(data))} className="space-y-4">
                                    <FormField
                                        control={accountForm.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Account Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g., City Bank" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={accountForm.control}
                                        name="type"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Type</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select type" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Financial Statement">Financial Statement</SelectItem>
                                                        <SelectItem value="Mobile">Mobile Banking</SelectItem>
                                                        <SelectItem value="Cash">Cash</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={accountForm.control}
                                        name="balance"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Initial Balance</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="submit" className="w-full" disabled={createAccountMutation.isPending}>
                                        Create Account
                                    </Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Edit Account Dialog */}
            <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Transfer Money</DialogTitle>
                    </DialogHeader>
                    <Form {...transferForm}>
                        <form onSubmit={transferForm.handleSubmit((data) => createTransferMutation.mutate(data))} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={transferForm.control}
                                    name="fromAccountId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>From Account</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {accounts?.map((acc) => (
                                                        <SelectItem key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance || 0)})</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={transferForm.control}
                                    name="toAccountId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>To Account</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {accounts?.map((acc) => (
                                                        <SelectItem key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance || 0)})</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={transferForm.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Amount</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={transferForm.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={transferForm.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Notes</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Optional notes" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <DialogFooter>
                                <Button type="submit" disabled={createTransferMutation.isPending}>
                                    {createTransferMutation.isPending ? "Transferring..." : "Complete Transfer"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Account</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Account Name</label>
                            <Input
                                value={editAccountData.name}
                                onChange={(e) => setEditAccountData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Account name"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Type</label>
                            <Select
                                value={editAccountData.type}
                                onValueChange={(value) => setEditAccountData(prev => ({ ...prev, type: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Bank">Bank</SelectItem>
                                    <SelectItem value="Mobile">Mobile Banking</SelectItem>
                                    <SelectItem value="Cash">Cash</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Balance</label>
                            <Input
                                type="number"
                                value={editAccountData.balance}
                                onChange={(e) => setEditAccountData(prev => ({ ...prev, balance: e.target.value }))}
                                placeholder="Current balance"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingAccount(null)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                if (editingAccount) {
                                    updateAccountMutation.mutate({
                                        id: editingAccount.id,
                                        data: editAccountData,
                                    });
                                }
                            }}
                            disabled={updateAccountMutation.isPending}
                        >
                            {updateAccountMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
