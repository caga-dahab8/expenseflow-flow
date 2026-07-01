import { createFileRoute } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { user } from "@/lib/mock-data";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "Profile — ExpenseFlow" }, { name: "description", content: "Manage your account information." }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <>
      <PageHeader title="Profile" description="Update your personal information and preferences." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-xl lg:col-span-1">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={user.avatar} />
                <AvatarFallback>AB</AvatarFallback>
              </Avatar>
              <Button size="icon" className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full">
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <div className="text-lg font-semibold">{user.name}</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
            </div>
            <div className="mt-2 grid w-full grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xl font-semibold">100</div>
                <div className="text-xs text-muted-foreground">Expenses</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xl font-semibold">8</div>
                <div className="text-xs text-muted-foreground">Categories</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Personal information</CardTitle></CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => { e.preventDefault(); toast.success("Profile updated"); }}
            >
              <div className="grid gap-2">
                <Label>Full name</Label>
                <Input defaultValue={user.name} />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input type="email" defaultValue={user.email} />
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input defaultValue={user.phone} />
              </div>
              <div className="grid gap-2">
                <Label>Currency</Label>
                <Select defaultValue={user.currency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["USD", "EUR", "GBP", "JPY", "INR", "CAD"].map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Language</Label>
                <Select defaultValue={user.language}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["English (US)", "English (UK)", "Français", "Deutsch", "Español", "日本語"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Timezone</Label>
                <Select defaultValue={user.timezone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["America/Los_Angeles", "America/New_York", "Europe/London", "Europe/Berlin", "Asia/Tokyo"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit">Save changes</Button>
              </div>
            </form>

            <Separator className="my-6" />

            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold">Change password</div>
                <p className="text-xs text-muted-foreground">Use at least 12 characters, mixing letters and numbers.</p>
              </div>
              <form
                className="grid gap-3 sm:grid-cols-3"
                onSubmit={(e) => { e.preventDefault(); toast.success("Password updated"); }}
              >
                <Input type="password" placeholder="Current password" />
                <Input type="password" placeholder="New password" />
                <Input type="password" placeholder="Confirm password" />
                <div className="sm:col-span-3 flex justify-end">
                  <Button type="submit" variant="outline">Update password</Button>
                </div>
              </form>
            </div>

            <Separator className="my-6" />

            <div className="space-y-4">
              <div className="text-sm font-semibold">Notifications</div>
              {[
                { label: "Email notifications", desc: "Weekly reports and monthly digests" },
                { label: "Budget alerts", desc: "Get notified when you cross 80% of any budget" },
                { label: "Product updates", desc: "New features and improvements" },
              ].map((n, i) => (
                <div key={n.label} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{n.label}</div>
                    <div className="text-xs text-muted-foreground">{n.desc}</div>
                  </div>
                  <Switch defaultChecked={i < 2} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
