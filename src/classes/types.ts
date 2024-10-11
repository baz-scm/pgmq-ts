export interface Types<T> {
  msgId: number
  readCount: number
  enqueuedAt: Date
  vt: Date
  message: T
}

interface DbMessage {
  msg_id: string
  read_ct: string
  enqueued_at: string
  vt: string
  message: string
}

export function parseDbMessage<T>(msg: DbMessage): Types<T> {
  if (msg == null) return msg
  return {
    msgId: parseInt(msg.msg_id),
    readCount: parseInt(msg.read_ct),
    enqueuedAt: new Date(msg.enqueued_at),
    vt: new Date(msg.vt),
    message: msg.message as T,
  }
}
