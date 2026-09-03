import { Toaster as Sonner } from 'sonner';
import { useIsNarrow } from '@/lib/useIsNarrow';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * ACHU-501 (Sesiunea 108) — reported by Roberto from his phone, in the same
 * message as ACHU-500: *"notifications cover the button"*.
 *
 * 🔴 **On a phone the toast is not beside the button — it is ON it.** Sonner's
 * default position is bottom-right, and on a narrow screen it stretches to the full
 * width at the bottom. Every dialog and form in this app puts its action button at
 * the bottom, so a message about what just failed lands exactly on the control you
 * press to try again. The photograph shows a blue button behind "This job cannot be
 * completed before its scheduled start time."
 *
 * ⚠️ **Worst on the messages that matter most.** A success toast is ignorable; a
 * REFUSAL is the one after which somebody immediately reaches for the button — and
 * that is the one covering it. It reads as the app having frozen.
 *
 * ✅ **Moved to the top on narrow screens only.** Desktop keeps bottom-right, where
 * nothing sits underneath and where the people using this app every day are used to
 * finding it — fixing a phone problem by moving things on a screen that never had
 * it would be a second change nobody asked for.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const narrow = useIsNarrow();
  return (
    <Sonner
      theme="system"
      className="toaster group"
      position={narrow ? 'top-center' : 'bottom-right'}
      {...props}
    />
  );
};

export { Toaster };

