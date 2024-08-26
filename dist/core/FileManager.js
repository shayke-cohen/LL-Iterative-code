"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const Logger_1 = require("./Logger");
class FileManager {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
    }
    moveFile(source, destination) {
        const sourcePath = path_1.default.join(this.projectRoot, source);
        const destinationPath = path_1.default.join(this.projectRoot, destination);
        try {
            fs_1.default.renameSync(sourcePath, destinationPath);
            Logger_1.Logger.log(`Moved file from ${source} to ${destination}`);
            return true;
        }
        catch (error) {
            Logger_1.Logger.error(`Failed to move file from ${source} to ${destination}: ${error.message}`);
            return false;
        }
    }
    updateFile(file) {
        const filePath = path_1.default.join(this.projectRoot, file.fileName);
        try {
            fs_1.default.writeFileSync(filePath, file.contentSnippet);
            Logger_1.Logger.log(`Updated file ${file.fileName}`);
            return true;
        }
        catch (error) {
            Logger_1.Logger.error(`Failed to update file ${file.fileName}: ${error.message}`);
            return false;
        }
    }
    deleteFile(fileName) {
        const filePath = path_1.default.join(this.projectRoot, fileName);
        try {
            fs_1.default.unlinkSync(filePath);
            Logger_1.Logger.log(`Deleted file ${fileName}`);
            return true;
        }
        catch (error) {
            Logger_1.Logger.error(`Failed to delete file ${fileName}: ${error.message}`);
            return false;
        }
    }
}
exports.FileManager = FileManager;
