import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';

/**
 * Sesiunea 26 (ACHU-196) — owner request: "vreau sa am preview inainte de
 * download". Renders a generated PDF in an iframe with a Download button,
 * so nothing lands in the Downloads folder unless the user actually wants it.
 *
 * `build` is called when the dialog opens and must return an object URL for
 * the PDF (the generators' 'preview' output mode). The URL is revoked when
 * the dialog closes, so previewing repeatedly doesn't leak blobs.
 */
export default function PdfPreviewDialog({
  open, onClose, title, filename, build,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  filename: string;
  build: () => Promise<string>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  useEffect(() => {
    if (!open) return;
    let revoked = false;
    let created: string | null = null;
    setUrl(null);
    setError(null);
    build()
      .then(u => {
        if (revoked) { URL.revokeObjectURL(u); return; }
        created = u;
        setUrl(u);
        // On mobile, open in a new tab immediately so the native PDF viewer handles it
        if (isMobile) window.open(u, '_blank');
      })
      .catch(() => setError('Could not generate the PDF preview.'));
    return () => {
      revoked = true;
      if (created) URL.revokeObjectURL(created);
    };
    // `build` is recreated on each render by callers; keying off `open` alone
    // is deliberate — the preview should be built once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isMobile]);

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !url ? (
            <div className="h-[70vh] flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />Generating preview…
            </div>
          ) : isMobile ? (
            <p className="text-sm text-muted-foreground">PDF opened in a new tab. You can download or view it in your device's PDF viewer.</p>
          ) : (
            <iframe src={url} title={title} className="w-full h-[70vh] rounded-lg border border-border" />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={handleDownload} disabled={!url}>
              <Download className="h-4 w-4 mr-1.5" />Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

