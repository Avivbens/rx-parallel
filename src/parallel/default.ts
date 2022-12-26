import { IExecutionOptions } from '../models/execution-options.model'

export const DEFAULT_EXECUTION_OPTIONS: Required<Omit<IExecutionOptions, 'payload' | 'handler'>> = {
    concurrency: 1,
    onDone: () => {},
    onItemDone: () => {},
    onItemFail: () => {},
    processDirection: 'fifo',
}
