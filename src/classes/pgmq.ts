import { Pool } from "pg"
import { parseDbMessage } from "./types"
import {
  archiveQuery,
  createQueueQuery,
  createSchemaQuery,
  deleteQuery,
  deleteQueueQuery,
  deleteSchemaQuery,
  readQuery,
  sendQuery,
  readMessageByGroupIdQuery,
  readAllMessagesByGroupIdQuery,
  deleteMessagesByIdsQuery,
} from "./queries"
import { Queue } from "./queue"
import { executeQueryWithTransaction } from "./utils"

const NAMELEN = 64
const BIGGEST_CONCAT = "archived_at_idx_"
const MAX_PGMQ_QUEUE_LEN = NAMELEN - 1 - BIGGEST_CONCAT.length

/** This is the central class this library exports
 * @constructor requires a valid PG connection string. Example: postgresql://user:password@localhost:5432/pgmq  **/
export class Pgmq {
  private readonly pool: Pool

  public constructor(connectionString: string) {
    this.pool = new Pool({ connectionString })
  }

  public async end() {
    await this.pool.end()
  }

  public async createSchema() {
    await this.pool.query(createSchemaQuery())
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
   * @return the whole [message]{@link Message}, including the id, read count and the actual message within if exists
   */
  public async readMessage<T>(queue: string, vt: number) {
    const query = readQuery(queue, vt)
    const result = await executeQueryWithTransaction(this.pool, query)
    if (result.rows.length > 0) {
      return parseDbMessage<T>(result.rows[0])
    }
    return null
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

  /**
   * Read a message from the queue using Group FIFO pattern.
   * Returns the single oldest available message across all groups where the oldest message is not in progress.
   * If a group's oldest message is in progress (vt in future), that entire group is skipped.
   * This allows parallel processing of different groups while maintaining FIFO within each group.
   * @param queue - the name of the queue
   * @param groupIdPath - JSON path to the group ID field (e.g., ['pr_id'] or ['metadata', 'group_id'])
   * @param vt - the visibility timeout of the message
   * @return the oldest available message, or null if none available
   */
  public async readMessageByGroupId<T>(
    queue: string,
    groupIdPath: string[],
    vt: number
  ) {
    const jsonPath = `{${groupIdPath.join(",")}}`
    const query = readMessageByGroupIdQuery(queue, vt)
    const result = await executeQueryWithTransaction(this.pool, query, [
      jsonPath,
    ])
    if (result.rows.length > 0) {
      return parseDbMessage<T>(result.rows[0])
    }
    return null
  }

  /**
   * Read ALL messages from the queue for a specific group ID (Group FIFO pattern).
   * Ignores visibility timeout and returns all messages for the group, ordered by msg_id.
   * Use this when you want to process all remaining messages for a group you're already working on.
   * @param queue - the name of the queue
   * @param groupIdPath - JSON path to the group ID field (e.g., ['pr_id'] or ['metadata', 'group_id'])
   * @param groupIdValue - the value of the group ID to filter by
   * @param vt - the visibility timeout to set for all messages
   * @return array of all messages for this group
   */
  public async readAllMessagesByGroupId<T>(
    queue: string,
    groupIdPath: string[],
    groupIdValue: string,
    vt: number
  ) {
    const jsonPath = `{${groupIdPath.join(",")}}`
    const query = readAllMessagesByGroupIdQuery(queue, vt)
    const result = await executeQueryWithTransaction(this.pool, query, [
      jsonPath,
      groupIdValue,
    ])
    return result.rows.map((row) => parseDbMessage<T>(row))
  }

  /**
   * Delete multiple messages by their IDs
   * @param queue - the name of the queue
   * @param ids - array of message IDs to delete
   * @return array of deleted message IDs
   */
  public async deleteMessagesByIds(
    queue: string,
    ids: number[]
  ): Promise<number[]> {
    const query = deleteMessagesByIdsQuery(queue)
    const result = await executeQueryWithTransaction(this.pool, query, [ids])
    return result.rows.map((row) => parseInt(row.msg_id))
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
