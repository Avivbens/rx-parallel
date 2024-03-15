/* eslint-disable @typescript-eslint/no-empty-function */
import { StoreType } from '../models'
import type { IParallelPullOptions } from '../models/parallel-pull.model'

export const DEFAULT_EXECUTION_OPTIONS: Required<Omit<IParallelPullOptions, 'concurrency' | 'handler'>> = {
    onItemDone: () => {},
    onItemFail: () => {},
    processDirection: 'fifo',
    storeOptions: {
        storeType: StoreType.IN_MEMORY,
    },
    allowUndefinedItems: false,
}
