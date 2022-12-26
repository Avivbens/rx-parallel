import { Subject, Subscription, filter, finalize, skip, switchMap, take, tap } from 'rxjs'
import { IExecutionOptions, ProcessDirection } from '../models/execution-options.model'
import { buildMergedObject } from '../utils'
import { DEFAULT_EXECUTION_OPTIONS } from './default'

export class Parallel {
    /**
     * T - type of payload item
     * K - type of handler return value
     */
    public static execute<T = unknown, K = unknown>(options: IExecutionOptions<T, K>): Subscription {
        const { onDone, onItemDone, onItemFail, handler, payload, processDirection, concurrency } = buildMergedObject<
            IExecutionOptions<T, K>,
            IExecutionOptions<T, K>
        >(DEFAULT_EXECUTION_OPTIONS, options)

        const firstItems =
            processDirection === 'fifo'
                ? payload.splice(0, concurrency)
                : payload.splice(payload.length - <number>concurrency, concurrency)

        const executions$: Subscription = new Subscription()
        const isDoneChecker$ = new Subject<boolean>()

        isDoneChecker$
            .pipe(
                filter((isDone) => isDone),
                skip(<number>concurrency - 1),
                take(1),
                switchMap(async () => onDone?.()),
            )
            .subscribe()

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
        onItemFail?: (error: Error) => void,
    ) {
        const callsPipe: Subject<T> = new Subject<T>()

        const execution$ = callsPipe.asObservable().pipe(
            switchMap(async (item: T) => {
                try {
                    const res = await handler(item)
                    onItemDone?.(item, res)
                } catch (error) {
                    onItemFail?.(error as Error)
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
