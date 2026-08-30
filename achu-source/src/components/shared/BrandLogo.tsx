import logoIcon from '@/assets/logo-icon.png';
// Sesiunea 26 (ACHU-193, decizie owner): the square icon (A stacked above
// "ACHU LTD") is the one to use everywhere — "peste tot foloseste varianta
// patrata... numai in cazuri extreme folosesti [logo-wide]". No such extreme
// case exists in this app today, so both variants below point at the same
// square asset; logo-wide.png is kept unreferenced, not deleted, in case a
// genuinely too-wide-for-square spot ever comes up.
const LOGO_URL = logoIcon;
const ICON_URL = logoIcon;

export function BrandLogo({ subtitle, compact }: { subtitle?: string; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src={compact ? ICON_URL : LOGO_URL} alt="ACHU LTD" className={compact ? 'h-8 w-8 rounded object-contain' : 'h-8 object-contain'} />
      {subtitle && <span className="text-xs text-muted-foreground font-medium hidden sm:inline">{subtitle}</span>}
    </div>
  );
}

