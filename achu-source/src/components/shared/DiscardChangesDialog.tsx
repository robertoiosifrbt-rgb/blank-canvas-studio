import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Sesiunea 29 (backlog 46) — shown by `useUnsavedGuard` when a dialog with edits
 * is about to close.
 *
 * "Keep editing" is the Cancel (and therefore the default / Escape) action on
 * purpose: the destructive option must never be the easy one. Someone who
 * reached this prompt by mis-clicking a backdrop wants to get back to their
 * work, not lose it faster.
 */
export default function DiscardChangesDialog({ open, onDiscard, onKeepEditing }: {
  open: boolean;
  onDiscard: () => void;
  onKeepEditing: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={v => !v && onKeepEditing()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have edits on this form that have not been saved. Closing now will lose them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onKeepEditing}>Keep editing</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDiscard}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Discard changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

