import { IExecutionOptions } from './execution-options.model'

export interface IExecutionWorkerOptions<T = unknown, K = unknown>
    extends Omit<IExecutionOptions<T, K>, 'handler' | 'onItemDone' | 'onItemFail'> {
    filePathHandler: string
    workerId: number
}
