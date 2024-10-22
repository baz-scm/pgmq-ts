import { Pool } from "pg"
import { archiveQuery, deleteQuery, readQuery } from "./queries"
import { parseDbMessage } from "./types"

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
    const conn = await this.pool.connect()
    const result = await conn.query(query)
    conn.release()
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
}
