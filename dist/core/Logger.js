"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class Logger {
    static initialize(projectRoot) {
        this.logFile = path_1.default.join(projectRoot, 'app.log');
    }
    static log(message) {
        const logMessage = `[${new Date().toISOString()}] ${message}`;
        console.log(logMessage);
        fs_1.default.appendFileSync(this.logFile, `${logMessage}\n`);
    }
    static error(message) {
        const errorMessage = `[${new Date().toISOString()}] ERROR: ${message}`;
        console.error(errorMessage);
        fs_1.default.appendFileSync(this.logFile, `${errorMessage}\n`);
    }
}
exports.Logger = Logger;
