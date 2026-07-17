// src/components/artifact/FileTree.tsx — File tree sidebar for artifact preview
import { useState, useMemo, useCallback } from 'react';
import { Folder, FolderOpen, File, FileCode, FileJson, FileImage, FileText, ChevronRight, ChevronDown } from 'lucide-react';
import type { ArtifactFile } from '../../lib/artifact/extractor';

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children: TreeNode[];
  file?: ArtifactFile;
}

interface FileTreeProps {
  files: ArtifactFile[];
  activeFile: number;
  onFileSelect: (index: number) => void;
}

function getFileIcon(path: string) {
  const fileName = path.split('/').pop()?.toLowerCase() || '';
  if (fileName === 'index.html') return <FileCode size={15} className="text-[#e37933]" />;
  if (fileName === 'style.css') return <FileCode size={15} className="text-[#519aba]" />;
  if (fileName === 'script.js') return <FileCode size={15} className="text-[#cbcb41]" />;
  
  const ext = fileName.split('.').pop();
  switch (ext) {
    case 'html': case 'htm': return <FileCode size={15} className="text-[#e37933]" />;
    case 'css': case 'scss': case 'less': return <FileCode size={15} className="text-[#519aba]" />;
    case 'js': case 'jsx': case 'mjs': return <FileCode size={15} className="text-[#cbcb41]" />;
    case 'ts': case 'tsx': return <FileCode size={15} className="text-[#3178c6]" />;
    case 'json': return <FileJson size={15} className="text-[#cbcb41]" />;
    case 'svg': case 'png': case 'jpg': case 'ico': return <FileImage size={15} className="text-[#89ba5a]" />;
    case 'md': return <FileText size={15} className="text-[#519aba]" />;
    default: return <File size={15} className="text-text-dim" />;
  }
}

function buildTree(files: ArtifactFile[]): TreeNode {
  const root: TreeNode = {
    name: '/',
    path: '',
    type: 'folder',
    children: [],
  };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const parts = file.path.split('/');
    let current = root;

    for (let j = 0; j < parts.length; j++) {
      const part = parts[j];
      const isLast = j === parts.length - 1;
      const childPath = parts.slice(0, j + 1).join('/');

      if (isLast) {
        // File node
        current.children.push({
          name: part,
          path: childPath,
          type: 'file',
          children: [],
          file,
        });
      } else {
        // Folder node — find or create
        let folder = current.children.find(c => c.type === 'folder' && c.name === part);
        if (!folder) {
          folder = {
            name: part,
            path: childPath,
            type: 'folder',
            children: [],
          };
          current.children.push(folder);
        }
        current = folder;
      }
    }
  }

  return root;
}

interface FolderItemProps {
  node: TreeNode;
  depth: number;
  activeFilePath?: string;
  onFileSelect: (file: ArtifactFile) => void;
  defaultOpen?: boolean;
}

function FolderItem({ node, depth, activeFilePath, onFileSelect, defaultOpen }: FolderItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen ?? depth < 1);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  if (node.type === 'file' && node.file) {
    const isActive = activeFilePath === node.path;
    return (
      <button
        onClick={() => onFileSelect(node.file!)}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-colors text-left ${
          isActive
            ? 'bg-primary/15 text-primary font-medium'
            : 'text-text-dim hover:text-text hover:bg-bg-alt'
        }`}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        title={node.path}
      >
        {getFileIcon(node.path, false)}
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  // Sorted: folders first, then files, both alphabetical
  const sortedChildren = [...node.children].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      <button
        onClick={toggle}
        className="w-full flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors text-text-dim hover:text-text hover:bg-bg-alt text-left"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {isOpen ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
        {isOpen ? <FolderOpen size={15} className="shrink-0 text-[#e2b714]" /> : <Folder size={15} className="shrink-0 text-[#e2b714]" />}
        <span className="truncate font-medium">{node.name}</span>
      </button>
      {isOpen && (
        <div>
          {sortedChildren.map((child) => (
            <FolderItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFilePath={activeFilePath}
              onFileSelect={onFileSelect}
              defaultOpen={depth < 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ files, activeFile, onFileSelect }: FileTreeProps) {
  const tree = useMemo(() => buildTree(files), [files]);
  const activeFilePath = files[activeFile]?.path;

  const handleFileSelect = useCallback((file: ArtifactFile) => {
    const idx = files.findIndex(f => f.path === file.path);
    if (idx >= 0) onFileSelect(idx);
  }, [files, onFileSelect]);

  if (files.length === 0) return null;

  return (
    <div className="w-52 shrink-0 bg-[#252526] border-r border-[#313131] overflow-y-auto overflow-x-hidden">
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-dim border-b border-[#313131]">
        File Explorer
      </div>
      <div className="py-1 space-y-0.5">
        {tree.children
          .sort((a, b) => {
            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
            return a.name.localeCompare(b.name);
          })
          .map((child) => (
            <FolderItem
              key={child.path}
              node={child}
              depth={0}
              activeFilePath={activeFilePath}
              onFileSelect={handleFileSelect}
            />
          ))}
      </div>
    </div>
  );
}
