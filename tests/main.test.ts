import { main } from '../src/index';
import { CLIInterface } from '../src/cli/CLIInterface';
import { ToolRunner } from '../src/core/ToolRunner';
import { RealLLM } from '../src/core/RealLLM';
import { getProjectStructure, selectRelevantFiles } from '../src/core/file-selector';
import { jest } from '@jest/globals';

jest.mock('../src/cli/CLIInterface');
jest.mock('../src/core/ToolRunner');
jest.mock('../src/core/RealLLM');
jest.mock('../src/core/file-selector');

describe('main function', () => {
  let mockCLI: jest.Mocked<CLIInterface>;
  let mockToolRunner: jest.Mocked<typeof ToolRunner>;
  let mockLLM: jest.Mocked<RealLLM>;

  beforeEach(() => {
    mockCLI = {
      askQuestion: jest.fn(),
      close: jest.fn(),
    } as any;
    (CLIInterface as jest.Mock).mockImplementation(() => mockCLI);

    mockToolRunner = {
      initialize: jest.fn(),
      runTools: jest.fn(),
      runStandardTools: jest.fn(),
    } as any;
    Object.assign(ToolRunner, mockToolRunner);

    mockLLM = {
      generateCode: jest.fn(),
      analyzeResults: jest.fn(),
    } as any;
    (RealLLM as jest.Mock).mockImplementation(() => mockLLM);

    (getProjectStructure as jest.Mock).mockResolvedValue('mocked project structure');
    (selectRelevantFiles as jest.Mock).mockResolvedValue([
      { name: 'file1.ts', content: 'content1' },
      { name: 'file2.ts', content: 'content2' },
    ]);
  });

  test('should run the main process successfully', async () => {
    mockCLI.askQuestion
      .mockResolvedValueOnce('/test/project') // project directory
      .mockResolvedValueOnce('test task'); // task description

    mockLLM.generateCode.mockResolvedValue({
      toolUsages: [{ name: 'updateFile', params: { fileName: 'file1.ts', content: 'updated content' } }],
      isTaskComplete: false,
    });

    mockToolRunner.runTools.mockResolvedValue({
      results: { updateFile: { success: true, message: 'File updated' } },
      newFiles: [],
      modifiedFiles: ['file1.ts'],
      updatedFileHistory: [
        {
          file_name: 'file1.ts',
          current_version: 1,
          version_diffs: [{ from_version: 0, to_version: 1, diff: '- old\n+ new', comment: 'Update file' }],
        },
      ],
    });

    mockToolRunner.runStandardTools.mockResolvedValue({
      tsc: { success: true, message: 'Compilation successful' },
      jest: { success: true, message: 'Tests passed' },
    });

    mockLLM.analyzeResults.mockResolvedValue({
      isTaskComplete: true,
      completionReason: 'Task completed successfully',
      actionsSummary: 'Updated file1.ts',
    });

    await main();

    expect(mockCLI.askQuestion).toHaveBeenCalledTimes(2);
    expect(ToolRunner.initialize).toHaveBeenCalledWith(expect.any(String));
    expect(mockLLM.generateCode).toHaveBeenCalled();
    expect(mockToolRunner.runTools).toHaveBeenCalled();
    expect(mockToolRunner.runStandardTools).toHaveBeenCalled();
    expect(mockLLM.analyzeResults).toHaveBeenCalled();
    expect(mockCLI.close).toHaveBeenCalled();
  });

  // Add more tests for different scenarios (e.g., task not complete after max iterations, error handling)
});