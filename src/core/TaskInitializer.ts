export interface File {
  fileName: string;
  contentSnippet: string;
}

export interface VersionDiff {
  from_version: number;
  to_version: number;
  diff: string;
  comment: string;
}

export interface FileHistory {
  file_name: string;
  current_version: number;
  version_diffs: VersionDiff[];
}

export interface Task {
  description: string;
  currentTaskDescription?: string;
  relevantFiles: File[];
  projectRootDirectory: string;
  enableQuestions: boolean;
  relevantFilesHistory: FileHistory[];
}

// Add this interface to replace UpdatedFile
export interface FileUpdate {
  file_name: string;
  new_version: {
    version: number;
    code: string;
    diff: string;
    comment: string;
  };
}

export class TaskInitializer {
  static initialize(
    description: string,
    relevantFiles: File[],
    projectRootDirectory: string,
    enableQuestions: boolean,
    relevantFilesHistory: FileHistory[] = []
  ): Task {
    return {
      description,
      relevantFiles,
      projectRootDirectory,
      enableQuestions,
      relevantFilesHistory,
    };
  }
}