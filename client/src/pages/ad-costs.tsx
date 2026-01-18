import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  DollarSign,
  CalendarIcon,
  Trash2,
  Filter,
  Copy,
  Check,
} from "lucide-react";
import type { AdCost, Client } from "@shared/schema";
import { adCostFormSchema, platforms } from "@shared/schema";
import { format } from "@/lib/date";
import { startOfMonth, endOfMonth, subMonths, addDays } from "date-fns";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { SiFacebook, SiGoogle, SiLinkedin, SiYoutube } from "react-icons/si";

type AdCostFormData = z.infer<typeof adCostFormSchema>;

const platformIcons: Record<string, typeof SiFacebook> = {
  Facebook: SiFacebook,
  Google: SiGoogle,
  LinkedIn: SiLinkedin,
  YouTube: SiYoutube,
};

const platformColors: Record<string, string> = {
  Facebook: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Google: "bg-red-500/10 text-red-600 dark:text-red-400",
  LinkedIn: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  YouTube: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  Other: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

function AdCostForm({
  onSuccess,
  onCancel,
  clients,
  existingCampaigns = [],
  defaultValues,
}: {
  onSuccess: () => void;
  onCancel: () => void;
  clients: Client[];
  existingCampaigns?: string[];
  defaultValues?: Partial<AdCostFormData>;
}) {
  const { toast } = useToast();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [campaignSuggestionsOpen, setCampaignSuggestionsOpen] = useState(false);
  const [keepDetails, setKeepDetails] = useState(false);

  const form = useForm<AdCostFormData>({
    resolver: zodResolver(adCostFormSchema),
    defaultValues: {
      clientId: defaultValues?.clientId || "",
      date: defaultValues?.date || format(new Date(), "yyyy-MM-dd"),
      platform: defaultValues?.platform || "Facebook",
      campaignName: defaultValues?.campaignName || "",
      spendBdt: defaultValues?.spendBdt || 0,
    },
  });

  const watchClientId = form.watch("clientId");

  // Filter campaigns for the selected client
  // Note: We need adCosts to properly filter, but passing just names for now.
  // Ideally, we pass the full adCosts list to filter by ClientID dynamically. 
  // For now, let's assume specific client filtering happens helper side or generic suggestions.
  // Refined approach: Filter suggestions based on input? 
  // Let's rely on the passed existingCampaigns which should ideally be filtered or we filter here if we had the data.
  // To keep it simple and fast: We'll show all unique campaigns if no client selected, or client-specific if we had the map.
  // Constraint: We don't have the client map here. 
  // Decision: We will suggest ALL unique campaigns initially, user can pick.

  const mutation = useMutation({
    mutationFn: async (data: AdCostFormData) => {
      return apiRequest("POST", "/api/ad-costs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ad-costs"] });
      toast({
        title: "Ad cost added",
        description: "The ad cost entry has been saved.",
      });

      if (keepDetails) {
        // Prepare for next entry: same client, platform, campaign. Date + 1 day.
        const currentValues = form.getValues();
        const nextDate = addDays(new Date(currentValues.date), 1);
        form.setValue("date", format(nextDate, "yyyy-MM-dd"));
        // Keep amount? User said "more or less". Keeping it is easier to change than retyping zero.
      } else {
        onSuccess();
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AdCostFormData) => {
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
              <Select onValueChange={field.onChange} value={field.value}>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date *</FormLabel>
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
            name="platform"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Platform *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-platform">
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {platforms.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {platform}
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
          name="campaignName"
          render={({ field }) => (
            <FormItem className="flex flex-col relative">
              <FormLabel>Campaign Name</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    placeholder="e.g., Brand Awareness Q4"
                    {...field}
                    value={field.value || ""}
                    autoComplete="off"
                    onFocus={() => {
                      if (existingCampaigns.length > 0) setCampaignSuggestionsOpen(true);
                    }}
                    onBlur={() => {
                      // Allow time for click event on suggestion to fire
                      setTimeout(() => setCampaignSuggestionsOpen(false), 200);
                    }}
                    onChange={(e) => {
                      field.onChange(e);
                      if (existingCampaigns.length > 0) setCampaignSuggestionsOpen(true);
                    }}
                    data-testid="input-campaign-name"
                  />
                  {campaignSuggestionsOpen && existingCampaigns.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-popover text-popover-foreground rounded-md border shadow-md max-h-[200px] overflow-auto">
                      {existingCampaigns
                        .filter(c => c.toLowerCase().includes((field.value || "").toLowerCase()))
                        .slice(0, 5)
                        .map((campaign) => (
                          <div
                            key={campaign}
                            className={cn(
                              "flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground",
                              campaign === field.value && "bg-accent"
                            )}
                            onMouseDown={(e) => {
                              e.preventDefault(); // Prevent blur
                            }}
                            onClick={() => {
                              field.onChange(campaign);
                              setCampaignSuggestionsOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", campaign === field.value ? "opacity-100" : "opacity-0")} />
                            {campaign}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="spendBdt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Spend Amount (BDT) *</FormLabel>
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
                    data-testid="input-spend-amount"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center space-x-2 pb-2">
          <Checkbox
            id="keepDetails"
            checked={keepDetails}
            onCheckedChange={(c) => setKeepDetails(c === true)}
          />
          <label
            htmlFor="keepDetails"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Keep details for next entry (Date +1 day)
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Close
          </Button>
          <Button type="submit" disabled={mutation.isPending} data-testid="button-save-ad-cost">
            {mutation.isPending ? "Saving..." : (keepDetails ? "Save & Next" : "Save")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function AdCostsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<AdCostFormData> | undefined>(undefined);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });
  const { toast } = useToast();

  const { data: adCosts, isLoading } = useQuery<AdCost[]>({
    queryKey: ["/api/ad-costs"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/ad-costs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ad-costs"] });
      toast({
        title: "Ad cost deleted",
        description: "The entry has been removed.",
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

  // Extract unique campaign names for suggestions
  const uniqueCampaigns = useMemo(() => {
    if (!adCosts) return [];
    const campaigns = new Set<string>();
    adCosts.forEach(cost => {
      if (cost.campaignName) campaigns.add(cost.campaignName);
    });
    return Array.from(campaigns);
  }, [adCosts]);

  const handleDuplicate = (cost: AdCost) => {
    setFormData({
      clientId: cost.clientId,
      date: format(new Date(), "yyyy-MM-dd"), // Default duplicate to today
      platform: cost.platform as any,
      campaignName: cost.campaignName || "",
      spendBdt: cost.spendBdt
    });
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setFormData(undefined);
    setDialogOpen(true);
  };

  const filteredAdCosts = adCosts?.filter((cost) => {
    const costDate = new Date(cost.date);
    const matchesDate = costDate >= dateRange.start && costDate <= dateRange.end;
    const matchesClient = selectedClient === "all" || cost.clientId === selectedClient;
    const matchesPlatform = selectedPlatform === "all" || cost.platform === selectedPlatform;
    const matchesSearch =
      !searchQuery ||
      cost.campaignName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDate && matchesClient && matchesPlatform && matchesSearch;
  });

  const totalSpend = filteredAdCosts?.reduce((sum, cost) => sum + cost.spendBdt, 0) || 0;

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

  const PlatformIcon = ({ platform }: { platform: string }) => {
    const Icon = platformIcons[platform];
    if (Icon) {
      return <Icon className="h-4 w-4" />;
    }
    return <DollarSign className="h-4 w-4" />;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">
            Ad Costs
          </h1>
          <p className="text-muted-foreground mt-1">
            Track daily advertising spend across platforms
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-ad-cost" onClick={openNewDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Ad Cost
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{formData ? "Duplicate Ad Cost" : "Add Ad Cost Entry"}</DialogTitle>
            </DialogHeader>
            {clients && clients.length > 0 ? (
              <AdCostForm
                clients={clients}
                existingCampaigns={uniqueCampaigns}
                defaultValues={formData}
                onSuccess={() => setDialogOpen(false)}
                onCancel={() => setDialogOpen(false)}
              />
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground">
                  Please add a client first before entering ad costs.
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
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-campaigns"
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
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger className="w-[150px]" data-testid="filter-platform">
                  <SelectValue placeholder="All Platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  {platforms.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setDateRange({
                    start: startOfMonth(new Date()),
                    end: endOfMonth(new Date()),
                  })
                }
                data-testid="button-this-month"
              >
                This Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setDateRange({
                    start: startOfMonth(subMonths(new Date(), 1)),
                    end: endOfMonth(subMonths(new Date(), 1)),
                  })
                }
                data-testid="button-last-month"
              >
                Last Month
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Total:</span>
                <span className="font-mono font-semibold text-lg" data-testid="text-total-spend">
                  {formatCurrency(totalSpend)}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : filteredAdCosts && filteredAdCosts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase tracking-wider">Date</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Client</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Platform</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Campaign</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-right">
                      Spend
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
                  {filteredAdCosts
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((cost) => (
                      <TableRow key={cost.id} data-testid={`row-ad-cost-${cost.id}`}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(cost.date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>{getClientName(cost.clientId)}</TableCell>
                        <TableCell>
                          <div
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm",
                              platformColors[cost.platform] || platformColors.Other
                            )}
                          >
                            <PlatformIcon platform={cost.platform} />
                            <span>{cost.platform}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {cost.campaignName || "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(cost.spendBdt)}
                        </TableCell>
                        <TableCell className="text-center">
                          {cost.invoiced ? (
                            <Badge variant="secondary" className="text-xs">
                              Invoiced
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDuplicate(cost)}
                            title="Duplicate Entry"
                            className="mr-1"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(cost.id)}
                            disabled={deleteMutation.isPending || !!cost.invoiced}
                            data-testid={`button-delete-ad-cost-${cost.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-medium">No ad costs found</h3>
              <p className="text-muted-foreground mt-1">
                {searchQuery || selectedClient !== "all" || selectedPlatform !== "all"
                  ? "Try adjusting your filters"
                  : "Start tracking your ad spend"}
              </p>
              {!searchQuery && selectedClient === "all" && selectedPlatform === "all" && (
                <Button className="mt-4" onClick={openNewDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Ad Cost
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
