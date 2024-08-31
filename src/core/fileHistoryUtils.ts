import { FileHistory, FileUpdate, VersionDiff, Task } from './TaskInitializer';
import { diffLines } from 'diff';

export function generateDiff(oldContent: string, newContent: string): string {
  const diffResult = diffLines(oldContent, newContent);
  return diffResult
    .filter(part => part.added || part.removed)
    .map(part => (part.added ? '+' : '-') + part.value.trim())
    .join('\n');
}

export function mergeFileHistories(oldHistory: FileHistory, newChanges: FileUpdate): FileHistory {
  const updatedVersionDiffs = [
    ...oldHistory.version_diffs,
    {
      from_version: oldHistory.current_version,
      to_version: newChanges.new_version.version,
      diff: newChanges.new_version.diff,
      comment: newChanges.new_version.comment
    }
  ];

  return {
    file_name: oldHistory.file_name,
    current_version: newChanges.new_version.version,
    version_diffs: updatedVersionDiffs
  };
}

export function updateFileHistories(task: Task, updatedFiles: FileUpdate[]): FileHistory[] {
  return task.relevantFilesHistory.map((fileHistory: FileHistory) => {
    const updatedFile = updatedFiles.find(uf => uf.file_name === fileHistory.file_name);
    if (updatedFile) {
      return mergeFileHistories(fileHistory, updatedFile);
    }
    return fileHistory;
  });
}