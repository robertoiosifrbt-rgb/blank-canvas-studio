const LOGO_URL = 'https://images.fillout.com/orgid-765610/flowpublicid-account/widgetid-branding-kit-logo/33wjDsan9kfmpdJpgKTDTK/logo-primary.jpeg';
const ICON_URL = 'https://images.fillout.com/orgid-765610/flowpublicid-account/widgetid-branding-kit-logo/9haBjayXuoLd9p1v4tcmMD/logo-icon.jpeg';

export function BrandLogo({ subtitle, compact }: { subtitle?: string; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src={compact ? ICON_URL : LOGO_URL} alt="ACHU LTD" className={compact ? 'h-8 w-8 rounded object-contain' : 'h-8 object-contain'} />
      {subtitle && <span className="text-xs text-muted-foreground font-medium hidden sm:inline">{subtitle}</span>}
    </div>
  );
}
