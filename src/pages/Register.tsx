import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/authStore";
import { registerSchema, type RegisterFormData } from "@/utils/validation";
import ignitionLogo from "@/assets/ignition-logo.png";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");

    const result = registerSchema.safeParse({ email, username: username || undefined, password, confirmPassword });
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
      await register(email, password, username || undefined);
      navigate("/");
    } catch {
      setApiError("Registration failed. Please try again.");
    }
  };

  return (
    <PageWrapper className="flex items-center justify-center min-h-[70vh]">
      <div className="surface-panel p-8 w-full max-w-sm space-y-6 animate-slide-up">
        <div className="text-center space-y-2">
          <img src={ignitionLogo} alt="Ignition" className="h-10 w-10 rounded-lg mx-auto" />
          <h1 className="font-display font-bold text-2xl text-foreground">Create account</h1>
          <p className="text-sm text-muted-foreground">Start tracking your predictions</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-muted-foreground text-xs uppercase tracking-wider">Email</Label>
            <Input
              id="email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`bg-background ${errors.email ? "border-destructive" : "border-border"}`}
              autoComplete="email"
            />
            {errors.email && <p className="text-destructive text-xs">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="username" className="text-muted-foreground text-xs uppercase tracking-wider">Username (optional)</Label>
            <Input
              id="username" value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="prometheus"
              className="bg-background border-border"
              maxLength={30}
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-password" className="text-muted-foreground text-xs uppercase tracking-wider">Password</Label>
            <Input
              id="reg-password" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className={`bg-background ${errors.password ? "border-destructive" : "border-border"}`}
              autoComplete="new-password"
            />
            {errors.password && <p className="text-destructive text-xs">{errors.password}</p>}
            <p className="text-xs text-muted-foreground">Minimum 12 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-muted-foreground text-xs uppercase tracking-wider">Confirm Password</Label>
            <Input
              id="confirm-password" type="password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className={`bg-background ${errors.confirmPassword ? "border-destructive" : "border-border"}`}
              autoComplete="new-password"
            />
            {errors.confirmPassword && <p className="text-destructive text-xs">{errors.confirmPassword}</p>}
          </div>

          {apiError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{apiError}</div>
          )}

          <Button
            type="submit" disabled={isLoading}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-display font-semibold"
          >
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </PageWrapper>
  );
}
