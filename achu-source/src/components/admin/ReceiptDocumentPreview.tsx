import { Upload, RotateCcw, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DocumentPreview({ isPdf, fileName, fileUrl, filePreviewUrl, onRetake, onUpload }: {
  isPdf: boolean; fileName: string; fileUrl: string; filePreviewUrl: string;
  onRetake: () => void; onUpload: () => void;
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-muted/20">
      {isPdf ? (
        <div className="flex items-center justify-center p-6 gap-2">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{fileName}</p>
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View PDF</a>
          </div>
        </div>
      ) : filePreviewUrl ? (
        <img src={filePreviewUrl} alt="Document" className="w-full max-h-48 object-contain" />
      ) : fileUrl ? (
        <img src={fileUrl} alt="Document" className="w-full max-h-48 object-contain" />
      ) : null}
      <div className="flex gap-2 p-2 border-t border-border">
        <Button variant="ghost" size="sm" onClick={onRetake}><RotateCcw className="h-3.5 w-3.5 mr-1" />Retake</Button>
        <Button variant="ghost" size="sm" onClick={onUpload}><Upload className="h-3.5 w-3.5 mr-1" />Replace</Button>
      </div>
    </div>
  );
}

