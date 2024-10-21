import { Pool, PoolConfig } from "pg"
import { parseDbMessage } from "./types"
import {
  archiveQuery,
  createQueueQuery,
  createSchemQuery,
  deleteQuery,
  deleteQueueQuery,
  deleteSchemaQuery,
  readQuery,
  sendQuery,
} from "./queries"
import { Queue } from "./queue"

// https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS
const NAMELEN = 64
const BIGGEST_CONCAT = "archived_at_idx_"
const MAX_PGMQ_QUEUE_LEN = NAMELEN - 1 - BIGGEST_CONCAT.length

/** This is the central class this library exports
 * @constructor requires a valid PG connection string. Example: postgresql://user:password@localhost:5432/pgmq  **/
export class Pgmq {
  private pool: Pool

  public constructor(config: string | PoolConfig) {
    this.pool = new Pool(
      typeof config === "string" ? { connectionString: config } : config
    )
  }

  public async createSchema() {
    const connection = await this.pool.connect()
    await connection.query(createSchemQuery())
  }

  public async deleteSchema() {
    const connection = await this.pool.connect()
    await connection.query(deleteSchemaQuery())
  }

  /**
   * Creates a queue and a matching archive if does not exist. If queue or archive already exist does not throw error
   * @param name - the name of the queue
   * **/
  public async createQueue(name: string) {
    validateQueueName(name)
    const connection = await this.pool.connect()
    const query = createQueueQuery(name)
    await connection.query(query)
    connection.release()
  }

  public getQueue(name: string) {
    return new Queue(this.pool, name)
  }

  /**
   * Deletes a queue and its matching archive if exists. If queue or archive do not exist does not throw error
   * @param name - the name of the queue
   * **/
  public async deleteQueue(name: string) {
    const connection = await this.pool.connect()
    const query = deleteQueueQuery(name)
    await connection.query(query)
    connection.release()
  }

  /**
   * Write a message to the queue.
   * If queue doesn't exist, will throw error. See [createQueue]{@link createQueue}
   * @param queue - the name of the queue to send the message to.
   * @param message - the object to put as the payload of the message.
   * @param vt - the visibility timeout of the message. The visibility timeout
   * defines the time a message will stay hidden after being saved.
   * @return the id of the message that was created
   * **/
  public async sendMessage<T>(queue: string, message: T, vt = 0) {
    const connection = await this.pool.connect()

    const query = sendQuery(queue, vt)
    const res = await connection.query(query, [JSON.stringify(message)])
    connection.release()
    return parseInt(res.rows[0].msg_id)
  }

  /**
   * Read a message from the queue
   * @param queue - the name of the queue
   * @param vt - the visibility timeout of the message. The visibility timeout
   * defines the time a message will stay hidden after being retrieved, allowing other
   * consumers to process it later if it was not removed from the queue
   * @return the whole [message]{@link Message}, including the id, read count and the actual message within
   */
  public async readMessage<T>(queue: string, vt: number) {
    const connection = await this.pool.connect()
    const query = readQuery(queue, vt)
    const msg = await connection.query(query)
    connection.release()
    return parseDbMessage<T>(msg.rows[0])
  }

  /**
   * Delete a message from the queue
   * @param queue - the name of the queue
   * @param id - the id of the message to delete
   * @return the id of the message that was created
   */
  public async deleteMessage(queue: string, id: number) {
    const query = deleteQuery(queue, id)
    const connection = await this.pool.connect()
    const msg = await connection.query(query)
    connection.release()
    return parseInt(msg.rows[0].msg_id)
  }

  /**
   * Archives a message from the queue to its matching archive
   * @param queue - the name of the queue / archive
   * @param id - the id of the message to delete
   * @return the id of the message that was created
   */
  public async archiveMessage(queue: string, id: number): Promise<number> {
    const query = archiveQuery(queue, id)
    const connection = await this.pool.connect()
    const msg = await connection.query(query)
    connection.release()
    return parseInt(msg.rows[0].msg_id)
  }
}

const validateQueueName = (name: string) => {
  if (name.length > MAX_PGMQ_QUEUE_LEN) {
    throw new Error("Queue name is too long")
  }
  const alphanumericRegex = /^[a-zA-Z0-9_]+$/
  if (!alphanumericRegex.test(name)) {
    throw new Error(
      `Queue name must be made of only alphanumeric characters and the '_' character`
    )
  }
}
