import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2, UserPlus } from "lucide-react";
import { z } from "zod";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser, useRegister } from "@/lib/auth";

const registerForm = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(100),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters.").max(128),
  currency: z.string().length(3),
  timezone: z.string().min(1),
});
type RegisterInput = z.infer<typeof registerForm>;

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Create account — ExpenseFlow" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const register = useRegister();
  const timezone =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerForm),
    defaultValues: { name: "", email: "", password: "", currency: "USD", timezone },
  });

  useEffect(() => {
    if (currentUser.data) void navigate({ to: "/" });
  }, [currentUser.data, navigate]);

  async function submit(input: RegisterInput) {
    try {
      await register.mutateAsync(input);
      await navigate({ to: "/" });
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Registration failed.",
      });
    }
  }

  return (
    <AuthShell>
      <Card className="border-border/60 shadow-xl shadow-primary/5">
        <CardHeader className="space-y-2">
          <CardTitle className="font-display text-2xl">Create your account</CardTitle>
          <CardDescription>
            Start with a personal workspace and customize it as you grow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" placeholder="Suleiman Ahmed" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder="At least 10 characters"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {["USD", "EUR", "GBP", "KES", "TZS", "UGX"].map((value) => (
                            <SelectItem key={value} value={value}>
                              {value}
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
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {form.formState.errors.root && (
                <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
              )}
              <Button className="w-full" type="submit" disabled={register.isPending}>
                {register.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                Create account
              </Button>
            </form>
          </Form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
