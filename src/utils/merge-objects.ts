export function buildMergedObject<T = unknown, K = unknown>(obj1: any, obj2: any): T & K {
    const mergedObject = { ...obj1, ...obj2 }
    const keys = Object.keys(mergedObject)

    keys.forEach((key) => {
        if (mergedObject[key] instanceof Array) {
            mergedObject[key] = [...mergedObject[key]]
        }
    })

    return mergedObject
}
