import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { parentPort, workerData } from 'node:worker_threads'
import { IWorkerMessage } from '../models'
import { IExecutionWorkerOptions } from '../models/execution-worker-options.model'
import { Parallel } from '../parallel'
;(() => {
    const { workerId, filePathHandler, ...options } = workerData as IExecutionWorkerOptions

    let current = 0

    Parallel.execute({
        ...options,
        handler: async (item: unknown) => {
            const res = await promisify(execFile)(filePathHandler, [JSON.stringify(item ?? null)])
            return res
        },
        onItemDone: (item, result) => {
            // options.onItemDone?.(item, result)
            current++

            const postMessage: IWorkerMessage = {
                workerId,
                current,
                amount: options.payload.length,
            }

            parentPort?.postMessage(postMessage)
        },
        onItemFail: (error) => {},
    })
})()
