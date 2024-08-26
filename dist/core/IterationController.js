"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IterationController = void 0;
class IterationController {
    constructor(maxIterations) {
        this.currentIteration = 0;
        this.maxIterations = maxIterations;
    }
    incrementIteration() {
        this.currentIteration++;
    }
    shouldContinue(taskComplete) {
        return !taskComplete && this.currentIteration < this.maxIterations;
    }
    getCurrentIteration() {
        return this.currentIteration;
    }
}
exports.IterationController = IterationController;
