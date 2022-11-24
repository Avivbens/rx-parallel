export function chunksSplit<T>(array: T[], chunksSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunksSize) {
        chunks.push(array.slice(i, i + chunksSize))
    }
    return chunks
}
