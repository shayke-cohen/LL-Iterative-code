"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskInitializer = void 0;
class TaskInitializer {
    static initialize(description, relevantFiles, workingFiles, projectRootDirectory, enableQuestions) {
        return {
            description,
            relevantFiles,
            workingFiles,
            projectRootDirectory,
            enableQuestions,
        };
    }
}
exports.TaskInitializer = TaskInitializer;
