/**
 * @fileoverview Agent System Exports
 * 
 * Central export point for the bioinformatics agent system.
 */

// Types
export * from './types';

// Task Router
export {
    detectAgentDomain, detectTaskCategory, getDomainInstructions, getSuggestedTools, hasFileAttachment, routeToOptimalModel
} from './task-router';

// Main Agent
export {
    createAgentTools, createInitialAgentState, executeAgent, type AgentExecutionOptions
} from './attma-agent';

// Self-Verification
export {
    verifySelfAnswer,
    type VerificationOptions,
    type VerificationResult
} from './self-verification';
