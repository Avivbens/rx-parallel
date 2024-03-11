import type { Observable } from 'rxjs'
import { Subscription, concatMap, take } from 'rxjs'
import { Subject, filter, switchMap, tap, BehaviorSubject } from 'rxjs'
import type { IParallelPullOptions } from '../models/parallel-pull.model'
import { StoreType } from '../models/store-type.enum'
import type { ProcessDirection } from '../models/process-direction.model'
import { merge } from 'lodash'
import { DEFAULT_EXECUTION_OPTIONS } from './default'

export class ParallelPull<T = unknown> {
    private FORCE_STOP: boolean
    private readonly mainPull: BehaviorSubject<T[]> = new BehaviorSubject<T[]>([])
    private readonly idleExecutions: Record<number, boolean> = {}
    private executions$: { execution$: Observable<void>; callsPipe: Subject<T> }[]

    private readonly subs: Subscription = new Subscription()

    private readonly tasksInjector: Subject<number> = new Subject<number>()

    private readonly options: IParallelPullOptions<T>
    constructor(options: IParallelPullOptions<T>) {
        this.options = options
        this.createPull(options)
    }

    public start(): void {
        this.initTasksInjector(this.options.processDirection || DEFAULT_EXECUTION_OPTIONS.processDirection)

        const { concurrency } = this.options
        Array.from({ length: concurrency }).forEach((_, index) => {
            const sub = this.executions$[index].execution$.subscribe()
            this.tasksInjector.next(index)

            this.subs.add(sub)
        })
    }

    // TODO - implement
    public stop(): void {
        this.FORCE_STOP = true
    }

    public add(payload: T[] | T): void {
        const tasksToAdd = Array.isArray(payload) ? payload : [payload]
        const exists = this.mainPull.getValue()

        const res = [...exists, ...tasksToAdd]
        this.mainPull.next(res)
    }

    private createPull(options: IParallelPullOptions<T>): void {
        const { storeType } = options
        const { concurrency, onItemDone, onItemFail, handler } = merge<
            object,
            Required<Omit<IParallelPullOptions, 'concurrency' | 'handler'>>,
            IParallelPullOptions<T>
        >({}, DEFAULT_EXECUTION_OPTIONS, options)

        const executions$ = Array.from({ length: concurrency }, (_, index) => {
            this.idleExecutions[index] = true
            const execution$ = this.createExecution(handler, index, onItemDone, onItemFail)
            return execution$
        })

        this.executions$ = executions$

        if (!storeType || storeType === StoreType.IN_MEMORY) {
            const { initialPull } = options

            if (initialPull?.length) {
                this.mainPull.next(initialPull)
            }
        }
    }

    private initTasksInjector(processDirection: ProcessDirection): void {
        this.tasksInjector
            .pipe(
                concatMap((injectToIndex) =>
                    this.mainPull.pipe(
                        filter((items) => items.length > 0),
                        take(1),
                        tap((items) => {
                            const toInject = processDirection === 'fifo' ? items.shift() : items.pop()
                            if (toInject === undefined) {
                                return
                            }

                            this.mainPull.next(items)
                            this.executions$[injectToIndex].callsPipe.next(toInject)
                            this.idleExecutions[injectToIndex] = false
                        }),
                    ),
                ),
            )
            .subscribe()
    }

    private createExecution<T = unknown, K = unknown>(
        handler: (payload: T) => K | Promise<K>,
        index: number,
        onItemDone: (item: T, result: K) => void,
        onItemFail: (item: T, error: Error) => void,
    ): { execution$: Observable<void>; callsPipe: Subject<T> } {
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
                this.tasksInjector.next(index)
                this.idleExecutions[index] = true
            }),
        )

        return { execution$, callsPipe }
    }
}
