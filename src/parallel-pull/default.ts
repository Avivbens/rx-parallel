/* eslint-disable @typescript-eslint/no-empty-function */
import type { IParallelPullOptions } from '../models/parallel-pull.model'
import { StoreType } from '../models/store-type.enum'

export const DEFAULT_EXECUTION_OPTIONS: Required<Omit<IParallelPullOptions, 'concurrency' | 'handler'>> = {
    onItemDone: () => {},
    onItemFail: () => {},
    processDirection: 'fifo',
    storeType: StoreType.IN_MEMORY,
}
