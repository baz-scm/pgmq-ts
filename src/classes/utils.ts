import { Pool, QueryResult } from "pg"

/**
 * Execute a query with proper transaction handling and connection management
 * @param pool - The connection pool to use
 * @param query - The query to execute
 * @returns The query result
 */
export async function executeQueryWithTransaction(
  pool: Pool,
  query: string
): Promise<QueryResult> {
  const client = await pool.connect()

  try {
    await client.query("BEGIN")
    const result = await client.query(query)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client
      .query("ROLLBACK")
      .catch(() => console.log("Error rolling back transaction"))
    throw error
  } finally {
    // This ensures connection is always released, even if there's an error
    client.release()
  }
}
