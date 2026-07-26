import { Button } from '@/components/ui/button';
import { ShieldX } from 'lucide-react';

export default function AccessDenied({ message, onLogout }: { message: string; onLogout: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="text-center max-w-sm">
        <ShieldX className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">{message}</p>
        <Button variant="outline" onClick={onLogout}>Sign Out</Button>
      </div>
    </div>
  );
}
