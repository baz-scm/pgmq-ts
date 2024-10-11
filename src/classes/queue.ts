import { Pool } from "pg"
import { archiveQuery, deleteQuery, readQuery } from "./queries"
import { parseDbMessage } from "./message"

export class Queue {
  private pool: Pool
  private readonly name: string

  constructor(connectionPool: Pool, name: string) {
    this.pool = connectionPool
    this.name = name
  }

  public async readMessage<T>(vt = 0) {
    const query = readQuery(this.name, vt)
    const conn = await this.pool.connect()
    const result = await conn.query(query)
    return parseDbMessage<T>(result.rows[0])
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
