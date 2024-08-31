import { ToolRunner } from '../src/core/ToolRunner';
import { FileManager } from '../src/core/FileManager';
import { FileHistoryManager } from '../src/core/FileHistoryManager';
import { ToolUsage } from '../src/core/LLMInterface';
import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('../src/core/FileManager');
jest.mock('../src/core/FileHistoryManager');
jest.mock('fs');
jest.mock('path');

describe('ToolRunner', () => {
  let mockFileManager: jest.Mocked<FileManager>;
  let mockFileHistoryManager: typeof FileHistoryManager;

  beforeEach(() => {
    mockFileManager = {
      moveFile: jest.fn(),
      updateFile: jest.fn(),
      deleteFile: jest.fn(),
    } as any;
    (FileManager as jest.Mock).mockImplementation(() => mockFileManager);

    mockFileHistoryManager = {
      updateFileHistory: jest.fn(),
    } as any;
    Object.assign(FileHistoryManager, mockFileHistoryManager);

    ToolRunner.initialize('/test/project');
  });

  test('should run updateFile tool successfully', async () => {
    const toolUsages: ToolUsage[] = [
      {
        name: 'updateFile',
        params: { fileName: 'test.ts', content: 'updated content' },
        reasoning: 'Update test file',
      },
    ];

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('old content');
    mockFileManager.updateFile.mockReturnValue(true);
    mockFileHistoryManager.updateFileHistory.mockReturnValue([
      {
        file_name: 'test.ts',
        current_version: 1,
        version_diffs: [{ from_version: 0, to_version: 1, diff: '- old\n+ new', comment: 'Update test file' }],
      },
    ]);

    const result = await ToolRunner.runTools(toolUsages);

    expect(result.results['updateFile|fileName=test.ts,content=updated content'].success).toBe(true);
    expect(result.modifiedFiles).toContain('test.ts');
    expect(mockFileHistoryManager.updateFileHistory).toHaveBeenCalled();
    expect(result.updatedFileHistory).toHaveLength(1);
  });

  test('should run yarn command successfully', async () => {
    const toolUsages: ToolUsage[] = [
      {
        name: 'yarnInstall',
        params: {},
        reasoning: 'Install dependencies',
      },
    ];

    jest.spyOn(ToolRunner, 'runCommand').mockResolvedValue('Yarn install successful');

    const result = await ToolRunner.runTools(toolUsages);

    expect(result.results['yarnInstall|'].success).toBe(true);
    expect(ToolRunner.runCommand).toHaveBeenCalledWith('yarn install');
  });

  // Add more tests for other tool types (moveFile, deleteFile, requestFiles, etc.)
});