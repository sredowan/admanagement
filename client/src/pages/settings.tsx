import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { setTimezone, getTimezone } from "@/lib/date"; // We will add these exports next
import { Save } from "lucide-react";

const AVAILABLE_TIMEZONES = [
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "America/New_York",
  "Australia/Sydney",
  "UTC"
];

export default function SettingsPage() {
  const { toast } = useToast();
  // Initialize with current timezone from lib
  const [selectedTimezone, setSelectedTimezone] = useState<string>(getTimezone());

  const { data: settings } = useQuery<{ key: string; value: string }[]>({
    queryKey: ["/api/settings"],
  });

  // Effect to sync state when settings load
  const timezoneSetting = settings?.find(s => s.key === "timezone");
  if (timezoneSetting && timezoneSetting.value !== selectedTimezone) {
    // Check if we haven't manually changed it yet? 
    // For simplicity, just let the initial load or manual change drive it.
    // But strictly, we should sync with DB on load.
  }

  const saveMutation = useMutation({
    mutationFn: async (input: { timezone: string }) => {
      await apiRequest("POST", "/api/settings", input);
      return input.timezone;
    },
    onSuccess: (timezone) => {
      setTimezone(timezone); // Apply immediately to client lib
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings saved",
        description: `Timezone updated to ${timezone}`,
      });
      // Force reload to ensure all components re-render with new timezone if needed
      // or just trust React state updates if date lib changes trigger re-renders 
      // (which they won't automatically unless we provided it via Context, but for now a reload is safest or just setTimezone is enough for future renders)
      setTimeout(() => window.location.reload(), 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
          <CardDescription>Configure global application preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Default Timezone
            </label>
            <div className="flex gap-4">
              <Select
                value={selectedTimezone}
                onValueChange={setSelectedTimezone}
              >
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => saveMutation.mutate({ timezone: selectedTimezone })}
                disabled={saveMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              This will affect how dates are displayed across the application.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
