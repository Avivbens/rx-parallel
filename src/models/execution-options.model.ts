export type ProcessDirection = 'fifo' | 'lifo'

export interface IExecutionOptions<T = unknown, K = unknown> {
    /**
     * Number of concurrent calls
     * @default 1
     */
    concurrency?: number

    /**
     * Payload to be processed
     */
    payload: T[]

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
     * Callback for done processing
     */
    onDone?: () => void

    /**
     * Callback for each item done processing
     * @param item - processed item
     * @param result - result of processing
     */
    onItemDone?: (item: unknown, result: unknown) => void

    /**
     * Callback for each item fail processing
     * @param error - error of processing
     */
    onItemFail?: (error: Error) => void
}
