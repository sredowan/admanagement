         import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  CalendarIcon,
  Plus,
  Trash2,
  Calculator,
  FileText,
} from "lucide-react";
import type { Client, AdCost, InsertInvoice, InsertInvoiceItem } from "@shared/schema";
import { platforms, itemTypes } from "@shared/schema";
import { format } from "@/lib/date";
import { subDays, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { SiFacebook, SiGoogle, SiLinkedin, SiYoutube } from "react-icons/si";

const platformIcons: Record<string, typeof SiFacebook> = {
  Facebook: SiFacebook,
  Google: SiGoogle,
  LinkedIn: SiLinkedin,
  YouTube: SiYoutube,
};

interface AdditionalItem {
  id: string;
  itemType: string;
  description: string;
  amount: number;
  actualCost: number;
}

export default function InvoiceCreatePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<Date>(new Date());
  const [periodStart, setPeriodStart] = useState<Date>(subDays(new Date(), 6));
  const [periodEnd, setPeriodEnd] = useState<Date>(new Date());
  const [selectedAdCostIds, setSelectedAdCostIds] = useState<Set<string>>(new Set());
  const [additionalItems, setAdditionalItems] = useState<AdditionalItem[]>([]);
  const [notes, setNotes] = useState("");

  const [fbDollarRate, setFbDollarRate] = useState(122);
  const [supplierDollarRate, setSupplierDollarRate] = useState(128);
  const [bkashFeePercent, setBkashFeePercent] = useState(1.8);
  const [includeBkashFee, setIncludeBkashFee] = useState(true);
  const [markupPercent, setMarkupPercent] = useState(20);
  const [vatPercent, setVatPercent] = useState(0);

  const [datePickerOpen, setDatePickerOpen] = useState<string | null>(null);

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: allAdCosts } = useQuery<AdCost[]>({
    queryKey: ["/api/ad-costs"],
  });

  const selectedClient = clients?.find((c) => c.id === selectedClientId);

  // DEBUGGING: Capture why costs are being filtered
  const debugInfo = useMemo(() => {
    if (!allAdCosts) return "Loading...";
    if (!selectedClientId) return "No client selected";

    const startDate = format(periodStart, "yyyy-MM-dd");
    const endDate = format(periodEnd, "yyyy-MM-dd");

    const logs = allAdCosts.map(cost => {
      if (cost.clientId !== selectedClientId) return null; // Ignore other clients
      const costDate = cost.date;
      const isDateMatch = costDate >= startDate && costDate <= endDate;
      const isInvoiced = cost.invoiced;

      const status = (!isInvoiced && isDateMatch) ? "MATCH" : "REJECTED";
      const reason = isInvoiced ? "Invoiced" : (!isDateMatch ? `Date Mismatch (${costDate} vs ${startDate}-${endDate})` : "OK");

      return {
        id: cost.id.substr(0, 4),
        date: costDate,
        invoiced: isInvoiced,
        status,
        reason
      };
    }).filter(Boolean); // Filter out nulls (other clients)

    return {
      period: `${startDate} to ${endDate}`,
      totalRelevantCosts: logs.length,
      costs: logs
    };
  }, [allAdCosts, selectedClientId, periodStart, periodEnd]);

  const availableAdCosts = useMemo(() => {
    if (!allAdCosts || !selectedClientId) return [];
    // Filter ad costs based on selected client and date range
    return allAdCosts.filter((cost) => {
      if (cost.clientId !== selectedClientId) return false;
      if (cost.invoiced) return false;

      // Strict date filtering
      if (!periodStart || !periodEnd) return false;

      // Normalize filtering by comparing "YYYY-MM-DD" strings to avoid timezone/time issues
      const costDate = cost.date; // already YYYY-MM-DD from DB
      // Use our fixed timezone-aware format for start/end
      const startDate = format(periodStart, "yyyy-MM-dd");
      const endDate = format(periodEnd, "yyyy-MM-dd");

      return costDate >= startDate && costDate <= endDate;
    });
  }, [allAdCosts, selectedClientId, periodStart, periodEnd]);

  const selectedAdCosts = availableAdCosts.filter((c) => selectedAdCostIds.has(c.id));
  const totalAdSpend = selectedAdCosts.reduce((sum, c) => sum + c.spendBdt, 0);
  const totalAdditionalItems = additionalItems.reduce((sum, item) => sum + item.amount, 0);
  const totalAdditionalActualCost = additionalItems.reduce((sum, item) => sum + (item.actualCost || 0), 0);

  const adCostWithMarkup = totalAdSpend * (1 + markupPercent / 100);
  const subtotal = adCostWithMarkup + totalAdditionalItems;
  const vatAmount = subtotal * (vatPercent / 100);
  const bkashFee = includeBkashFee ? subtotal * (bkashFeePercent / 100) : 0;
  const totalAmount = subtotal + vatAmount + (includeBkashFee ? bkashFee : 0);

  const usdSpend = totalAdSpend / fbDollarRate;
  const supplierPayment = usdSpend * supplierDollarRate;

  // Profit = Total Invoiced - (Total Out to Ad Supplier + Total Out to Other Vendors + Non-Reimbursable Fees)
  // Assuming Customer Pays Fees: We include fee in invoice, so we get paid back.
  // Net Profit = (PaymentFromClient) - (PmtToFB/Supplier) - (PmtToVendors/Staff) - (bKashFeeCost)
  const netProfit = totalAmount - supplierPayment - totalAdditionalActualCost - bkashFee;

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedAdCostIds(new Set());
    const client = clients?.find((c) => c.id === clientId);
    if (client) {
      setMarkupPercent(client.defaultMarkupPercent);
      setVatPercent(client.defaultVatPercent || 0);
    }
  };

  const toggleAdCost = (id: string) => {
    const newSet = new Set(selectedAdCostIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedAdCostIds(newSet);
  };

  const selectAllAdCosts = () => {
    if (selectedAdCostIds.size === availableAdCosts.length) {
      setSelectedAdCostIds(new Set());
    } else {
      setSelectedAdCostIds(new Set(availableAdCosts.map((c) => c.id)));
    }
  };

  const addAdditionalItem = () => {
    setAdditionalItems([
      ...additionalItems,
      { id: crypto.randomUUID(), itemType: "Salary", description: "", amount: 0, actualCost: 0 },
    ]);
  };

  const updateAdditionalItem = (id: string, field: keyof AdditionalItem, value: any) => {
    setAdditionalItems(
      additionalItems.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          // Smart Defaults Logic
          if (field === 'itemType') {
            if (value === 'Salary') {
              updated.actualCost = 0; // Salary is usually pure profit (unless you outsource)
            } else {
              // For bills/misc, assume cost = amount (no profit) initially
              updated.actualCost = updated.amount;
            }
          }
          // If amount changes and it's NOT salary, update cost to match (convenience)
          // Only if they haven't manually decoupled them? simpler to just leave it manual or sync for non-salary
          if (field === 'amount' && item.itemType !== 'Salary' && item.actualCost === item.amount) {
            updated.actualCost = value;
          }

          return updated;
        }
        return item;
      })
    );
  };

  const removeAdditionalItem = (id: string) => {
    setAdditionalItems(additionalItems.filter((item) => item.id !== id));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const invoiceNumber = `INV-${format(new Date(), "yyyyMMdd")}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      const invoiceData: InsertInvoice = {
        invoiceNumber,
        clientId: selectedClientId,
        invoiceDate: format(invoiceDate, "yyyy-MM-dd"),
        periodStart: format(periodStart, "yyyy-MM-dd"),
        periodEnd: format(periodEnd, "yyyy-MM-dd"),
        status: "Pending",
        fbDollarRate,
        supplierDollarRate,
        bkashFeePercent,
        includeBkashFee,
        markupPercent,
        vatPercent,
        notes,
      };

      const items: Omit<InsertInvoiceItem, "invoiceId">[] = [];

      selectedAdCosts.forEach((cost) => {
        items.push({
          itemType: "AdCost",
          description: `${cost.platform} Ad - ${cost.campaignName || "Campaign"}`,
          platform: cost.platform,
          date: cost.date,
          adCostId: cost.id,
          actualCost: cost.spendBdt,
          amount: cost.spendBdt * (1 + markupPercent / 100),
        });
      });

      additionalItems.forEach((item) => {
        // Use description or fallback to Item Type, so we don't skip valid costs just because of empty desc
        const finalDescription = item.description || item.itemType;

        if (item.amount > 0) {
          items.push({
            itemType: item.itemType,
            description: finalDescription,
            actualCost: item.actualCost || 0,
            amount: item.amount,
          });
        }
      });

      return apiRequest("POST", "/api/invoices", {
        invoice: invoiceData,
        items,
        adCostIds: Array.from(selectedAdCostIds),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ad-costs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({
        title: "Invoice created",
        description: "The invoice has been generated successfully.",
      });
      navigate(`/invoices/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const PlatformIcon = ({ platform }: { platform: string }) => {
    const Icon = platformIcons[platform];
    if (Icon) return <Icon className="h-4 w-4" />;
    return null;
  };

  const canCreate =
    selectedClientId && (selectedAdCostIds.size > 0 || additionalItems.some((i) => i.amount > 0));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/invoices")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">
            Create Invoice
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate a new invoice for your client
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client *</Label>
                  <Select value={selectedClientId} onValueChange={handleClientChange}>
                    <SelectTrigger data-testid="select-client">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Invoice Date</Label>
                  <Popover
                    open={datePickerOpen === "invoice"}
                    onOpenChange={(open) => setDatePickerOpen(open ? "invoice" : null)}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="button-invoice-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(invoiceDate, "MMM d, yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={invoiceDate}
                        onSelect={(date) => {
                          if (date) {
                            setInvoiceDate(date);
                            setDatePickerOpen(null);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Period Start</Label>
                  <Popover
                    open={datePickerOpen === "start"}
                    onOpenChange={(open) => setDatePickerOpen(open ? "start" : null)}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="button-period-start"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(periodStart, "MMM d, yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={periodStart}
                        onSelect={(date) => {
                          if (date) {
                            setPeriodStart(date);
                            setDatePickerOpen(null);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Period End</Label>
                  <Popover
                    open={datePickerOpen === "end"}
                    onOpenChange={(open) => setDatePickerOpen(open ? "end" : null)}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="button-period-end"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(periodEnd, "MMM d, yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={periodEnd}
                        onSelect={(date) => {
                          if (date) {
                            setPeriodEnd(date);
                            setDatePickerOpen(null);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPeriodStart(subDays(new Date(), 2));
                    setPeriodEnd(new Date());
                  }}
                >
                  Last 3 Days
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPeriodStart(subDays(new Date(), 3));
                    setPeriodEnd(new Date());
                  }}
                >
                  Last 4 Days
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPeriodStart(subDays(new Date(), 6));
                    setPeriodEnd(new Date());
                  }}
                >
                  Last 7 Days
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPeriodStart(startOfMonth(new Date()));
                    setPeriodEnd(endOfMonth(new Date()));
                  }}
                >
                  This Month
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">Ad Costs</CardTitle>
              {availableAdCosts.length > 0 && (
                <Button variant="outline" size="sm" onClick={selectAllAdCosts}>
                  {selectedAdCostIds.size === availableAdCosts.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!selectedClientId ? (
                <div className="text-center py-8 text-muted-foreground">
                  Please select a client first
                </div>
              ) : availableAdCosts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No uninvoiced ad costs found for this period
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead className="text-xs uppercase">Date</TableHead>
                        <TableHead className="text-xs uppercase">Platform</TableHead>
                        <TableHead className="text-xs uppercase">Campaign</TableHead>
                        <TableHead className="text-xs uppercase text-right">Spend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {availableAdCosts.map((cost) => (
                        <TableRow key={cost.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedAdCostIds.has(cost.id)}
                              onCheckedChange={() => toggleAdCost(cost.id)}
                              data-testid={`checkbox-ad-cost-${cost.id}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(cost.date), "MMM d")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <PlatformIcon platform={cost.platform} />
                              <span>{cost.platform}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate">
                            {cost.campaignName || "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(cost.spendBdt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">Additional Items</CardTitle>
              <Button variant="outline" size="sm" onClick={addAdditionalItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
              {additionalItems.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  Add salary, adjustments, or other charges
                </div>
              ) : (
                <div className="space-y-3">
                  {additionalItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-3">
                      <Select
                        value={item.itemType}
                        onValueChange={(v) => updateAdditionalItem(item.id, "itemType", v)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Salary">Salary</SelectItem>
                          <SelectItem value="Adjustment">Adjustment</SelectItem>
                          <SelectItem value="PreviousDue">Previous Due</SelectItem>
                          <SelectItem value="Misc">Misc</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) =>
                          updateAdditionalItem(item.id, "description", e.target.value)
                        }
                        className="flex-1"
                      />

                      {/* Our Cost Field */}
                      <div className="relative w-[120px]">
                        <span className="absolute left-3 -top-2 bg-white px-1 text-[10px] text-muted-foreground">
                          Our Cost
                        </span>
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          ৳
                        </span>
                        <Input
                          type="number"
                          min={0}
                          value={item.actualCost || 0}
                          onChange={(e) =>
                            updateAdditionalItem(
                              item.id,
                              "actualCost", // Update Our Cost
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="pl-8 font-mono"
                        />
                      </div>

                      {/* Billed Amount Field */}
                      <div className="relative w-[120px]">
                        <span className="absolute left-3 -top-2 bg-white px-1 text-[10px] text-muted-foreground">
                          Bill Client
                        </span>
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          ৳
                        </span>
                        <Input
                          type="number"
                          min={0}
                          value={item.amount}
                          onChange={(e) =>
                            updateAdditionalItem(
                              item.id,
                              "amount",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="pl-8 font-mono"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAdditionalItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add notes for this invoice..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                data-testid="input-notes"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Rate Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>FB Dollar Rate ($1 = ৳)</Label>
                <Input
                  type="number"
                  min={1}
                  value={fbDollarRate}
                  onChange={(e) => setFbDollarRate(parseFloat(e.target.value) || 122)}
                  className="font-mono"
                  data-testid="input-fb-rate"
                />
              </div>
              <div className="space-y-2">
                <Label>Supplier Dollar Rate ($1 = ৳)</Label>
                <Input
                  type="number"
                  min={1}
                  value={supplierDollarRate}
                  onChange={(e) => setSupplierDollarRate(parseFloat(e.target.value) || 128)}
                  className="font-mono"
                  data-testid="input-supplier-rate"
                />
              </div>
              <div className="space-y-2">
                <Label>bKash Fee %</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={bkashFeePercent}
                    onChange={(e) => setBkashFeePercent(parseFloat(e.target.value) || 1.8)}
                    className="font-mono flex-1"
                    data-testid="input-bkash-fee"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox
                    id="includeBkashFee"
                    checked={includeBkashFee}
                    onCheckedChange={(checked) => setIncludeBkashFee(!!checked)}
                  />
                  <label
                    htmlFor="includeBkashFee"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Charge fee to client?
                  </label>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Markup %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={markupPercent}
                  onChange={(e) => setMarkupPercent(parseFloat(e.target.value) || 0)}
                  className="font-mono"
                  data-testid="input-markup"
                />
              </div>
              <div className="space-y-2">
                <Label>VAT %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={vatPercent}
                  onChange={(e) => setVatPercent(parseFloat(e.target.value) || 0)}
                  className="font-mono"
                  data-testid="input-vat"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Invoice Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ad Costs ({selectedAdCostIds.size})</span>
                <span className="font-mono">{formatCurrency(totalAdSpend)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Markup ({markupPercent}%)
                </span>
                <span className="font-mono">
                  {formatCurrency(totalAdSpend * (markupPercent / 100))}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Additional Items</span>
                <span className="font-mono">{formatCurrency(totalAdditionalItems)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>
              {vatPercent > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">VAT ({vatPercent}%)</span>
                  <span className="font-mono">{formatCurrency(vatAmount)}</span>
                </div>
              )}
              {includeBkashFee && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">bKash Fee ({bkashFeePercent}%)</span>
                  <span className="font-mono">{formatCurrency(bkashFee)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="font-mono text-lg" data-testid="text-total">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profit Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">USD Spend</span>
                <span className="font-mono">${usdSpend.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Supplier Payment</span>
                <span className="font-mono">{formatCurrency(supplierPayment)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">bKash Fee</span>
                <span className="font-mono">{formatCurrency(bkashFee)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Net Profit</span>
                <span
                  className={cn(
                    "font-mono text-lg",
                    netProfit >= 0 ? "text-chart-2" : "text-destructive"
                  )}
                  data-testid="text-profit"
                >
                  {formatCurrency(netProfit)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            disabled={!canCreate || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            data-testid="button-create-invoice"
          >
            <FileText className="h-4 w-4 mr-2" />
            {createMutation.isPending ? "Creating..." : "Create Invoice"}
          </Button>

          {/* DEBUG SECTION - Remove after fixing */}
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
            <CardHeader>
              <CardTitle className="text-sm text-red-600">Debug Info (Temporary)</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs whitespace-pre-wrap font-mono">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
