import { catchError, filter, finalize, of, skip, Subject, Subscription, switchMap, take, tap, timeout } from 'rxjs'
import { IExecutionOptions, ProcessDirection } from '../models'
import { buildMergedObject } from '../utils/merge-objects'
import { DEFAULT_EXECUTION_OPTIONS } from './default'

export class Parallel {
    /**
     * T - type of payload item
     * K - type of handler result item
     */
    public static execute<T = unknown, K = unknown>(options: IExecutionOptions<T, K>): Subscription {
        const { onDone, onItemDone, onItemFail, handler, timeout, payload, processDirection, concurrency } =
            buildMergedObject<IExecutionOptions<T, K>, IExecutionOptions<T, K>>(DEFAULT_EXECUTION_OPTIONS, options)

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
                <number>timeout,
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
        timeoutTime: number,
        onItemDone?: (item: T, result: K) => void,
        onItemFail?: (error: Error) => void,
    ) {
        const callsPipe: Subject<T> = new Subject<T>()

        const execution$ = callsPipe.asObservable().pipe(
            timeout(timeoutTime),
            switchMap(async (item) => {
                const res = await handler(item as T)
                onItemDone?.(item as T, res)
            }),
            catchError((error) => {
                onItemFail?.(error)
                return of(null)
            }),
            tap(() => {
                const next = processDirection === 'fifo' ? payload.shift() : payload.pop()
                next ? callsPipe.next(next) : callsPipe.complete()
            }),
        )

        return { execution$, callsPipe }
    }
}
