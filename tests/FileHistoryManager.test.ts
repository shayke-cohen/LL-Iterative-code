import { FileHistoryManager } from '../src/core/FileHistoryManager';
import { FileHistory, FileUpdate } from '../src/core/TaskInitializer';

describe('FileHistoryManager', () => {
  test('should update file history correctly', () => {
    const currentHistory: FileHistory[] = [
      {
        file_name: 'test.ts',
        current_version: 1,
        version_diffs: []
      }
    ];

    const newChanges: FileUpdate[] = [
      {
        file_name: 'test.ts',
        new_version: {
          version: 2,
          code: 'updated content',
          diff: '- old\n+ new',
          comment: 'Update test.ts'
        }
      }
    ];

    const updatedHistory = FileHistoryManager.updateFileHistory(currentHistory, newChanges);

    expect(updatedHistory).toHaveLength(1);
    expect(updatedHistory[0].current_version).toBe(2);
    expect(updatedHistory[0].version_diffs).toHaveLength(1);
    expect(updatedHistory[0].version_diffs[0].from_version).toBe(1);
    expect(updatedHistory[0].version_diffs[0].to_version).toBe(2);
    expect(updatedHistory[0].version_diffs[0].diff).toBe('- old\n+ new');
    expect(updatedHistory[0].version_diffs[0].comment).toBe('Update test.ts');
  });

  test('should add new file to history if not present', () => {
    const currentHistory: FileHistory[] = [];

    const newChanges: FileUpdate[] = [
      {
        file_name: 'new.ts',
        new_version: {
          version: 1,
          code: 'new content',
          diff: '+ new content',
          comment: 'Create new.ts'
        }
      }
    ];

    const updatedHistory = FileHistoryManager.updateFileHistory(currentHistory, newChanges);

    expect(updatedHistory).toHaveLength(1);
    expect(updatedHistory[0].file_name).toBe('new.ts');
    expect(updatedHistory[0].current_version).toBe(1);
    expect(updatedHistory[0].version_diffs).toHaveLength(1);
    expect(updatedHistory[0].version_diffs[0].from_version).toBe(0);
    expect(updatedHistory[0].version_diffs[0].to_version).toBe(1);
  });
});