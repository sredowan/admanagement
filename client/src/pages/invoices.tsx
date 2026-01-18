import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Plus,
  Search,
  FileText,
  Eye,
  Trash2,
} from "lucide-react";
import type { Invoice, Client } from "@shared/schema";
import { format } from "@/lib/date";

export default function InvoicesPage() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const { toast } = useToast();

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({
        title: "Invoice deleted",
        description: "The invoice has been removed.",
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

  const filteredInvoices = invoices?.filter((invoice) => {
    const matchesClient = selectedClient === "all" || invoice.clientId === selectedClient;
    const matchesStatus = selectedStatus === "all" || invoice.status === selectedStatus;
    const matchesSearch =
      !searchQuery ||
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClient && matchesStatus && matchesSearch;
  });

  const getClientName = (clientId: string) => {
    return clients?.find((c) => c.id === clientId)?.companyName || "Unknown";
  };

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
      <Badge variant={variants[status] || "secondary"} className="text-xs">
        {status}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">
            Invoices
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and create invoices for your clients
          </p>
        </div>
        <Button asChild data-testid="button-create-invoice">
          <Link href="/invoices/new">
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoice number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-invoices"
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
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[150px]" data-testid="filter-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Partial">Partial</SelectItem>
                <SelectItem value="Overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
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
          ) : filteredInvoices && filteredInvoices.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase tracking-wider">
                      Invoice #
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">
                      Client
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">
                      Period
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">
                      Date
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-right">
                      Amount
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-right">
                      Due
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-center">
                      Status
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices
                    .sort(
                      (a, b) =>
                        new Date(b.invoiceDate).getTime() -
                        new Date(a.invoiceDate).getTime()
                    )
                    .map((invoice) => (
                      <TableRow
                        key={invoice.id}
                        data-testid={`row-invoice-${invoice.id}`}
                      >
                        <TableCell className="font-mono font-medium">
                          {invoice.invoiceNumber}
                        </TableCell>
                        <TableCell>{getClientName(invoice.clientId)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(invoice.periodStart), "MMM d")} -{" "}
                          {format(new Date(invoice.periodEnd), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(invoice.invoiceDate), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(invoice.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {invoice.dueAmount > 0 ? (
                            <span className="text-destructive">
                              {formatCurrency(invoice.dueAmount)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(invoice.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              data-testid={`button-view-invoice-${invoice.id}`}
                            >
                              <Link href={`/invoices/${invoice.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(invoice.id)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-invoice-${invoice.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-medium">No invoices found</h3>
              <p className="text-muted-foreground mt-1">
                {searchQuery || selectedClient !== "all" || selectedStatus !== "all"
                  ? "Try adjusting your filters"
                  : "Create your first invoice to get started"}
              </p>
              {!searchQuery && selectedClient === "all" && selectedStatus === "all" && (
                <Button className="mt-4" asChild>
                  <Link href="/invoices/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Invoice
                  </Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
