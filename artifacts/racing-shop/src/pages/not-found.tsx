import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <AlertCircle className="w-16 h-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl font-display font-bold text-foreground">404</h1>
        <p className="mt-2 text-muted-foreground">Page not found.</p>
        <Link href="/" className="inline-block mt-6 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
