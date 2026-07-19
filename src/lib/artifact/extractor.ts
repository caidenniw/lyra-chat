// src/lib/artifact/extractor.ts — Extract artifact blocks from AI messages

export interface ArtifactFile {
  path: string;
  content: string;
}

export type FileAction = 'create' | 'update' | 'delete';

export interface ParsedFile extends ArtifactFile {
  action: FileAction;
  /** True if the file block was still being written (no closing marker yet) */
  partial?: boolean;
}

export interface ArtifactBlock {
  id: string;
  code: string;
  title?: string;
  files?: ArtifactFile[];
}

const ARTIFACT_START = '<!-- lyra-artifact';
const ARTIFACT_END = '<!-- /lyra-artifact -->';
const FILE_START = '<!-- lyra-file';
const FILE_END = '<!-- /lyra-file -->';

/**
 * Find a marker that sits at the START of a line (only whitespace before it).
 * Real markers are always emitted on their own line; models quoting the format
 * mid-sentence (e.g. in their thinking) must never be treated as real markers.
 */
function findLineStartMarker(content: string, marker: string, from = 0): number {
  let idx = content.indexOf(marker, from);
  while (idx !== -1) {
    const lineStart = content.lastIndexOf('\n', idx - 1) + 1;
    if (content.slice(lineStart, idx).trim() === '') return idx;
    idx = content.indexOf(marker, idx + 1);
  }
  return -1;
}

/** Parse attributes like path="..." action="..." from a marker tag. */
function parseAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

/** Normalize a file path: strip leading "./" and "/". */
export function normalizeFilePath(p: string): string {
  return p.replace(/^\.\//, '').replace(/^\//, '').trim();
}

/**
 * Strip a wrapping markdown code fence from file content.
 * Models sometimes wrap file bodies in ```html ... ``` despite instructions.
 */
function stripCodeFence(content: string): string {
  let result = content.trim();
  const fenceStart = result.match(/^```[a-zA-Z]*\s*\n/);
  if (fenceStart) {
    result = result.slice(fenceStart[0].length);
    // Remove trailing fence if present
    const trailing = result.match(/\n```\s*$/);
    if (trailing) {
      result = result.slice(0, result.length - trailing[0].length);
    }
  }
  return result.trim();
}

/**
 * Parse lyra-file blocks inside artifact code.
 * Tolerant: handles a trailing unterminated file block (marked partial).
 */
function parseFileBlocks(code: string, includePartial: boolean): ParsedFile[] {
  const files: ParsedFile[] = [];
  let searchFrom = 0;

  while (searchFrom < code.length) {
    const startIdx = findLineStartMarker(code, FILE_START, searchFrom);
    if (startIdx === -1) break;

    const startTagEnd = code.indexOf('-->', startIdx);
    if (startTagEnd === -1) break;
    const startTag = code.substring(startIdx, startTagEnd + 3);

    const attrs = parseAttrs(startTag);
    const filePath = normalizeFilePath(attrs.path || 'index.html');
    const action: FileAction =
      attrs.action === 'delete' ? 'delete' : attrs.action === 'update' ? 'update' : 'create';

    const contentStart = startTagEnd + 3;
    const endIdx = code.indexOf(FILE_END, contentStart);

    if (endIdx === -1) {
      // Unterminated file block — still streaming or truncated
      if (includePartial && action !== 'delete') {
        const partialContent = stripCodeFence(code.substring(contentStart));
        if (partialContent.length > 0) {
          files.push({ path: filePath, content: partialContent, action, partial: true });
        }
      }
      break;
    }

    const fileContent = stripCodeFence(code.substring(contentStart, endIdx));
    if (action === 'delete') {
      files.push({ path: filePath, content: '', action });
    } else if (fileContent.length > 0) {
      files.push({ path: filePath, content: fileContent, action });
    }

    searchFrom = endIdx + FILE_END.length;
  }

  return files;
}

/**
 * Parse multi-file markers within a complete artifact block.
 * If no lyra-file markers found, treat entire code as single index.html.
 */
function parseFiles(code: string): ArtifactFile[] {
  const parsed = parseFileBlocks(code, false).filter(f => f.action !== 'delete');

  if (parsed.length === 0) {
    // No file markers found — treat entire code as single HTML file
    return [{ path: 'index.html', content: stripCodeFence(code) }];
  }

  return parsed.map(({ path, content }) => ({ path, content }));
}

/**
 * Extract all complete artifact blocks from a message string.
 */
export function extractArtifacts(content: string): ArtifactBlock[] {
  const artifacts: ArtifactBlock[] = [];
  let searchFrom = 0;

  while (searchFrom < content.length) {
    const startIdx = findLineStartMarker(content, ARTIFACT_START, searchFrom);
    if (startIdx === -1) break;

    const startTagEnd = content.indexOf('-->', startIdx);
    if (startTagEnd === -1) break;
    const startTagFull = content.substring(startIdx, startTagEnd + 3);

    const title = parseAttrs(startTagFull).title || undefined;

    const codeStart = startTagEnd + 3;
    const endIdx = content.indexOf(ARTIFACT_END, codeStart);
    if (endIdx === -1) break;

    const code = content.substring(codeStart, endIdx).trim();
    if (code.length > 0) {
      const files = parseFiles(code);
      artifacts.push({
        id: `artifact-${artifacts.length}-${Date.now()}`,
        code,
        title,
        files,
      });
    }

    searchFrom = endIdx + ARTIFACT_END.length;
  }

  return artifacts;
}

/**
 * Loose extraction: collect all file blocks from a message, even when the
 * artifact block is unterminated (streaming/truncated). Used for live preview
 * and for building the merged conversation-level project state.
 */
export function extractFilesLoose(
  content: string,
  includePartial = false,
): { files: ParsedFile[]; title?: string } {
  const files: ParsedFile[] = [];
  let title: string | undefined;
  let searchFrom = 0;

  while (searchFrom < content.length) {
    const startIdx = findLineStartMarker(content, ARTIFACT_START, searchFrom);
    if (startIdx === -1) break;

    const startTagEnd = content.indexOf('-->', startIdx);
    if (startTagEnd === -1) break;
    const startTagFull = content.substring(startIdx, startTagEnd + 3);
    title = parseAttrs(startTagFull).title || title;

    const codeStart = startTagEnd + 3;
    const endIdx = content.indexOf(ARTIFACT_END, codeStart);
    const code = endIdx === -1 ? content.substring(codeStart) : content.substring(codeStart, endIdx);

    files.push(...parseFileBlocks(code, includePartial));

    if (endIdx === -1) break;
    searchFrom = endIdx + ARTIFACT_END.length;
  }

  return { files, title };
}

/**
 * Merge parsed file updates into an existing file list.
 * update/create overwrite by path; delete removes the file.
 */
export function mergeArtifactFiles(base: ArtifactFile[], updates: ParsedFile[]): ArtifactFile[] {
  const map = new Map<string, ArtifactFile>();
  for (const f of base) {
    map.set(normalizeFilePath(f.path), { path: normalizeFilePath(f.path), content: f.content });
  }
  for (const u of updates) {
    const key = normalizeFilePath(u.path);
    if (u.action === 'delete') {
      map.delete(key);
    } else {
      map.set(key, { path: key, content: u.content });
    }
  }
  return Array.from(map.values());
}

/**
 * Build the current project state of a conversation by folding all assistant
 * messages (in chronological order) and merging their artifact files.
 * Pass includePartialForLast=true during streaming for live preview.
 */
export function buildConversationArtifact(
  assistantContents: string[],
  includePartialForLast = false,
): ArtifactBlock | null {
  let files: ArtifactFile[] = [];
  let title: string | undefined;

  for (let i = 0; i < assistantContents.length; i++) {
    const isLast = i === assistantContents.length - 1;
    const { files: parsed, title: t } = extractFilesLoose(
      assistantContents[i],
      isLast && includePartialForLast,
    );
    if (t) title = t;
    if (parsed.length > 0) {
      files = mergeArtifactFiles(files, parsed);
    }
  }

  if (files.length === 0) return null;

  return {
    id: 'conversation-artifact',
    code: '',
    title,
    files,
  };
}

/**
 * Serialize project files as context for the AI (edit mode).
 * Caps total size; files that don't fit are listed by structure only.
 */
export function serializeFilesForContext(files: ArtifactFile[], maxChars = 30000): string {
  const structure = files.map(f => `- ${f.path}`).join('\n');
  let result = `Struktur file:\n${structure}\n\n`;
  const omitted: string[] = [];

  for (const f of files) {
    const block = `<!-- lyra-file path="${f.path}" -->\n${f.content}\n<!-- /lyra-file -->\n\n`;
    if (result.length + block.length > maxChars) {
      omitted.push(f.path);
      continue;
    }
    result += block;
  }

  if (omitted.length > 0) {
    result += `[File berikut tidak ditampilkan karena keterbatasan ruang: ${omitted.join(', ')}. Jika perlu diubah, minta user menyebut file spesifik.]\n`;
  }

  return result.trim();
}

/**
 * Check if a message contains at least one artifact block (complete).
 */
export function hasArtifact(content: string): boolean {
  return findLineStartMarker(content, ARTIFACT_START) !== -1 && content.includes(ARTIFACT_END);
}

/**
 * Check if message has a start marker but NO end marker (incomplete/partial artifact).
 */
export function hasPartialArtifact(content: string): boolean {
  return findLineStartMarker(content, ARTIFACT_START) !== -1 && !content.includes(ARTIFACT_END);
}

/**
 * Check if message contains an artifact start marker at all (complete or not).
 */
export function hasAnyArtifactMarker(content: string): boolean {
  return findLineStartMarker(content, ARTIFACT_START) !== -1;
}

/**
 * Index of the first real (line-start) artifact marker, or -1.
 */
export function artifactMarkerIndex(content: string): number {
  return findLineStartMarker(content, ARTIFACT_START);
}

/**
 * Remove artifact blocks from message content.
 * Also handles partial artifacts (start marker but no end marker).
 */
export function stripArtifacts(content: string): string {
  let result = content;
  let idx = 0;

  while (true) {
    const startIdx = findLineStartMarker(result, ARTIFACT_START, idx);
    if (startIdx === -1) break;

    const endIdx = result.indexOf(ARTIFACT_END, startIdx);
    if (endIdx === -1) {
      // Partial artifact — remove from start marker to end of content
      result = result.substring(0, startIdx);
      break;
    }

    const before = result.substring(0, startIdx);
    const after = result.substring(endIdx + ARTIFACT_END.length);
    result = before + after;
    idx = before.length;
  }

  return result.trim();
}
