import { IExecutionOptions, IWorkerMessage } from '../types'
import { chunksSplit } from '../utils'
import { Worker } from 'node:worker_threads'
import {
    BehaviorSubject,
    catchError,
    filter,
    fromEvent,
    of,
    skip,
    Subject,
    Subscription,
    switchMap,
    take,
    tap,
} from 'rxjs'

export class ParallelWorker {
    public static executeWithWorkers<T = unknown, K = unknown>(
        workersAmount: number,
        options: IExecutionOptions<T, K>,
    ): {
        workers: Worker[]
        subscriptions$: Subscription
        progressMap$: BehaviorSubject<Record<number, Omit<IWorkerMessage, 'workerId'>>>
    } {
        const { payload, onDone } = options
        const originalSize: number = payload.length

        const subscriptions$ = new Subscription()

        const progressMap$ = new BehaviorSubject<Record<number, Omit<IWorkerMessage, 'workerId'>>>({})

        const chunkSize: number = Math.ceil(payload.length / workersAmount)
        const chunks = chunksSplit(payload, chunkSize)

        const workers: Worker[] = Array.from(
            { length: workersAmount },
            (_, index) =>
                new Worker('./worker.ts', {
                    workerData: {
                        ...options,
                        payload: chunks[index],
                        onDone: () => {},
                        workerId: index,
                    } as IExecutionOptions<T, K> & { workerId: number },
                }),
        )

        const progressChecker$ = new Subject<IWorkerMessage>()

        progressChecker$
            .pipe(
                tap(({ workerId, current, amount }) => {
                    progressMap$.next({ ...progressMap$.getValue(), [workerId]: { current, amount } })
                }),
                skip(originalSize),
                take(1),
                switchMap(async () => onDone?.()),
                catchError(() => of(null)),
                tap(() => workers.forEach((worker) => worker.terminate())),
                tap(() => subscriptions$.unsubscribe()),
                tap(() => progressMap$.complete()),
            )
            .subscribe()

        workers.forEach((worker) => {
            const subMessage$ = fromEvent<IWorkerMessage>(worker, 'message')
                .pipe(
                    tap((message) => {
                        progressChecker$.next(message)
                    }),
                )
                .subscribe()

            const subError$ = fromEvent<Error>(worker, 'error')
                .pipe(
                    tap((error) => {
                        console.error(error)
                    }),
                )
                .subscribe()

            const subExit$ = fromEvent(worker, 'exit')
                .pipe(
                    take(1),
                    filter((code) => code !== 0),
                    tap((code) => {
                        console.error(`Worker stopped with exit code ${code}`)
                    }),
                )
                .subscribe()

            subscriptions$.add(subMessage$)
            subscriptions$.add(subError$)
            subscriptions$.add(subExit$)
        })

        return { workers, subscriptions$, progressMap$ }
    }
}
