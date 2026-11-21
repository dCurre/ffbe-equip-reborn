/// <reference lib="webworker" />
import { OptimizerSession } from './optimizer-session.js';

// Entry point of the optimizer Web Worker (a module worker). The messages are JSON strings, as the page has always sent them.
const session = new OptimizerSession((response) => postMessage(JSON.stringify(response)));

onmessage = (event: MessageEvent<string>) => session.handle(JSON.parse(event.data));
