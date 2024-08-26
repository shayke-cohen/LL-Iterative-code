"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class HistoryManager {
    constructor(projectRoot) {
        this.history = [];
        this.filePath = path_1.default.join(projectRoot, 'task_history.txt');
    }
    addEntry(entry) {
        this.history.push(entry);
        this.writeToFile(entry);
    }
    getHistory() {
        return this.history;
    }
    writeToFile(entry) {
        fs_1.default.appendFileSync(this.filePath, `${entry}\n`);
    }
}
exports.HistoryManager = HistoryManager;
