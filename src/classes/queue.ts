import { Pool } from "pg"
import {
  archiveQuery,
  deleteQuery,
  readQuery,
  readMessageByGroupIdQuery,
  readAllMessagesByGroupIdQuery,
  deleteMessagesByIdsQuery,
} from "./queries"
import { parseDbMessage } from "./types"
import { executeQueryWithTransaction } from "./utils"

export class Queue {
  private pool: Pool
  private readonly name: string

  constructor(connectionPool: Pool, name: string) {
    this.pool = connectionPool
    this.name = name
  }

  /**
   * Read a message from the queue
   * @param vt - the visibility timeout of the message. The visibility timeout
   * defines the time a message will stay hidden after being retrieved, allowing other
   * consumers to process it later if it was not removed from the queue
   * @return the whole [message]{@link Message}, including the id, read count and the actual message within if exists
   */
  public async readMessage<T>(vt = 0) {
    const query = readQuery(this.name, vt)
    const result = await executeQueryWithTransaction(this.pool, query)
    if (result.rows.length > 0) {
      return parseDbMessage<T>(result.rows[0])
    }
    return null
  }

  /**
   * Delete a message from the queue
   * @param id - the id of the message to delete
   * @return the id of the message that was created
   */
  public async deleteMessage(id: number) {
    const query = deleteQuery(this.name, id)
    const connection = await this.pool.connect()
    const msg = await connection.query(query)
    connection.release()
    return parseInt(msg.rows[0].msg_id)
  }

  /**
   * Archives a message from the queue to its matching archive
   * @param id - the id of the message to delete
   * @return the id of the message that was created
   */
  public async archiveMessage(id: number): Promise<number> {
    const query = archiveQuery(this.name, id)
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
   * @param groupIdPath - JSON path to the group ID field (e.g., ['pr_id'] or ['metadata', 'group_id'])
   * @param vt - the visibility timeout of the message
   * @return the oldest available message, or null if none available
   */
  public async readMessageByGroupId<T>(groupIdPath: string[], vt: number) {
    const jsonPath = `{${groupIdPath.join(",")}}`
    const query = readMessageByGroupIdQuery(this.name, vt)
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
   * @param groupIdPath - JSON path to the group ID field (e.g., ['pr_id'] or ['metadata', 'group_id'])
   * @param groupIdValue - the value of the group ID to filter by
   * @param vt - the visibility timeout to set for all messages
   * @return array of all messages for this group
   */
  public async readAllMessagesByGroupId<T>(
    groupIdPath: string[],
    groupIdValue: string,
    vt: number
  ) {
    const jsonPath = `{${groupIdPath.join(",")}}`
    const query = readAllMessagesByGroupIdQuery(this.name, vt)
    const result = await executeQueryWithTransaction(this.pool, query, [
      jsonPath,
      groupIdValue,
    ])
    return result.rows.map((row) => parseDbMessage<T>(row))
  }

  /**
   * Delete multiple messages by their IDs
   * @param ids - array of message IDs to delete
   * @return array of deleted message IDs
   */
  public async deleteMessagesByIds(ids: number[]): Promise<number[]> {
    const query = deleteMessagesByIdsQuery(this.name)
    const connection = await this.pool.connect()
    const result = await connection.query(query, [ids])
    connection.release()
    return result.rows.map((row) => parseInt(row.msg_id))
  }
}
