import { FileHistory, FileUpdate, VersionDiff } from './TaskInitializer';
import { diffLines } from 'diff';

export class FileHistoryManager {
  static updateFileHistory(currentHistory: FileHistory[], newChanges: FileUpdate[]): FileHistory[] {
    const updatedHistory: FileHistory[] = [];

    for (const newChange of newChanges) {
      const existingFile = currentHistory.find(file => file.file_name === newChange.file_name);

      if (existingFile) {
        const lastVersion = existingFile.current_version;
        const newVersion = newChange.new_version.version;

        const newDiff: VersionDiff = {
          from_version: lastVersion,
          to_version: newVersion,
          diff: newChange.new_version.diff,
          comment: newChange.new_version.comment
        };

        updatedHistory.push({
          file_name: newChange.file_name,
          current_version: newVersion,
          version_diffs: [...existingFile.version_diffs, newDiff]
        });
      } else {
        updatedHistory.push({
          file_name: newChange.file_name,
          current_version: newChange.new_version.version,
          version_diffs: [{
            from_version: 0,
            to_version: newChange.new_version.version,
            diff: newChange.new_version.diff,
            comment: newChange.new_version.comment
          }]
        });
      }
    }

    // Add any files from currentHistory that weren't in newChanges
    for (const existingFile of currentHistory) {
      if (!updatedHistory.some(file => file.file_name === existingFile.file_name)) {
        updatedHistory.push(existingFile);
      }
    }

    return updatedHistory;
  }

  private static generateDiff(oldContent: string, newContent: string): string {
    const diff = diffLines(oldContent, newContent);
    return diff
      .filter(part => part.added || part.removed)
      .map(part => `${part.added ? '+' : '-'}${part.value.trim()}`)
      .join('\n');
  }
}