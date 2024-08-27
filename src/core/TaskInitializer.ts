interface File {
    fileName: string;
    contentSnippet: string;
  }
  
  interface Task {
    description: string;
    currentTaskDescription?: string;
    relevantFiles: File[];
    workingFiles: File[];
    projectRootDirectory: string;
    enableQuestions: boolean;
  }
  
  class TaskInitializer {
    static initialize(
      description: string,
      relevantFiles: File[],
      workingFiles: File[],
      projectRootDirectory: string,
      enableQuestions: boolean
    ): Task {
      return {
        description,
        relevantFiles,
        workingFiles,
        projectRootDirectory,
        enableQuestions,
      };
    }
  }
  
  export { TaskInitializer, Task, File };