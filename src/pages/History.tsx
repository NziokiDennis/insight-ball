import { PageWrapper } from "@/components/layout/PageWrapper";
import { useAuthStore } from "@/store/authStore";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Lock, Download } from "lucide-react";

export default function HistoryPage() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <PageWrapper className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="surface-panel p-8 text-center max-w-md space-y-4 animate-slide-up">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display font-bold text-2xl text-foreground">Prediction History</h1>
          <p className="text-muted-foreground text-sm">
            Sign in to save and track your predictions. Compare your forecast accuracy over time.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/login">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Login</Button>
            </Link>
            <Link to="/register">
              <Button variant="outline">Sign Up</Button>
            </Link>
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl text-foreground">Prediction History</h1>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Empty state */}
      <div className="surface-panel p-12 text-center space-y-3">
        <p className="text-muted-foreground">No predictions yet.</p>
        <p className="text-sm text-muted-foreground">
          Run a prediction from the <Link to="/" className="text-primary hover:underline">Calculator</Link> to start building your history.
        </p>
      </div>
    </PageWrapper>
  );
}
