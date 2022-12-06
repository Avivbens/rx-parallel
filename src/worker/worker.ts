import { IExecutionOptions } from '@models/execution-options.model'
import { IWorkerMessage } from '@models/worker-message.model'
import { parentPort, workerData } from 'node:worker_threads'
import { Parallel } from '../parallel'
;(() => {
    const { workerId, ...options } = workerData as IExecutionOptions & { workerId: number }

    let current = 0

    Parallel.execute({
        ...options,
        onItemDone: (item, result) => {
            options.onItemDone?.(item, result)
            current++

            const postMessage: IWorkerMessage = {
                workerId,
                current,
                amount: options.payload.length,
            }

            parentPort?.postMessage(postMessage)
        },
    })
})()
