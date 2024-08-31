import { Task } from '../src/core/TaskInitializer';
import { ToolResults, LLMResponse } from '../src/core/LLMInterface';
import { RealLLM } from '../src/core/RealLLM';
import { runPrompt } from '../src/core/runPrompt';
import { Logger } from '../src/core/Logger';

jest.mock('../src/core/runPrompt');
jest.mock('../src/core/Logger');

describe('RealLLM', () => {
  let llm: RealLLM;
  let mockTask: Task;
  let mockToolResults: ToolResults;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      logInfo: jest.fn(),
      logLLMRequest: jest.fn(),
      logLLMResponse: jest.fn(),
      logToolStderr: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);

    llm = new RealLLM();
    mockTask = {
      description: 'Test task',
      relevantFiles: [{ fileName: 'file1.ts', contentSnippet: 'console.log("test");' }],
      projectRootDirectory: '/test/project',
      enableQuestions: false,
      relevantFilesHistory: []
    };
    mockToolResults = {
      tsc: { success: true, message: 'Compilation successful' },
      jest: { success: true, message: 'All tests passed' }
    };
  });

  test('generateCode should return a valid LLMResponse', async () => {
    const mockLLMResponse = JSON.stringify({
      toolUsages: [],
      isTaskComplete: false,
      actionsSummary: 'Generated code',
      relevantFiles: ['file1.ts'],
      filesHistory: [
        {
          file_name: 'file1.ts',
          current_version: 1,
          version_diffs: []
        }
      ]
    });

    (runPrompt as jest.Mock).mockResolvedValue(mockLLMResponse);

    const result = await llm.generateCode(mockTask, mockToolResults);

    expect(result.isTaskComplete).toBe(false);
    expect(result.actionsSummary).toBe('Generated code');
    expect(result.filesHistory).toHaveLength(1);
    expect(result.filesHistory[0].file_name).toBe('file1.ts');
    expect(mockLogger.logInfo).toHaveBeenCalled();
    expect(mockLogger.logLLMRequest).toHaveBeenCalled();
    expect(mockLogger.logLLMResponse).toHaveBeenCalled();
  });

  test('analyzeResults should return a valid LLMResponse', async () => {
    const mockLLMResponse = JSON.stringify({
      toolUsages: [],
      isTaskComplete: true,
      completionReason: 'Task completed successfully',
      actionsSummary: 'Analyzed results',
      relevantFiles: ['file1.ts'],
      filesHistory: [
        {
          file_name: 'file1.ts',
          current_version: 2,
          version_diffs: [
            {
              from_version: 1,
              to_version: 2,
              diff: '- old\n+ new',
              comment: 'Updated file'
            }
          ]
        }
      ]
    });

    (runPrompt as jest.Mock).mockResolvedValue(mockLLMResponse);

    const result = await llm.analyzeResults(mockTask, mockToolResults);

    expect(result.isTaskComplete).toBe(true);
    expect(result.completionReason).toBe('Task completed successfully');
    expect(result.actionsSummary).toBe('Analyzed results');
    expect(result.filesHistory).toHaveLength(1);
    expect(result.filesHistory[0].version_diffs).toHaveLength(1);
    expect(mockLogger.logInfo).toHaveBeenCalled();
    expect(mockLogger.logLLMRequest).toHaveBeenCalled();
    expect(mockLogger.logLLMResponse).toHaveBeenCalled();
  });
});