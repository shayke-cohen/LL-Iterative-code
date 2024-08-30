import fs from 'fs';
import path from 'path';
import { File } from './TaskInitializer';
import { Logger } from './Logger';

class FileManager {
  private projectRoot: string;
  private logger: Logger;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.logger = Logger.getInstance();
  }

  moveFile(source: string, destination: string): boolean {
    const sourcePath = path.join(this.projectRoot, source);
    const destinationPath = path.join(this.projectRoot, destination);

    try {
      fs.renameSync(sourcePath, destinationPath);
      this.logger.logMainFlow(`Moved file from ${source} to ${destination}`);
      return true;
    } catch (error) {
      this.logger.logToolStderr(`Failed to move file from ${source} to ${destination}: ${(error as Error).message}`);
      return false;
    }
  }

  updateFile(file: File): boolean {
    const filePath = path.join(this.projectRoot, file.fileName);

    try {
      // Ensure the directory exists
      const dirPath = path.dirname(filePath);
      fs.mkdirSync(dirPath, { recursive: true });

      // Convert the content to a string if it's not already
      const content = typeof file.contentSnippet === 'string' 
        ? file.contentSnippet 
        : JSON.stringify(file.contentSnippet, null, 2);

      fs.writeFileSync(filePath, content);
      this.logger.logMainFlow(`Updated file ${file.fileName}`);
      return true;
    } catch (error) {
      this.logger.logToolStderr(`Failed to update file ${file.fileName}: ${(error as Error).message}`);
      return false;
    }
  }

  deleteFile(fileName: string): boolean {
    const filePath = path.join(this.projectRoot, fileName);

    try {
      fs.unlinkSync(filePath);
      this.logger.logMainFlow(`Deleted file ${fileName}`);
      return true;
    } catch (error) {
      this.logger.logToolStderr(`Failed to delete file ${fileName}: ${(error as Error).message}`);
      return false;
    }
  }
}

export { FileManager };