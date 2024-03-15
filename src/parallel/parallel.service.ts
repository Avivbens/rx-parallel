import { merge } from 'lodash'
import { Subject, Subscription, filter, finalize, skip, switchMap, take, tap } from 'rxjs'
import type { IExecutionOptions } from '../models/execution-options.model'
import type { ProcessDirection } from '../models/process-direction.model'
import { DEFAULT_EXECUTION_OPTIONS } from './default'

export class Parallel {
    /**
     * @description Executes handler for each item in payload
     * @param options - execution options
     * @returns subscription of the execution
     *
     * T - type of payload item
     * K - type of handler return value
     */
    public static execute<T = unknown, K = unknown>(options: IExecutionOptions<T, K>): Subscription {
        const { onDone, onItemDone, onItemFail, handler, payload, processDirection, concurrency } = merge<
            object,
            Required<Omit<IExecutionOptions, 'payload' | 'handler'>>,
            IExecutionOptions<T, K>
        >({}, DEFAULT_EXECUTION_OPTIONS, options)

        const limitedConcurrency: number = Math.min(payload.length, concurrency)

        const firstItems =
            processDirection === 'fifo'
                ? payload.splice(0, limitedConcurrency)
                : payload.splice(payload.length - limitedConcurrency, limitedConcurrency)

        const executions$: Subscription = new Subscription()
        const isDoneChecker$ = new Subject<boolean>()

        if (limitedConcurrency === 0) {
            onDone?.()
            return executions$
        }

        isDoneChecker$
            .pipe(
                filter((isDone) => isDone),
                skip(limitedConcurrency - 1),
                take(1),
                switchMap(async () => onDone?.()),
            )
            .subscribe()

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const pipes: Subject<T>[] = firstItems.map((item) => {
            const { execution$, callsPipe } = this._createExecution<T, K>(
                payload,
                handler,
                processDirection as ProcessDirection,
                onItemDone,
                onItemFail,
            )

            const sub = execution$
                .pipe(
                    finalize(() => {
                        isDoneChecker$.next(true)
                    }),
                )
                .subscribe()

            executions$.add(sub)
            callsPipe.next(item)

            return callsPipe
        })

        return executions$
    }

    private static _createExecution<T = unknown, K = unknown>(
        payload: T[],
        handler: (payload: T) => K | Promise<K>,
        processDirection: ProcessDirection,
        onItemDone?: (item: T, result: K) => void,
        onItemFail?: (item: T, error: Error) => void,
    ) {
        const callsPipe: Subject<T> = new Subject<T>()

        const execution$ = callsPipe.asObservable().pipe(
            switchMap(async (item: T) => {
                try {
                    const res = await handler(item)
                    onItemDone?.(item, res)
                } catch (error) {
                    onItemFail?.(item, error as Error)
                }
            }),
            tap(() => {
                const next = processDirection === 'fifo' ? payload.shift() : payload.pop()
                next !== undefined ? callsPipe.next(next) : callsPipe.complete()
            }),
        )

        return { execution$, callsPipe }
    }
}
