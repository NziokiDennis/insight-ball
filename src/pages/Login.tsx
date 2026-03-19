import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/authStore";
import { loginSchema, type LoginFormData } from "@/utils/validation";
import { LogIn, Flame } from "lucide-react";
import ignitionLogo from "@/assets/ignition-logo.png";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setApiError("Invalid email or password. Please try again.");
    }
  };

  return (
    <PageWrapper className="flex items-center justify-center min-h-[70vh]">
      <div className="surface-panel p-8 w-full max-w-sm space-y-6 animate-slide-up">
        <div className="text-center space-y-2">
          <img src={ignitionLogo} alt="Ignition" className="h-10 w-10 rounded-lg mx-auto" />
          <h1 className="font-display font-bold text-2xl text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in to your Ignition account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-muted-foreground text-xs uppercase tracking-wider">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`bg-background ${errors.email ? "border-destructive" : "border-border"}`}
              autoComplete="email"
            />
            {errors.email && <p className="text-destructive text-xs">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-muted-foreground text-xs uppercase tracking-wider">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className={`bg-background ${errors.password ? "border-destructive" : "border-border"}`}
              autoComplete="current-password"
            />
            {errors.password && <p className="text-destructive text-xs">{errors.password}</p>}
          </div>

          {apiError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{apiError}</div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-display font-semibold"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/register" className="text-primary hover:underline font-medium">Sign up</Link>
        </p>
      </div>
    </PageWrapper>
  );
}
