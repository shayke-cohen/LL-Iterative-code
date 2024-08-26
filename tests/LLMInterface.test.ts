import { LLMInterface, LLMResponse, ToolResults } from '../src/core/LLMInterface';
import { Task } from '../src/core/TaskInitializer';

class TestLLM extends LLMInterface {
  async generateCode(task: Task, toolResults: ToolResults, history: string[]): Promise<LLMResponse> {
    return {
      updatedFiles: [{ fileName: 'test.ts', contentSnippet: 'console.log("generated");' }],
      toolUsages: [{ name: 'updateFile', params: { fileName: 'test.ts', content: 'console.log("generated");' }, reasoning: 'Generate new code' }],
    };
  }

  async analyzeResults(task: Task, toolResults: ToolResults, history: string[]): Promise<LLMResponse> {
    return {
      updatedFiles: [],
      toolUsages: [{ name: 'yarnTest', params: {}, reasoning: 'Run tests' }],
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
      workingFiles: [],
      projectRootDirectory: '/test',
      enableQuestions: false,
    };
  });

  test('should generate code', async () => {
    const result = await llm.generateCode(task, {}, []);
    expect(result.updatedFiles).toHaveLength(1);
    expect(result.updatedFiles[0].fileName).toBe('test.ts');
    expect(result.toolUsages).toHaveLength(1);
    expect(result.toolUsages[0].name).toBe('updateFile');
  });

  test('should analyze results', async () => {
    const result = await llm.analyzeResults(task, {}, []);
    expect(result.updatedFiles).toHaveLength(0);
    expect(result.toolUsages).toHaveLength(1);
    expect(result.toolUsages[0].name).toBe('yarnTest');
  });
});