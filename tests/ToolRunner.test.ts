import { ToolRunner } from '../src/core/ToolRunner';
import { FileManager } from '../src/core/FileManager';
import { Logger } from '../src/core/Logger';
import { File, FileHistory, FileUpdate } from '../src/core/TaskInitializer';
import { ToolUsage, ToolResult } from '../src/core/LLMInterface';
import { FileHistoryManager } from '../src/core/FileHistoryManager';

jest.mock('../src/core/FileManager');
jest.mock('../src/core/Logger');
jest.mock('../src/core/FileHistoryManager');

describe('ToolRunner', () => {
  let mockFileManagerInstance: jest.Mocked<FileManager>;
  let mockLoggerInstance: jest.Mocked<Logger>;

  beforeAll(() => {
    mockFileManagerInstance = {
      updateFile: jest.fn().mockReturnValue(true),
      moveFile: jest.fn().mockReturnValue(true),
      deleteFile: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<FileManager>;

    mockLoggerInstance = {
      logToolStderr: jest.fn(),
      logToolExecution: jest.fn(),
      logMainFlow: jest.fn(),
      logInfo: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    (FileManager as jest.Mock).mockImplementation(() => mockFileManagerInstance);
    (Logger.getInstance as jest.Mock).mockReturnValue(mockLoggerInstance);

    ToolRunner.initialize('/test/project/root');

    // Mock the runCommand method
    jest.spyOn(ToolRunner, 'runCommand').mockImplementation(async (command: string) => {
      return { success: true, message: `Mocked output for command: ${command}` };
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should run tools and return results', async () => {
    const mockFileHistoryManager = FileHistoryManager as jest.Mocked<typeof FileHistoryManager>;
    mockFileHistoryManager.updateFileHistory.mockImplementation((currentHistory: FileHistory[], newChanges: FileUpdate[]) => [
      {
        file_name: 'test.ts',
        current_version: 2,
        version_diffs: [
          {
            from_version: 1,
            to_version: 2,
            diff: '- old\n+ new',
            comment: 'Update'
          }
        ]
      }
    ]);

    const toolUsages: ToolUsage[] = [
      {
        name: 'updateFile',
        params: { fileName: 'test.ts', content: 'console.log("updated");' },
        reasoning: 'Update file content'
      },
      {
        name: 'yarnInstall',
        params: {},
        reasoning: 'Install dependencies'
      }
    ];

    const { results, newFiles, modifiedFiles, updatedFileHistory } = await ToolRunner.runTools(toolUsages);

    expect(results['updateFile|fileName=test.ts,content=console.log("updated");']).toEqual({ success: true, message: 'File updated successfully.' });
    expect(results['yarnInstall|']).toEqual({ success: true, message: 'Mocked output for command: yarn install' });
    expect(newFiles).toHaveLength(0);
    expect(modifiedFiles).toContain('test.ts');
    expect(updatedFileHistory).toHaveLength(1);
    
    expect(mockFileManagerInstance.updateFile).toHaveBeenCalledWith({
      fileName: 'test.ts',
      contentSnippet: 'console.log("updated");'
    });

    // Check if any logging method has been called
    const loggingMethodCalled = [
      mockLoggerInstance.logMainFlow,
      mockLoggerInstance.logInfo,
      mockLoggerInstance.logToolExecution,
      mockLoggerInstance.logToolStderr
    ].some(method => method.mock.calls.length > 0);

    expect(loggingMethodCalled).toBe(true);
  });

  // Add more tests for other tool usages
});