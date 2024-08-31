import { FileHistoryManager } from '../src/core/FileHistoryManager';
import { FileHistory } from '../src/core/TaskInitializer';

describe('FileHistoryManager', () => {
  test('should update file history correctly', () => {
    const currentHistory: FileHistory[] = [
      {
        file_name: 'test.ts',
        current_version: 1,
        version_diffs: [
          {
            from_version: 0,
            to_version: 1,
            diff: '+ initial content',
            comment: 'Initial version',
          },
        ],
      },
    ];

    const newChanges: FileHistory[] = [
      {
        file_name: 'test.ts',
        current_version: 2,
        version_diffs: [
          {
            from_version: 1,
            to_version: 2,
            diff: '- old line\n+ new line',
            comment: 'Update content',
          },
        ],
      },
    ];

    const updatedHistory = FileHistoryManager.updateFileHistory(currentHistory, newChanges);

    expect(updatedHistory).toHaveLength(1);
    expect(updatedHistory[0].file_name).toBe('test.ts');
    expect(updatedHistory[0].current_version).toBe(2);
    expect(updatedHistory[0].version_diffs).toHaveLength(2);
    expect(updatedHistory[0].version_diffs[1].comment).toBe('Update content');
  });

  test('should handle new files correctly', () => {
    const currentHistory: FileHistory[] = [];

    const newChanges: FileHistory[] = [
      {
        file_name: 'new.ts',
        current_version: 1,
        version_diffs: [
          {
            from_version: 0,
            to_version: 1,
            diff: '+ new file content',
            comment: 'Create new file',
          },
        ],
      },
    ];

    const updatedHistory = FileHistoryManager.updateFileHistory(currentHistory, newChanges);

    expect(updatedHistory).toHaveLength(1);
    expect(updatedHistory[0].file_name).toBe('new.ts');
    expect(updatedHistory[0].current_version).toBe(1);
    expect(updatedHistory[0].version_diffs).toHaveLength(1);
  });

  // Add more tests for different scenarios (e.g., multiple files, no changes, etc.)
});