import { Pool } from "pg"
import { Message } from "./message"

const PGMQ_SCHEMA = "pgmq"
const QUEUE_PREFIX = "q"
const ARCHIVE_PREFIX = "a"

interface DbMessage {
  msg_id: string
  read_ct: string
  enqueued_at: string
  vt: string
  message: string
}

export class Pgmq {
  private pool: Pool

  public constructor(connectionString: string) {
    this.pool = new Pool({ connectionString })
  }

  public async createSchema() {
    const connection = await this.pool.connect()
    const query = `CREATE SCHEMA IF NOT EXISTS ${PGMQ_SCHEMA}`
    await connection.query(query)
  }

  public async createQueue(name: string) {
    const connection = await this.pool.connect()
    const query = `
            CREATE TABLE IF NOT EXISTS ${PGMQ_SCHEMA}.${QUEUE_PREFIX}_${name}
            (
                msg_id      BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                read_ct     INT                      DEFAULT 0     NOT NULL,
                enqueued_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
                vt          TIMESTAMP WITH TIME ZONE               NOT NULL,
                message     JSONB
            );
            CREATE TABLE IF NOT EXISTS ${PGMQ_SCHEMA}.${ARCHIVE_PREFIX}_${name}
            (
                msg_id      BIGINT PRIMARY KEY,
                read_ct     INT                      DEFAULT 0     NOT NULL,
                enqueued_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
                archived_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
                vt          TIMESTAMP WITH TIME ZONE               NOT NULL,
                message     JSONB
            );`
    await connection.query(query)
    connection.release()
  }

  public async deleteQueue(name: string) {
    const connection = await this.pool.connect()
    const query = `
            DROP TABLE IF EXISTS ${PGMQ_SCHEMA}.${QUEUE_PREFIX}_${name};
            DROP TABLE IF EXISTS ${PGMQ_SCHEMA}.${ARCHIVE_PREFIX}_${name};`
    await connection.query(query)
    connection.release()
  }

  public async sendMessage<T>(
    queue: string,
    message: T,
    vt = 0
  ): Promise<number> {
    const connection = await this.pool.connect()

    const query = `INSERT INTO ${PGMQ_SCHEMA}.${QUEUE_PREFIX}_${queue} (vt, message)
                       VALUES ((now() + interval '${vt} seconds'), $1::jsonb)
                       RETURNING msg_id;`
    const res = await connection.query(query, [JSON.stringify(message)])
    connection.release()
    return parseInt(res.rows[0].msg_id)
  }

  public async readMessage<T>(
    queue: string,
    vt: number
  ): Promise<Message<T> | null> {
    const connection = await this.pool.connect()
    const query = `WITH cte AS
                                (SELECT msg_id
                                 FROM ${PGMQ_SCHEMA}.${QUEUE_PREFIX}_${queue}
                                 ORDER BY msg_id ASC
                                 LIMIT 1 FOR UPDATE SKIP LOCKED)
                       UPDATE ${PGMQ_SCHEMA}.${QUEUE_PREFIX}_${queue} t
                       SET vt      = now() + interval '${vt} seconds',
                           read_ct = read_ct + 1
                       FROM cte
                       WHERE t.msg_id = cte.msg_id
                       RETURNING *;`
    const msg = await connection.query(query)
    connection.release()
    return this.parseDbMessage<T>(msg.rows[0])
  }

  public async deleteMessage(queue: string, id: number) {
    const query = `DELETE
                       FROM ${PGMQ_SCHEMA}.${QUEUE_PREFIX}_${queue}
                       WHERE msg_id = ${id}
                       RETURNING msg_id;`
    const connection = await this.pool.connect()
    const msg = await connection.query(query)
    connection.release()
    return parseInt(msg.rows[0].msg_id)
  }

  public async archiveMessage(queue: string, id: number): Promise<number> {
    const query = `WITH archived AS (
            DELETE FROM ${PGMQ_SCHEMA}.${QUEUE_PREFIX}_${queue}
                WHERE msg_id = ${id}
                RETURNING msg_id, vt, read_ct, enqueued_at, message)
                       INSERT
                       INTO ${PGMQ_SCHEMA}.${ARCHIVE_PREFIX}_${queue} (msg_id, vt, read_ct, enqueued_at, message)
                       SELECT msg_id, vt, read_ct, enqueued_at, message
                       FROM archived
                       RETURNING msg_id;`
    const connection = await this.pool.connect()
    const msg = await connection.query(query)
    connection.release()
    return parseInt(msg.rows[0].msg_id)
  }

  parseDbMessage<T>(msg: DbMessage): Message<T> {
    if (msg == null) return msg
    return {
      msgId: parseInt(msg.msg_id),
      readCount: parseInt(msg.read_ct),
      enqueuedAt: new Date(msg.enqueued_at),
      vt: new Date(msg.vt),
      message: msg.message as T,
    }
  }
}
