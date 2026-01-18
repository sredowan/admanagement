import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Search,
  CreditCard,
  CalendarIcon,
  Trash2,
  Wallet,
  Building,
  Smartphone,
} from "lucide-react";
import type { Payment, Client, Invoice } from "@shared/schema";
import { paymentFormSchema, paymentMethods } from "@shared/schema";
import { format } from "@/lib/date";
import { z } from "zod";
import { cn } from "@/lib/utils";

type PaymentFormData = z.infer<typeof paymentFormSchema>;

const methodIcons: Record<string, typeof Wallet> = {
  Cash: Wallet,
  bKash: Smartphone,
  "Financial Statement": Building,
};

function PaymentForm({
  onSuccess,
  onCancel,
  clients,
  invoices,
  defaultInvoiceId,
}: {
  onSuccess: () => void;
  onCancel: () => void;
  clients: Client[];
  invoices: Invoice[];
  defaultInvoiceId?: string;
}) {
  const { toast } = useToast();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const defaultInvoice = defaultInvoiceId
    ? invoices.find((i) => i.id === defaultInvoiceId)
    : undefined;

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      clientId: defaultInvoice?.clientId || "",
      invoiceId: defaultInvoiceId || "",
      date: format(new Date(), "yyyy-MM-dd"),
      amount: defaultInvoice?.dueAmount || 0,
      method: "bKash",
      notes: "",
    },
  });

  const selectedClientId = form.watch("clientId");
  const clientInvoices = invoices.filter(
    (i) => i.clientId === selectedClientId && i.status !== "Paid"
  );

  const mutation = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      return apiRequest("POST", "/api/payments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({
        title: "Payment recorded",
        description: "The payment has been added successfully.",
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PaymentFormData) => {
    mutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="clientId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client *</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  form.setValue("invoiceId", "");
                }}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger data-testid="select-client">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="invoiceId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Invoice (Optional)</FormLabel>
              <Select
                onValueChange={(val) => field.onChange(val === "_none" ? "" : val)}
                value={field.value || "_none"}
              >
                <FormControl>
                  <SelectTrigger data-testid="select-invoice">
                    <SelectValue placeholder="Link to invoice (optional)" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="_none">No specific invoice</SelectItem>
                  {clientInvoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.invoiceNumber} - Due:{" "}
                      {new Intl.NumberFormat("en-BD", {
                        style: "currency",
                        currency: "BDT",
                        minimumFractionDigits: 0,
                      }).format(invoice.dueAmount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Date *</FormLabel>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        data-testid="button-date-picker"
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
            control={form.control}
            name="method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Method *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-method">
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
        </div>

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount (BDT) *</FormLabel>
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
                    data-testid="input-amount"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Payment notes..."
                  {...field}
                  value={field.value || ""}
                  data-testid="input-notes"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending} data-testid="button-save-payment">
            {mutation.isPending ? "Saving..." : "Record Payment"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function PaymentsPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const defaultInvoiceId = params.get("invoiceId") || undefined;

  const [dialogOpen, setDialogOpen] = useState(!!defaultInvoiceId);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedMethod, setSelectedMethod] = useState<string>("all");
  const { toast } = useToast();

  const { data: payments, isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/payments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({
        title: "Payment deleted",
        description: "The payment record has been removed.",
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

  const filteredPayments = payments?.filter((payment) => {
    const matchesClient = selectedClient === "all" || payment.clientId === selectedClient;
    const matchesMethod = selectedMethod === "all" || payment.method === selectedMethod;
    const matchesSearch =
      !searchQuery ||
      payment.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClient && matchesMethod && matchesSearch;
  });

  const totalPayments = filteredPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;

  const getClientName = (clientId: string) => {
    return clients?.find((c) => c.id === clientId)?.companyName || "Unknown";
  };

  const getInvoiceNumber = (invoiceId: string | null) => {
    if (!invoiceId) return null;
    return invoices?.find((i) => i.id === invoiceId)?.invoiceNumber;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const MethodIcon = ({ method }: { method: string }) => {
    const Icon = methodIcons[method] || Wallet;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">
            Payments
          </h1>
          <p className="text-muted-foreground mt-1">
            Track and manage client payments
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-payment">
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            {clients && clients.length > 0 && invoices ? (
              <PaymentForm
                clients={clients}
                invoices={invoices}
                defaultInvoiceId={defaultInvoiceId}
                onSuccess={() => setDialogOpen(false)}
                onCancel={() => setDialogOpen(false)}
              />
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground">
                  Please add a client first.
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-payments"
                />
              </div>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="w-[180px]" data-testid="filter-client">
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                <SelectTrigger className="w-[150px]" data-testid="filter-method">
                  <SelectValue placeholder="All Methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-end gap-2">
              <span className="text-sm text-muted-foreground">Total:</span>
              <span className="font-mono font-semibold text-lg text-chart-2" data-testid="text-total-payments">
                {formatCurrency(totalPayments)}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : filteredPayments && filteredPayments.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase tracking-wider">Date</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Client</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Invoice</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Method</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-right">
                      Amount
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Notes</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments
                    .sort(
                      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                    )
                    .map((payment) => (
                      <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(payment.date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>{getClientName(payment.clientId)}</TableCell>
                        <TableCell>
                          {payment.invoiceId ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {getInvoiceNumber(payment.invoiceId)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <MethodIcon method={payment.method} />
                            <span>{payment.method}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <div className={cn("font-bold", payment.amount < 0 ? "text-red-600" : "text-green-600")}>
                            {payment.amount < 0 ? "-" : "+"}{formatCurrency(Math.abs(payment.amount))}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {payment.notes || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-payment-${payment.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Payment</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this payment record? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(payment.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-medium">No payments found</h3>
              <p className="text-muted-foreground mt-1">
                {searchQuery || selectedClient !== "all" || selectedMethod !== "all"
                  ? "Try adjusting your filters"
                  : "Record your first payment to get started"}
              </p>
              {!searchQuery && selectedClient === "all" && selectedMethod === "all" && (
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
