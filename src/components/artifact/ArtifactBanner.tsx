import { Eye, Code2 } from 'lucide-react';
import type { ArtifactBlock } from '../../lib/artifact/extractor';

interface ArtifactBannerProps {
  artifact: ArtifactBlock;
  onPreview: (artifact: ArtifactBlock) => void;
}

export function ArtifactBanner({ artifact, onPreview }: ArtifactBannerProps) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        onClick={() => onPreview(artifact)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/15 
          hover:bg-primary/10 hover:border-primary/25 transition-all duration-200 group btn-press"
      >
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
          <Eye size={14} className="text-primary" />
        </div>
        <div className="text-left">
          <div className="text-xs font-medium text-primary">
            {artifact.title || 'Website Preview'}
          </div>
          <div className="text-[10px] text-text-dim">Klik untuk lihat preview</div>
        </div>
        <Code2 size={12} className="text-text-dim ml-1" />
      </button>
    </div>
  );
}
