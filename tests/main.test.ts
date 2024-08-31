import { main } from '../src/index';
import { getProjectStructure, selectRelevantFiles } from '../src/core/file-selector';
import { ToolUsage, LLMResponse } from '../src/core/LLMInterface';
import { RealLLM } from '../src/core/RealLLM';
import { ToolRunner } from '../src/core/ToolRunner';
import { CLIInterface } from '../src/cli/CLIInterface';

jest.mock('../src/core/file-selector');
jest.mock('../src/core/RealLLM');
jest.mock('../src/core/ToolRunner');
jest.mock('../src/cli/CLIInterface');

describe('main function', () => {
  it('should execute the main process', async () => {
    // Mock getProjectStructure
    (getProjectStructure as jest.Mock).mockResolvedValue('mocked project structure');

    // Mock selectRelevantFiles
    (selectRelevantFiles as jest.Mock).mockResolvedValue([
      { name: 'file1.ts', content: 'content1' },
      { name: 'file2.ts', content: 'content2' },
    ]);

    // Mock CLIInterface
    const mockCLI = {
      askQuestion: jest.fn().mockResolvedValue(''),
      close: jest.fn(),
    };
    (CLIInterface as jest.Mock).mockImplementation(() => mockCLI);

    // Mock RealLLM
    const mockLLM = {
      generateCode: jest.fn(),
      analyzeResults: jest.fn(),
    };
    (RealLLM as jest.Mock).mockImplementation(() => mockLLM);

    // Mock ToolRunner
    (ToolRunner.runTools as jest.Mock).mockResolvedValue({
      results: {},
      newFiles: [],
      modifiedFiles: [],
      updatedFileHistory: [],
    });
    (ToolRunner.runStandardTools as jest.Mock).mockResolvedValue({});

    // Mock LLM responses
    const mockToolUsage: ToolUsage = {
      name: 'updateFile',
      params: { fileName: 'file1.ts', content: 'updated content' },
      reasoning: 'Update file content'
    };

    const mockGenerateCodeResponse: LLMResponse = {
      toolUsages: [mockToolUsage],
      questions: [],
      isTaskComplete: false,
      actionsSummary: 'Generated code',
      relevantFiles: ['file1.ts'],
      filesHistory: []
    };

    const mockAnalyzeResultsResponse: LLMResponse = {
      toolUsages: [],
      questions: [],
      isTaskComplete: true,
      completionReason: 'Task completed successfully',
      actionsSummary: 'Updated file1.ts',
      relevantFiles: ['file1.ts'],
      filesHistory: []
    };

    mockLLM.generateCode.mockResolvedValue(mockGenerateCodeResponse);
    mockLLM.analyzeResults.mockResolvedValue(mockAnalyzeResultsResponse);

    // Execute main function
    await main();

    // Add your assertions here
    expect(getProjectStructure).toHaveBeenCalled();
    expect(selectRelevantFiles).toHaveBeenCalled();
    expect(mockCLI.askQuestion).toHaveBeenCalled();
    expect(mockLLM.generateCode).toHaveBeenCalled();
    expect(mockLLM.analyzeResults).toHaveBeenCalled();
    expect(ToolRunner.runTools).toHaveBeenCalled();
    expect(ToolRunner.runStandardTools).toHaveBeenCalled();
    expect(mockCLI.close).toHaveBeenCalled();
  });
});