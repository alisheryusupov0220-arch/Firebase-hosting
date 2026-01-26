import { EventEmitter } from 'events';

// A simple event emitter to bubble up Firebase errors to a listener component.
export const errorEmitter = new EventEmitter();
