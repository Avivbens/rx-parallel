# Rx-Parallel for JS and TS, using RxJS

Rx-Parallel is a library that allows you to run asynchronous tasks in parallel, using RxJS.

The library is written in TypeScript and can be used in both JavaScript and TypeScript projects.

<br>

## The idea

The idea behind this library is to allow you to run asynchronous tasks in parallel, while still being able to control the number of concurrent tasks, and to be able to handle the results of each task.

It is very useful in cases that too many executions might causing an error, like calling an API and getting [**429 HTTP ERROR - _Too Many Requests_**](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429).

<br>
<hr>

## Installation

```bash
npm install rx-parallel
```

## Usage

```typescript
import { Parallel } from 'rx-parallel'

const __wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

;(() => {
    Parallel.execute<number, void>({
        concurrency: 400,
        payload: Array.from({ length: 1000 }, (_, i) => i),
        handler: async (item) => {
            const random = Math.floor(Math.random() * 1000)
            await __wait(random)
            console.log(item)
        },
        onItemDone: (item, result) => {
            console.log(`item ${item} done with result: ${result}`)
        },
        onItemFail: (item, error) => {
            console.error(`item ${item} failed with error: ${error.stack}`)
        },
        onDone: () => {
            console.log('DONE!')
        },
    })
})()
```

<br>
<br>

## Features

Mandatory:

-   **concurrency**: The number of concurrent tasks. **By default, it is 1**.
    <br>
    In this case, it means that the tasks will be executed one by one.

-   **payload**: A payload to be processed. Should be an array.

-   **handler**: The handler function that will be executed for each item in the payload.

<br>
Optional:

-   **onDone**: A function that will be executed when all the tasks are done.

-   **onItemDone**: A function that will be executed when a specific item done the handler function.

-   **onItemFail**: A function that will be executed when an error occurs for a specific item.

-   **processDirection**: The direction of the processing of the payload. By default, it is `fifo`, but you can also specify `lifo`.
