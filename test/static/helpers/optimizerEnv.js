import { core } from './core.js';

// The optimizer chain (DataStorage -> TypeCombinationGenerator -> BuildOptimizer) is part of the TypeScript core.
export function loadOptimizerEnv() {
    return { ...core };
}
