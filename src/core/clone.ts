/** Deep copy of plain JSON data (battle state holds no functions, Maps or undefined). */
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
