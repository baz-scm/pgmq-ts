export interface Message<T> {
  msgId: number
  readCount: number
  enqueuedAt: Date
  vt: Date
  message: T
}
