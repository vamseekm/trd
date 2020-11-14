export async function objectOfPromises<T>(objPromises: Record<string, Promise<T>>): Promise<Record<string, T>> {
    const keys = Object.keys(objPromises);
    const promiseList = keys.map((key) => objPromises[key]);
    const values = await Promise.all(promiseList);
    const results: Record<string, T> = {};
    keys.forEach((key, i) => {
        results[key] = values[i];
    });
    return results;
}
