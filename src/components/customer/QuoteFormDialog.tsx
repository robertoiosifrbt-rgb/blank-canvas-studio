import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { FilloutPopupEmbed } from '@fillout/react';

interface PrefillData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  postcode?: string;
}

interface QuoteFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  prefill: PrefillData;
}

function buildParameters(prefill: PrefillData): Record<string, string> {
  const params: Record<string, string> = {};
  if (prefill.name) params.fullName = prefill.name;
  if (prefill.email) params.email = prefill.email;
  if (prefill.phone) params.phone = prefill.phone;
  if (prefill.address) params.address = prefill.address;
  if (prefill.postcode) params.postcode = prefill.postcode;
  return params;
}

export default function QuoteFormDialog({ open, onClose, onSubmitted, prefill }: QuoteFormDialogProps) {
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) setSubmitted(false);
  }, [open]);

  const handleDone = () => {
    onSubmitted();
  };

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={v => { if (!v) handleDone(); }}>
        <DialogContent className="max-w-md">
          <div className="text-center py-6 space-y-3">
            <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
            <h3 className="text-lg font-semibold">Quote Request Submitted</h3>
            <p className="text-sm text-muted-foreground">
              Your quote request has been received. It will appear in your Upcoming Jobs as an <span className="font-medium">Enquiry</span> once processed.
            </p>
            <p className="text-xs text-muted-foreground">ACHU will review your request and get back to you shortly.</p>
            <Button onClick={handleDone} className="w-full">Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <FilloutPopupEmbed
      filloutId="eN9RNUyGAJus"
      isOpen={open}
      onClose={onClose}
      parameters={buildParameters(prefill)}
      onSubmit={() => setSubmitted(true)}
    />
  );
}
