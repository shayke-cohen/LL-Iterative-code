import { TaskInitializer, Task, File } from '../src/core/TaskInitializer';

describe('TaskInitializer', () => {
  test('should initialize a task correctly', () => {
    const description = 'Test task';
    const relevantFiles: File[] = [{ fileName: 'relevant.ts', contentSnippet: 'console.log("relevant");' }];
    const workingFiles: File[] = [{ fileName: 'working.ts', contentSnippet: 'console.log("working");' }];
    const projectRootDirectory = '/test/project';
    const enableQuestions = true;

    const task: Task = TaskInitializer.initialize(
      description,
      relevantFiles,
      workingFiles,
      projectRootDirectory,
      enableQuestions
    );

    expect(task).toEqual({
      description,
      relevantFiles,
      workingFiles,
      projectRootDirectory,
      enableQuestions,
    });
  });
});