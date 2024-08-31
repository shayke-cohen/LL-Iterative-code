import { LLMInterface, LLMResponse, ToolResults } from '../src/core/LLMInterface';
import { Task } from '../src/core/TaskInitializer';

class TestLLM extends LLMInterface {
  async generateCode(task: Task, toolResults: ToolResults): Promise<LLMResponse> {
    return {
      toolUsages: [{ name: 'updateFile', params: { fileName: 'test.ts', content: 'console.log("generated");' }, reasoning: 'Update file' }],
      questions: [],
      isTaskComplete: false,
      actionsSummary: 'Generated code',
      relevantFiles: ['test.ts'],
      filesHistory: []
    };
  }

  async analyzeResults(task: Task, toolResults: ToolResults): Promise<LLMResponse> {
    return {
      toolUsages: [],
      questions: [],
      isTaskComplete: false,
      actionsSummary: 'Analyzed results',
      relevantFiles: ['test.ts'],
      filesHistory: []
    };
  }
}

describe('LLMInterface', () => {
  let llm: TestLLM;
  let task: Task;

  beforeEach(() => {
    llm = new TestLLM();
    task = {
      description: 'Test task',
      relevantFiles: [],
      projectRootDirectory: '/test',
      enableQuestions: false,
      relevantFilesHistory: []
    };
  });

  test('should generate code', async () => {
    const result = await llm.generateCode(task, {});
    expect(result.toolUsages).toHaveLength(1);
    expect(result.toolUsages[0].name).toBe('updateFile');
    expect(result.isTaskComplete).toBe(false);
    expect(result.actionsSummary).toBe('Generated code');
  });

  test('should analyze results', async () => {
    const result = await llm.analyzeResults(task, {});
    expect(result.toolUsages).toHaveLength(0);
    expect(result.isTaskComplete).toBe(false);
    expect(result.actionsSummary).toBe('Analyzed results');
  });
});