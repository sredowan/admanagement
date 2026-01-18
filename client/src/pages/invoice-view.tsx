import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Printer,
  FileText,
  Check,
  Pencil,
  CalendarIcon,
} from "lucide-react";
import type { InvoiceWithDetails, Client, Payment } from "@shared/schema";
import { paymentFormSchema, paymentMethods } from "@shared/schema";
import { format } from "@/lib/date";
import { cn } from "@/lib/utils";
import { SiFacebook, SiGoogle, SiLinkedin, SiYoutube } from "react-icons/si";
import html2pdf from "html2pdf.js";

const platformIcons: Record<string, typeof SiFacebook> = {
  Facebook: SiFacebook,
  Google: SiGoogle,
  LinkedIn: SiLinkedin,
  YouTube: SiYoutube,
};

type PaymentFormData = z.infer<typeof paymentFormSchema>;

export default function InvoiceViewPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handlePrint = () => {
    // Select the invoice card element using a specific ID
    const element = document.getElementById("invoice-print-container");

    if (!element) {
      console.error("Invoice element not found");
      return;
    }

    const opt = {
      margin: [5, 5, 5, 5] as [number, number, number, number],
      filename: `Invoice-${invoice?.invoiceNumber}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0, windowHeight: element.scrollHeight },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(element).save();
  };

  const { data: invoice, isLoading } = useQuery<InvoiceWithDetails>({
    queryKey: ["/api/invoices", id],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: payments } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const { data: settings } = useQuery<any[]>({
    queryKey: ["/api/settings"],
  });

  const { data: accounts } = useQuery<any[]>({
    queryKey: ["/api/accounts"],
  });

  const getSetting = (key: string) => settings?.find((s) => s.key === key)?.value;

  const paymentForm = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      clientId: "",
      invoiceId: id,
      date: format(new Date(), "yyyy-MM-dd"),
      amount: 0,
      method: "bKash",
      notes: "Payment for Invoice " + (invoice?.invoiceNumber || ""),
      accountId: "",
    },
  });

  // Reset form when invoice loads or dialog opens
  useEffect(() => {
    if (invoice && paymentDialogOpen) {
      paymentForm.reset({
        clientId: invoice.clientId,
        invoiceId: invoice.id,
        date: format(new Date(), "yyyy-MM-dd"),
        amount: invoice.dueAmount,
        method: paymentForm.getValues("method") || "bKash",
        notes: `Payment for ${invoice.invoiceNumber}`,
        accountId: paymentForm.getValues("accountId") || "",
      });
    }
  }, [invoice, paymentDialogOpen, paymentForm]);

  const paymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      // Force invoiceId to ensure linkage
      const payload = { ...data, invoiceId: id };
      return apiRequest("POST", "/api/payments", payload);
    },
    onSuccess: () => {
      setPaymentDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({
        title: "Payment Recorded",
        description: "Payment has been recorded and invoice status updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onPaymentSubmit = (data: PaymentFormData) => {
    paymentMutation.mutate(data);
  };

  const client = clients?.find((c) => c.id === invoice?.clientId);

  // Sort payments to show newest first for transactions table
  const currentMonthTransactions = payments?.filter(p => {
    if (!invoice) return false;
    if (p.clientId !== invoice.clientId) return false;
    // Show payments linked to this invoice OR created in the same month
    const pDate = new Date(p.date);
    const iDate = new Date(invoice.invoiceDate);
    const isSameMonth = pDate.getMonth() === iDate.getMonth() && pDate.getFullYear() === iDate.getFullYear();
    const isLinked = p.invoiceId === invoice.id;
    return isLinked || isSameMonth;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      Paid: "default",
      Pending: "secondary",
      Overdue: "destructive",
      Draft: "outline",
      Partial: "secondary",
    };
    return (
      <Badge variant={variants[status] || "secondary"} className="text-sm">
        {status}
      </Badge>
    );
  };

  const PlatformIcon = ({ platform }: { platform: string }) => {
    const Icon = platformIcons[platform];
    if (Icon) return <Icon className="h-4 w-4" />;
    return null;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardContent className="p-8">
            <div className="space-y-4">
              <Skeleton className="h-12 w-64" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-40 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
          <h3 className="mt-4 text-lg font-medium">Invoice not found</h3>
          <Button className="mt-4" asChild>
            <Link href="/invoices">Back to Invoices</Link>
          </Button>
        </div>
      </div>
    );
  }

  const adCostItems = invoice.items?.filter((i) => i.itemType === "AdCost") || [];
  const otherItems = invoice.items?.filter((i) => i.itemType !== "AdCost") || [];

  // Calculate Ad Spend Costs (USD conversion apply)
  const totalAdActualCost = adCostItems.reduce((sum, i) => sum + (i.actualCost || 0), 0);
  const usdSpend = totalAdActualCost / invoice.fbDollarRate;
  const supplierPaymentForAds = usdSpend * invoice.supplierDollarRate;

  // Calculate Other Items Costs (Direct BDT expenses)
  const totalOtherActualCost = otherItems.reduce((sum, i) => sum + (i.actualCost || 0), 0);

  // Total Costs
  const totalActualCost = totalAdActualCost + totalOtherActualCost;

  return (
    <div className="min-h-screen bg-background">
      {/* Header / Config Section - Hidden on Print */}
      <div className="p-6 border-b print:hidden flex flex-col md:flex-row gap-4 justify-between items-center bg-card shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/invoices")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Invoice #{invoice.invoiceNumber}</h1>
            <p className="text-sm text-muted-foreground">
              {client?.companyName} • {format(new Date(invoice.invoiceDate), "MMM d, yyyy")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(invoice.status !== "Paid" || invoice.dueAmount > 0) && (
            <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Check className="h-4 w-4 mr-2" />
                  Mark Paid / Pay
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Payment</DialogTitle>
                </DialogHeader>
                <Form {...paymentForm}>
                  <form onSubmit={paymentForm.handleSubmit(onPaymentSubmit)} className="space-y-4">
                    {/* Invoice Info Details */}
                    <div className="bg-muted/50 p-3 rounded-md text-sm mb-4">
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">Total Due:</span>
                        <span className="font-mono font-medium">{formatCurrency(invoice.dueAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Invoice:</span>
                        <span className="font-medium">#{invoice.invoiceNumber}</span>
                      </div>
                    </div>

                    <FormField
                      control={paymentForm.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value
                                    ? format(new Date(field.value), "MMM d, yyyy")
                                    : "Pick a date"}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value ? new Date(field.value) : undefined}
                                onSelect={(date) => {
                                  if (date) {
                                    field.onChange(format(date, "yyyy-MM-dd"));
                                    setCalendarOpen(false);
                                  }
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={paymentForm.control}
                      name="method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Method</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {paymentMethods.map((method) => (
                                <SelectItem key={method} value={method}>
                                  {method}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={paymentForm.control}
                      name="accountId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deposit Profit To Account</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select account for profit" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {accounts?.map((account: any) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.name} ({account.type}) - ৳{account.balance}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-[10px]">
                            Only the profit portion of this payment will be added to the account.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={paymentForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount (BDT)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                ৳
                              </span>
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                className="pl-8 font-mono"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={paymentForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Optional notes..."
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={paymentMutation.isPending}>
                        {paymentMutation.isPending ? "Recording..." : "Record Payment"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/invoices/${id}/edit`}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Main Invoice Content - The part that gets printed */}
      <div
        id="invoice-print-container"
        className="max-w-[210mm] mx-auto bg-white shadow-2xl my-8 print:shadow-none print:my-0 print:w-full print:max-w-none"
      >
        <div className="px-5 py-3 print:px-0 print:py-0 space-y-2" id="invoice-content">
          {/* Invoice Header */}
          <div className="flex justify-between items-start border-b pb-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">
                  {getSetting("agencyName") || "AdBill Pro"}
                </h1>
              </div>
              <div className="text-xs text-gray-500 font-medium leading-tight">
                {getSetting("agencyAddress") && <p>{getSetting("agencyAddress")}</p>}
                {getSetting("agencyPhone") && <p>{getSetting("agencyPhone")}</p>}
                {getSetting("agencyEmail") && <p>{getSetting("agencyEmail")}</p>}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-light text-gray-900 mb-0.5">INVOICE</h2>
              <p className="text-xs text-gray-500">No. <span className="font-mono text-gray-900 font-medium">{invoice.invoiceNumber}</span></p>
              <div className="mt-1">{getStatusBadge(invoice.status)}</div>
            </div>
          </div>

          {/* Bill To / Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Billed To</h3>
              <div className="space-y-0 text-xs text-gray-700 leading-snug">
                <p className="font-bold text-gray-900 text-sm">{client?.companyName}</p>
                <p>{client?.contactPerson}</p>
                {client?.billingAddress && <p className="whitespace-pre-line">{client.billingAddress}</p>}
                <p>{client?.email}</p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between border-b pb-0.5">
                <span className="text-xs text-gray-500">Invoice Date</span>
                <span className="text-xs font-medium">{format(new Date(invoice.invoiceDate), "MMMM d, yyyy")}</span>
              </div>
              {adCostItems.length > 0 && (
                <div className="flex justify-between border-b pb-0.5">
                  <span className="text-xs text-gray-500">Service Period</span>
                  <span className="text-xs font-medium">
                    {format(new Date(invoice.periodStart), "MMM d")} - {format(new Date(invoice.periodEnd), "MMM d, yyyy")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div>
            <Table className="border-b border-black">
              <TableHeader>
                <TableRow className="border-b border-black hover:bg-transparent">
                  <TableHead className="text-black font-bold uppercase text-[10px] h-7 py-1">Description</TableHead>
                  <TableHead className="text-black font-bold uppercase text-[10px] h-7 py-1 w-[80px]">Date</TableHead>
                  <TableHead className="text-black font-bold uppercase text-[10px] h-7 py-1 text-right w-[100px]">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Ad Cost Items */}
                {adCostItems.map((item) => (
                  <TableRow key={item.id} className="border-b border-gray-100 font-medium">
                    <TableCell className="py-1">
                      <div className="flex items-center gap-1.5">
                        {item.platform && <PlatformIcon platform={item.platform} />}
                        <span className="text-xs">{item.description}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-1 text-[10px] text-gray-500 font-mono">
                      {item.date ? format(new Date(item.date), "MMM d") : "-"}
                    </TableCell>
                    <TableCell className="py-1 text-right font-mono text-xs">
                      {formatCurrency(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Other Items */}
                {otherItems.map((item) => (
                  <TableRow key={item.id} className="border-b border-gray-100 font-medium">
                    <TableCell className="py-1">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[8px] h-4 rounded py-0 px-1">{item.itemType}</Badge>
                        <span className="text-xs">{item.description}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-1 text-[10px] text-gray-500 font-mono">-</TableCell>
                    <TableCell className="py-1 text-right font-mono text-xs">
                      {formatCurrency(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end">
            <div className="w-[250px] space-y-1">
              {/* Subtotal */}
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-mono font-medium">{formatCurrency(invoice.subtotal)}</span>
              </div>

              {/* bKash Fee */}
              {invoice.includeBkashFee && invoice.bkashFeePercent > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">bKash Fee ({invoice.bkashFeePercent}%)</span>
                  <span className="font-mono font-medium">{formatCurrency(invoice.subtotal * (invoice.bkashFeePercent / 100))}</span>
                </div>
              )}

              {/* VAT */}
              {invoice.vatAmount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">VAT ({invoice.vatPercent}%)</span>
                  <span className="font-mono font-medium">{formatCurrency(invoice.vatAmount)}</span>
                </div>
              )}

              {/* Grand Total */}
              <div className="pt-1 border-t border-black flex justify-between items-baseline">
                <span className="font-bold text-sm">Grand Total</span>
                <span className="font-mono font-bold text-lg">{formatCurrency(invoice.totalAmount)}</span>
              </div>

              {/* Paid to Date */}
              <div className="flex justify-between text-xs text-green-600">
                <span className="font-medium">Paid to Date</span>
                <span className="font-mono font-bold">-{formatCurrency(invoice.paidAmount)}</span>
              </div>

              {/* Balance Due */}
              <div className="flex justify-between text-xs text-red-600 border-t border-dashed pt-0.5">
                <span className="font-medium">Balance Due</span>
                <span className="font-mono font-bold">{formatCurrency(invoice.dueAmount)}</span>
              </div>
            </div>
          </div>

          {/* Recent Transactions Section */}
          {currentMonthTransactions && currentMonthTransactions.length > 0 && (
            <div className="mt-3 border-t pt-2">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Transactions</h4>
              <div className="overflow-hidden w-full max-w-sm">
                <table className="w-full text-[9px] text-left">
                  <thead className="text-gray-500 font-medium border-b">
                    <tr>
                      <th className="pb-0.5">Date</th>
                      <th className="pb-0.5">Method</th>
                      <th className="pb-0.5">Notes</th>
                      <th className="pb-0.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    {currentMonthTransactions.map(p => (
                      <tr key={p.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-0.5">{format(new Date(p.date), "MMM d")}</td>
                        <td className="py-0.5">{p.method}</td>
                        <td className="py-0.5 text-muted-foreground truncate max-w-[80px]">{p.notes}</td>
                        <td className="py-0.5 text-right font-mono">{formatCurrency(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer: Payment Details & Notes */}
          <div className="pt-3 mt-auto space-y-2">

            {/* Payment Details - 2 Columns */}
            <div>
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Payment Details</h4>
              <div className="grid grid-cols-2 gap-4 p-2 bg-gray-50 rounded border border-gray-100 print:bg-transparent print:p-0 print:border-0 print:gap-2">

                {/* Mobile Banking (First) */}
                <div>
                  <p className="font-semibold text-gray-900 text-xs border-b pb-0.5 mb-1">Mobile Banking</p>
                  <div className="grid grid-cols-[55px_1fr] gap-0.5 text-[10px] text-gray-600">
                    <span className="text-gray-500">Provider:</span>
                    <span>{getSetting("mobileProvider") || "Bkash / Nagad"}</span>

                    <span className="text-gray-500">Number:</span>
                    <span className="font-mono text-gray-900 font-medium">{getSetting("mobileNumber") || "01XXXXXXXXX"}</span>

                    <span className="text-gray-500">Type:</span>
                    <span>{getSetting("mobileType") || "Personal"}</span>
                  </div>
                </div>

                {/* Bank Transfer (Second) */}
                <div>
                  <p className="font-semibold text-gray-900 text-xs border-b pb-0.5 mb-1">Bank Transfer</p>
                  <div className="grid grid-cols-[55px_1fr] gap-0.5 text-[10px] text-gray-600">
                    <span className="text-gray-500">Bank:</span>
                    <span>{getSetting("bankName") || "Dutch Bangla Bank Ltd."}</span>

                    <span className="text-gray-500">Account:</span>
                    <span className="font-mono text-gray-900 font-medium">{getSetting("bankAccountName") || "Company Name"}</span>

                    <span className="text-gray-500">Number:</span>
                    <span className="font-mono text-gray-900 font-medium">{getSetting("bankAccountNumber") || "XXXX.XXXX.XXXX"}</span>

                    <span className="text-gray-500">Branch:</span>
                    <span>{getSetting("bankBranch") || "Branch Name"}</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Notes Section */}
            {invoice.notes && (
              <div className="space-y-1">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Notes</h4>
                <p className="text-[10px] text-gray-600 leading-relaxed bg-yellow-50/50 p-2 rounded print:bg-transparent print:p-0">{invoice.notes}</p>
              </div>
            )}
          </div>

          {/* Final Footer */}
          <div className="pt-3 text-center">
            <p className="text-[10px] text-gray-400 font-medium">Thank you for your business!</p>
          </div>
        </div>
      </div>
    </div >
  );
}
