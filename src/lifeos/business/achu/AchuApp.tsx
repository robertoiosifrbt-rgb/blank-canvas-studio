import { ArrowLeft, ExternalLink } from 'lucide-react';

type AchuAppProps = { onBack: () => void };

export function AchuApp({ onBack }: AchuAppProps) {
  const source = '/achu-copy/?lifeos=1';

  return (
    <div className="-m-3 min-h-[calc(100vh-9rem)] overflow-hidden bg-white sm:-m-6 lg:-m-8">
      <div className="flex h-12 items-center gap-3 border-b border-slate-200 bg-white px-3">
        <button onClick={onBack} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950">
          <ArrowLeft size={17} /> Business
        </button>
        <span className="text-sm font-bold text-slate-900">ACHU</span>
        <a href={source} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900">
          Open full screen <ExternalLink size={14} />
        </a>
      </div>
      <iframe title="ACHU Business Hub" src={source} className="h-[calc(100vh-12rem)] w-full border-0 bg-white" />
    </div>
  );
}
