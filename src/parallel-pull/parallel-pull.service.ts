import { merge } from 'lodash'
import type { Observable } from 'rxjs'
import { Subscription, combineLatest, concatMap, distinctUntilChanged, map, take } from 'rxjs'
import { BehaviorSubject, Subject, filter, switchMap, tap } from 'rxjs'
import type { IParallelPullOptions } from '../models/parallel-pull.model'
import { StoreType } from '../models/store-type.enum'
import { DEFAULT_EXECUTION_OPTIONS } from './default'

export class ParallelPull<T = unknown> {
    private FORCE_STOP: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false)
    private readonly mainPull: BehaviorSubject<T[]> = new BehaviorSubject<T[]>([])
    private readonly idleExecutions: BehaviorSubject<Record<number, boolean>> = new BehaviorSubject<
        Record<number, boolean>
    >({})
    private executions$: { execution$: Observable<void>; callsPipe: Subject<T> }[]

    private readonly subs: Subscription = new Subscription()

    private readonly tasksInjector: Subject<number> = new Subject<number>()

    private readonly options: Required<IParallelPullOptions<T>>
    constructor(options: IParallelPullOptions<T>) {
        const parsedOptions = merge<
            object,
            Required<Omit<IParallelPullOptions, 'concurrency' | 'handler'>>,
            IParallelPullOptions<T>
        >({}, DEFAULT_EXECUTION_OPTIONS, options)

        this.options = parsedOptions
        this.createPull()
    }

    /**
     * @description Starts the execution of the tasks.
     */
    public start(): void {
        this.initTasksInjector()

        const { concurrency } = this.options
        Array.from({ length: concurrency }).forEach((_, index) => {
            const sub = this.executions$[index].execution$.subscribe()
            this.tasksInjector.next(index)

            this.subs.add(sub)
        })
    }

    /**
     * @description Stops the execution of the tasks. The tasks that are currently running will be resolved.
     * Queued tasks will not be affected.
     */
    public stop(): void {
        this.FORCE_STOP.next(true)
    }

    /**
     * @description Resumes the execution of the tasks. If the queue is not stopped, it will not have any effect.
     */
    public resume(): void {
        this.FORCE_STOP.next(false)
    }

    /**
     * @description Adds a new task / tasks to the queue.
     * @param payload - The payload to add to the queue. It can be a single item or an array of items.
     */
    public add(payload: T[] | T): void {
        const tasksToAdd = Array.isArray(payload) ? payload : [payload]
        const exists = this.mainPull.getValue()

        const res = [...exists, ...tasksToAdd]
        this.mainPull.next(res)
    }

    /**
     * @description Removes all the tasks from the queue. The tasks that are currently running will be resolved.
     */
    public drain(): void {
        this.mainPull.next([])
    }

    /**
     * @description Closes the queue. The tasks that are currently running will be resolved.
     * Removes all the tasks from the queue.
     */
    public close(): void {
        this.drain()
        this.idleExecutions
            .asObservable()
            .pipe(
                filter((idle) => Object.values(idle).every((value: boolean) => value)),
                take(1),
                tap(() => {
                    this.subs.unsubscribe()
                }),
            )
            .subscribe()
    }

    /**
     * @description Returns true if the queue is running.
     */
    public get isRunning(): boolean {
        return !this.subs.closed
    }

    /**
     * @description Returns true if the queue is empty.
     */
    public get isDrained(): boolean {
        return this.mainPull.getValue().length === 0
    }

    /**
     * @description Returns true if the queue is closed.
     */
    public get isClosed(): boolean {
        return this.subs.closed
    }

    /**
     * @description Returns true if the queue is idle.
     */
    public get isIdle(): boolean {
        return Object.values(this.idleExecutions.getValue()).every((value: boolean) => value)
    }

    /**
     * @description Returns an observable that emits when the pull idle status changes.
     */
    public get onIdleChanged(): Observable<boolean> {
        return this.idleExecutions.asObservable().pipe(
            map((idleMap) => Object.values(idleMap).every((value: boolean) => value)),
            distinctUntilChanged(),
        )
    }

    /**
     * @description Create pull by options, and inject the initial pull if the store type is in memory.
     */
    private createPull(): void {
        const { concurrency, onItemDone, onItemFail, handler, storeOptions } = this.options

        const executions$ = Array.from({ length: concurrency }, (_, index) => {
            this.idleExecutions.next({ ...this.idleExecutions.getValue(), [index]: true })
            const execution$ = this.createExecution(handler, index, onItemDone, onItemFail)
            return execution$
        })

        this.executions$ = executions$

        /**
         * If the store type is in memory, we will inject the initial pull to the main pull
         */
        if (storeOptions.storeType === StoreType.IN_MEMORY) {
            const { initialPull } = storeOptions

            if (initialPull?.length) {
                this.mainPull.next(initialPull)
            }
        }
    }

    /**
     * @description Initializes the tasks injector.
     *
     * The tasks injector is responsible for injecting the tasks from the main pull, and inject them into the executions.
     *
     * It will also take care of the process direction.
     */
    private initTasksInjector(): void {
        const { processDirection } = this.options

        const sub = this.tasksInjector
            .pipe(
                concatMap((injectToIndex) =>
                    combineLatest([this.mainPull, this.FORCE_STOP]).pipe(
                        filter(([items, forceStop]) => items.length > 0 && !forceStop),
                        take(1),
                        tap(([items]) => {
                            const toInject = processDirection === 'fifo' ? items.shift() : items.pop()
                            this.mainPull.next(items)
                            if (toInject === undefined && !this.options.allowUndefinedItems) {
                                this.tasksInjector.next(injectToIndex)
                                return
                            }

                            this.executions$[injectToIndex].callsPipe.next(toInject as T)
                            this.idleExecutions.next({ ...this.idleExecutions.getValue(), [injectToIndex]: false })
                        }),
                    ),
                ),
            )
            .subscribe()

        this.subs.add(sub)
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
                this.idleExecutions.next({ ...this.idleExecutions.getValue(), [index]: true })
            }),
        )

        return { execution$, callsPipe }
    }
}
