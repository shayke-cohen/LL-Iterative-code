"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIInterface = void 0;
const readline_1 = __importDefault(require("readline"));
class CLIInterface {
    constructor() {
        this.rl = readline_1.default.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }
    async askQuestion(question) {
        return new Promise((resolve) => {
            this.rl.question(`${question} `, (answer) => {
                resolve(answer);
            });
        });
    }
    close() {
        this.rl.close();
    }
}
exports.CLIInterface = CLIInterface;
