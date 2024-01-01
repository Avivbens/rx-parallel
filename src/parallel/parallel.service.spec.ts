/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Subject, debounceTime, finalize, skip, take, tap } from 'rxjs'
import { Parallel } from './parallel.service'

describe('Parallel', () => {
    describe('execute', () => {
        it('should call onDone at the end - concurrency is lower then length', (done) => {
            const callFn = jest.fn()
            const failFn = jest.fn()
            const payload = [0, 1, 2, 3]
            const length = payload.length

            Parallel.execute({
                handler: async (item) => {
                    callFn(item)
                    return new Promise((resolve) => setTimeout(resolve, 5))
                },
                concurrency: 2,
                payload,
                onItemFail: failFn,
                onDone: () => {
                    expect(callFn).toBeCalledTimes(length)
                    expect(failFn).toBeCalledTimes(0)
                    done()
                },
            })
        })

        it('should call onDone at the end - concurrency is higher then length', (done) => {
            const callFn = jest.fn()
            const failFn = jest.fn()
            const payload = [0, 1, 2, 3]
            const length = payload.length

            Parallel.execute({
                handler: async (item) => {
                    callFn(item)
                    return new Promise((resolve) => setTimeout(resolve, 5))
                },
                concurrency: 10,
                payload,
                onItemFail: failFn,
                onDone: () => {
                    expect(callFn).toBeCalledTimes(length)
                    expect(failFn).toBeCalledTimes(0)
                    done()
                },
            })
        })

        it('should escape and execute onDone when payload is empty', (done) => {
            const callFn = jest.fn()
            const failFn = jest.fn()
            const payload: any[] = []
            const length = payload.length

            Parallel.execute({
                handler: async (item) => {
                    callFn(item)
                    return new Promise((resolve) => setTimeout(resolve, 5))
                },
                concurrency: 10,
                payload,
                onItemFail: failFn,
                onDone: () => {
                    expect(callFn).toBeCalledTimes(length)
                    expect(failFn).toBeCalledTimes(0)
                    done()
                },
            })
        })

        it('should escape and execute onDone when payload is 1 object', (done) => {
            const callFn = jest.fn()
            const failFn = jest.fn()
            const payload = [1]
            const length = payload.length

            Parallel.execute({
                handler: async (item) => {
                    callFn(item)
                    return new Promise((resolve) => setTimeout(resolve, 5))
                },
                concurrency: 10,
                payload,
                onItemFail: failFn,
                onDone: () => {
                    expect(callFn).toBeCalledTimes(length)
                    expect(failFn).toBeCalledTimes(0)
                    done()
                },
            })
        })

        it('should call onItemFail on promise reject', (done) => {
            const callFn = jest.fn()
            const failFn = jest.fn()
            const payload = [0, 1, 2, 3]
            const length = payload.length

            Parallel.execute({
                handler: async (item) => {
                    callFn(item)
                    return new Promise((_, reject) => setTimeout(reject, 5))
                },
                payload,
                onItemFail: failFn,
                onDone: () => {
                    expect(callFn).toBeCalledTimes(length)
                    expect(failFn).toBeCalledTimes(length)
                    done()
                },
            })
        })

        it('should setup 100 items parallel', (done) => {
            const callFn = jest.fn()
            const failFn = jest.fn()
            const payload = Array.from({ length: 1000 }, (_, i) => i)
            const length = payload.length
            const concurrency = 100

            const checker$ = new Subject()
            const expectedChunksTriggered = length / concurrency
            let chunksTriggered = 0

            checker$
                .asObservable()
                .pipe(
                    debounceTime(10),
                    tap(() => {
                        chunksTriggered++
                    }),
                    skip(expectedChunksTriggered - 1),
                    take(1),
                )
                .subscribe()

            Parallel.execute({
                concurrency,
                handler: async (item) => {
                    callFn(item)
                    checker$.next(item)
                    await new Promise((resolve) => setTimeout(resolve, 50))
                },
                payload,
                onItemFail: failFn,
                onDone: () => {
                    expect(callFn).toBeCalledTimes(length)
                    expect(chunksTriggered).toEqual(expectedChunksTriggered)
                    expect(failFn).toBeCalledTimes(0)
                    done()
                },
            })
        })
    })

    describe('_createExecution', () => {
        it('should call as times as payload, call complete', (done) => {
            const failFn = jest.fn()
            const callFn = jest.fn()
            const doneFn = jest.fn()

            const payload = [0, 1, 2, 3]
            const length = payload.length

            // @ts-expect-error
            const { callsPipe, execution$ } = Parallel._createExecution<number, void>(
                payload,
                async (p) => {
                    callFn(p)
                    return new Promise((resolve) => setTimeout(resolve, 5))
                },
                'fifo',
                doneFn,
                failFn,
            )

            jest.spyOn(callsPipe, 'complete')

            execution$
                .pipe(
                    finalize(() => {
                        expect(callFn).toBeCalledTimes(length)
                        expect(doneFn).toBeCalledTimes(length)
                        expect(failFn).toBeCalledTimes(0)
                        expect(callsPipe.complete).toBeCalledTimes(1)
                        done()
                    }),
                )
                .subscribe()

            callsPipe.next(payload.shift() as number)
        })

        it('should call onFail for promise reject', (done) => {
            const failFn = jest.fn()
            const callFn = jest.fn()
            const doneFn = jest.fn()

            const payload = [0, 1, 2, 3]
            const length = payload.length

            // @ts-expect-error
            const { callsPipe, execution$ } = Parallel._createExecution<number, void>(
                payload,
                async (p) => {
                    callFn(p)
                    return new Promise((_, reject) => setTimeout(reject, 5))
                },
                'fifo',
                doneFn,
                failFn,
            )

            jest.spyOn(callsPipe, 'complete')

            execution$
                .pipe(
                    finalize(() => {
                        expect(callFn).toBeCalledTimes(length)
                        expect(failFn).toBeCalledTimes(length)
                        expect(doneFn).toBeCalledTimes(0)
                        expect(callsPipe.complete).toBeCalledTimes(1)
                        done()
                    }),
                )
                .subscribe()

            callsPipe.next(payload.shift() as number)
        })
    })
})
