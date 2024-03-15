import { setTimeout as setTimeoutPrm } from 'node:timers/promises'
import { debounceTime, filter, tap } from 'rxjs'
import { StoreType } from '../models'
import { ParallelPull } from './parallel-pull.service'

describe('ParallelPull', () => {
    beforeEach(() => {
        jest.resetAllMocks()
        jest.clearAllMocks()
    })

    describe('start', () => {
        it('should keep the pull alive after done with tasks, process more tasks and then close', (done) => {
            const spy = jest.fn()
            const instance = new ParallelPull<typeof spy>({
                concurrency: 3,
                handler: spy,
            })

            instance.start()

            const payload1 = Array.from({ length: 100 }, () => spy)
            instance.add(payload1)

            setTimeout(() => {
                const payload2 = Array.from({ length: 80 }, () => spy)
                instance.add(payload2)
            }, 1000)

            expectHelper(instance, () => {
                expect(spy).toBeCalledTimes(180)
                done()
            })
        })

        it('should check the order of the calls - fifo', (done) => {
            const spy = jest.fn()
            const instance = new ParallelPull<number>({
                concurrency: 3,
                processDirection: 'fifo',
                handler: spy,
            })

            instance.start()

            const payload1 = Array.from({ length: 100 }, (_, index) => index)
            instance.add(payload1)

            const payload2 = Array.from({ length: 80 }, (_, index) => 100 + index)
            instance.add(payload2)

            expectHelper(instance, () => {
                expect(spy).toBeCalledTimes(180)
                const calledWithParams = spy.mock.calls.map(([param]) => param)
                const expected = [...payload1, ...payload2]

                expect(calledWithParams).toEqual(expected)

                done()
            })
        })

        it('should check the order of the calls - lifo', (done) => {
            const spy = jest.fn()
            const instance = new ParallelPull<number>({
                concurrency: 10,
                processDirection: 'lifo',
                handler: spy,
            })

            instance.start()

            const payload1 = Array.from({ length: 100 }, (_, index) => index)
            instance.add(payload1)

            const payload2 = Array.from({ length: 80 }, (_, index) => 100 + index)
            setTimeout(() => {
                instance.add(payload2)
            }, 1000)

            expectHelper(instance, () => {
                expect(spy).toBeCalledTimes(180)
                const calledWithParams = spy.mock.calls.map(([param]) => param)
                const expected = [...payload1.reverse(), ...payload2.reverse()]

                expect(calledWithParams).toEqual(expected)

                done()
            })
        })

        it('should handle undefined values over the queue, ignore them and keep process the pull', (done) => {
            const spy = jest.fn()
            const instance = new ParallelPull<number | undefined>({
                concurrency: 10,
                handler: spy,
            })

            instance.start()

            const payload1 = Array.from({ length: 100 }, (_, index) => index)
            const payload2 = Array.from({ length: 80 }, () => undefined)

            const combinedPayload = [...payload1, ...payload2]
            const shuffledPayload = combinedPayload.sort(() => Math.random() - 0.5)
            instance.add(shuffledPayload)

            expectHelper(instance, () => {
                expect(spy).toBeCalledTimes(payload1.length)
                done()
            })
        })
    })

    describe('stop - resume', () => {
        it('should stop the current queue, keeping all queue as is', (done) => {
            const spy = jest.fn()
            const instance = new ParallelPull<number>({
                concurrency: 10,
                handler: async (number) => {
                    await setTimeoutPrm(100)
                    spy(number)
                },
            })

            instance.start()

            const payloadLength = 150
            const payload1 = Array.from({ length: payloadLength }, (_, index) => index)
            instance.add(payload1)

            setTimeout(() => {
                instance.stop()

                const called = spy.mock.calls.length
                expect(called).toBeLessThan(payloadLength)

                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                expect(instance.mainPull.getValue().length).toBeGreaterThan(0)

                done()
            }, 1000)
        })

        it('should stop the current queue, and resume - queue still exists', (done) => {
            const spy = jest.fn()
            const instance = new ParallelPull<number>({
                concurrency: 10,
                handler: async (number) => {
                    await setTimeoutPrm(100)
                    spy(number)
                },
            })

            instance.start()

            const payloadLength = 150
            const payload1 = Array.from({ length: payloadLength }, (_, index) => index)
            instance.add(payload1)

            setTimeout(() => {
                instance.stop()
            }, 300)

            setTimeout(() => {
                instance.resume()
            }, 600)

            expectHelper(instance, () => {
                const called = spy.mock.calls.length
                expect(called).toBe(payloadLength)

                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                expect(instance.mainPull.getValue().length).toBe(0)

                done()
            })
        })
    })

    describe('add', () => {
        it('should add the payload to the queue', (done) => {
            const spy = jest.fn()
            const instance = new ParallelPull<number>({
                concurrency: 10,
                handler: spy,
            })

            instance.start()

            const payloadLength = 150
            const payload1 = Array.from({ length: payloadLength }, (_, index) => index)
            instance.add(payload1)

            expectHelper(instance, () => {
                expect(spy).toBeCalledTimes(payloadLength)
                done()
            })
        })

        it('should add the payload to the existing initial pull', (done) => {
            const spy = jest.fn()
            const payloadLength = 150

            const initialPull = Array.from({ length: payloadLength }, (_, index) => index)
            const instance = new ParallelPull<number>({
                concurrency: 10,
                handler: spy,
                processDirection: 'fifo',
                storeOptions: {
                    storeType: StoreType.IN_MEMORY,
                    initialPull,
                },
            })

            instance.start()

            const payload1 = Array.from({ length: payloadLength }, (_, index) => index)
            instance.add(payload1)

            expectHelper(instance, () => {
                expect(spy).toBeCalledTimes(payloadLength * 2)
                done()
            })
        })
    })

    describe('drain', () => {
        it('should drain the queue', (done) => {
            const spy = jest.fn()
            const instance = new ParallelPull<number>({
                concurrency: 5,
                handler: async () => {
                    await setTimeoutPrm(100)
                    spy()
                },
            })

            instance.start()

            const payloadLength = 150
            const payload1 = Array.from({ length: payloadLength }, (_, index) => index)
            instance.add(payload1)

            setTimeout(() => {
                instance.drain()
            }, 1000)

            expectHelper(instance, () => {
                const calls = spy.mock.calls.length
                expect(calls).toBeLessThan(payloadLength)
                expect(calls).toBeGreaterThan(0)

                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                expect(instance.mainPull.getValue().length).toEqual(0)
                done()
            })
        })
    })

    describe('close', () => {
        it('should close the queue', (done) => {
            const spy = jest.fn()
            const instance = new ParallelPull<number>({
                concurrency: 5,
                handler: async () => {
                    await setTimeoutPrm(100)
                    spy()
                },
            })

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            jest.spyOn(instance.subs, 'unsubscribe')
            jest.spyOn(instance, 'drain')

            instance.start()

            const payloadLength = 150
            const payload1 = Array.from({ length: payloadLength }, (_, index) => index)
            instance.add(payload1)

            setTimeout(() => {
                instance.close()
            }, 1000)

            expectHelper(instance, () => {
                expect(instance.drain).toBeCalledTimes(1)

                const calls = spy.mock.calls.length
                expect(calls).toBeLessThan(payloadLength)
                expect(calls).toBeGreaterThan(0)

                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                expect(instance.subs.unsubscribe).toBeCalledTimes(1)

                done()
            })
        })
    })
})

function expectHelper(instance: ParallelPull<any>, check: () => void) {
    const sub = instance.onIdleChanged
        .pipe(
            debounceTime(2000),
            filter((idle) => idle),
            tap(() => {
                check()
                sub.unsubscribe()
            }),
        )
        .subscribe()
}
