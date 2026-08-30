import { Camera, Upload, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CaptureStep({ onCapture, onUpload, error }: { onCapture: () => void; onUpload: () => void; error: string }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Take a photo of a receipt or invoice, or upload an existing file. Data will be extracted automatically.</p>
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={onCapture} size="lg" className="h-24 flex-col gap-2">
          <Camera className="h-8 w-8" /><span>Take Photo</span>
        </Button>
        <Button onClick={onUpload} variant="outline" size="lg" className="h-24 flex-col gap-2">
          <Upload className="h-8 w-8" /><span>Upload File</span>
        </Button>
      </div>
      <div className="flex items-center gap-2 justify-center">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <p className="text-xs text-muted-foreground">AI will automatically extract details from your document</p>
      </div>
      <p className="text-xs text-muted-foreground text-center">Supports: JPG, PNG, WEBP, PDF • Max 14 MB (PDF) / 20 MB (images)</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

