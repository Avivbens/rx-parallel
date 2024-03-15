import type { ProcessDirection } from './process-direction.model'
import type { StoreType } from './store-type.enum'

export interface IParallelPullOptions<T = unknown, K = unknown> {
    /**
     * Number of concurrent calls in the pull
     */
    concurrency: number

    /**
     * Callback to be called when each item is been processed - the process itself
     * @param item - processed item
     */
    handler: (item: T) => K | Promise<K>

    /**
     * Options for how the pull will be stored
     * @default { storeType: StoreType.IN_MEMORY }
     */
    storeOptions?: IStoreOptions<T>

    /**
     * Which direction to process the payload
     * @default 'fifo'
     */
    processDirection?: ProcessDirection

    /**
     * If true, the pull will consume all the items in the pull, even if an item is undefined
     * @default false
     */
    allowUndefinedItems?: boolean

    /**
     * Callback for each item done processing
     * @param item - processed item
     * @param result - result of processing
     */
    onItemDone?: (item: T, result: K) => void

    /**
     * Callback for each item fail processing
     * @param item - processed item
     * @param error - error of processing
     */
    onItemFail?: (item: T, error: Error) => void
}

type IStoreOptions<T> = WithRedisOptions | WithInMemoryOptions<T>

interface WithRedisOptions {
    /**
     * Where to store and fetch the pull from.
     * @default StoreType.IN_MEMORY
     */
    storeType: StoreType.REDIS
}

interface WithInMemoryOptions<T = unknown> {
    /**
     * Where to store and fetch the pull from.
     * @default StoreType.IN_MEMORY
     */
    storeType: StoreType.IN_MEMORY

    /**
     * Initial value in the pull to consume
     */
    initialPull?: T[]
}
