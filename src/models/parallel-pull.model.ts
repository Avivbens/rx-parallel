import type { ProcessDirection } from './process-direction.model'
import type { StoreType } from './store-type.enum'

export type IParallelPullOptions<T = unknown, K = unknown> = (WithRedisOptions | WithInMemoryOptions<T>) & {
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
     * Which direction to process the payload
     * @default 'fifo'
     */
    processDirection?: ProcessDirection

    /**
     * Callback for each item done processing
     * @param item - processed item
     * @param result - result of processing
     */
    onItemDone?: (item: T, result: K) => void

    /**
     * Callback for each item fail processing
     * @param error - error of processing
     */
    onItemFail?: (item: T, error: Error) => void
}

interface WithRedisOptions {
    /**
     * Where to store and fetch the pull from.
     * @default StoreType.IN_MEMORY
     */
    storeType: StoreType.REDIS
}

interface WithInMemoryOptions<T = unknown> {
    storeType?: StoreType.IN_MEMORY

    /**
     * Initial value in the pull to consume
     */
    initialPull?: T[]
}
