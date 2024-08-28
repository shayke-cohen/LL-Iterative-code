import fs from 'fs';
import path from 'path';
import { File } from './TaskInitializer';
import { Logger } from './Logger';

class FileManager {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  moveFile(source: string, destination: string): boolean {
    const sourcePath = path.join(this.projectRoot, source);
    const destinationPath = path.join(this.projectRoot, destination);

    try {
      fs.renameSync(sourcePath, destinationPath);
      Logger.log(`Moved file from ${source} to ${destination}`);
      return true;
    } catch (error) {
      Logger.error(`Failed to move file from ${source} to ${destination}: ${(error as Error).message}`);
      return false;
    }
  }

  updateFile(file: File): boolean {
    const filePath = path.join(this.projectRoot, file.fileName);

    try {
      // Ensure the directory exists
      fs.mkdirSync(path.dirname(filePath), { recursive: true });

      fs.writeFileSync(filePath, file.contentSnippet);
      Logger.log(`Updated file ${file.fileName}`);
      return true;
    } catch (error) {
      Logger.error(`Failed to update file ${file.fileName}: ${(error as Error).message}`);
      return false;
    }
  }

  deleteFile(fileName: string): boolean {
    const filePath = path.join(this.projectRoot, fileName);

    try {
      fs.unlinkSync(filePath);
      Logger.log(`Deleted file ${fileName}`);
      return true;
    } catch (error) {
      Logger.error(`Failed to delete file ${fileName}: ${(error as Error).message}`);
      return false;
    }
  }
}

export { FileManager };