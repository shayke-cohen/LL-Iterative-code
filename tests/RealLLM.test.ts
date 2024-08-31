import { RealLLM } from '../src/core/RealLLM';
import { Task, ToolResults } from '../src/core/TaskInitializer';
import { runPrompt } from '../src/core/runPrompt';
import { jest } from '@jest/globals';

jest.mock('../src/core/runPrompt');

describe('RealLLM', () => {
  let llm: RealLLM;
  let mockTask: Task;
  let mockToolResults: ToolResults;

  beforeEach(() => {
    llm = new RealLLM();
    mockTask = {
      description: 'Test task',
      relevantFiles: [{ fileName: 'test.ts', contentSnippet: 'console.log("test");' }],
      projectRootDirectory: '/test/project',
      enableQuestions: false,
      relevantFilesHistory: [],
    };
    mockToolResults = {
      tsc: { success: true, message: 'Compilation successful' },
      jest: { success: true, message: 'Tests passed' },
    };
  });

  test('should generate code successfully', async () => {
    const mockLLMResponse = JSON.stringify({
      toolUsages: [{ name: 'updateFile', params: { fileName: 'test.ts', content: 'updated content' } }],
      isTaskComplete: false,
      actionsSummary: 'Updated test.ts',
      files_history: [
        {
          file_name: 'test.ts',
          current_version: 1,
          version_diffs: [{ from_version: 0, to_version: 1, diff: '- old\n+ new', comment: 'Update file' }],
        },
      ],
    });

    (runPrompt as jest.Mock).mockResolvedValue(mockLLMResponse);

    const result = await llm.generateCode(mockTask, mockToolResults);

    expect(runPrompt).toHaveBeenCalled();
    expect(result.toolUsages).toHaveLength(1);
    expect(result.toolUsages[0].name).toBe('updateFile');
    expect(result.isTaskComplete).toBe(false);
    expect(result.files_history).toHaveLength(1);
  });

  test('should analyze results successfully', async () => {
    const mockLLMResponse = JSON.stringify({
      isTaskComplete: true,
      completionReason: 'Task completed successfully',
      actionsSummary: 'Analyzed results',
      relevantFiles: ['test.ts'],
    });

    (runPrompt as jest.Mock).mockResolvedValue(mockLLMResponse);

    const result = await llm.analyzeResults(mockTask, mockToolResults);

    expect(runPrompt).toHaveBeenCalled();
    expect(result.isTaskComplete).toBe(true);
    expect(result.completionReason).toBe('Task completed successfully');
    expect(result.relevantFiles).toContain('test.ts');
  });

  // Add more tests for error handling, retries, etc.
});