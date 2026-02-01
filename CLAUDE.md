# PGMQ-TS Architecture Guide

## Project Overview
PGMQ-TS is a TypeScript wrapper for PostgreSQL-based message queues (PGMQ). It provides a type-safe interface for creating and managing message queues backed by PostgreSQL.

**Key Concepts:**
- Messages are stored in PostgreSQL tables with a `q_` prefix (e.g., `pgmq.q_my_queue`)
- Each queue has a matching archive table with an `a_` prefix (e.g., `pgmq.a_my_queue`)
- Visibility timeout (vt) controls when messages become available for reading
- Messages can be read, deleted, or archived

## File Structure

```
src/
├── index.ts                  # Main entry point, exports PGMQ and Queue
├── classes/
    ├── pgmq.ts              # Main PGMQ class with connection pool
    ├── queue.ts             # Queue-specific operations
    ├── types.ts             # Type definitions and parsers
    ├── queries.ts           # SQL query builders
    └── utils.ts             # Utility functions (transactions)
```

## Core Architecture

### 1. **Entry Point** (`src/index.ts`)
- Exports the `PGMQ` class (renamed from `Pgmq`)
- Exports the `Queue` class for type referencing

### 2. **PGMQ Class** (`src/classes/pgmq.ts`)
Main orchestrator class that:
- Manages PostgreSQL connection pool
- Provides schema operations (`createSchema`, `deleteSchema`)
- Provides queue operations (`createQueue`, `deleteQueue`, `getQueue`)
- Provides message operations (`sendMessage`, `readMessage`, `deleteMessage`, `archiveMessage`)
- Validates queue names (alphanumeric + underscore, max 47 chars)

**Connection Pattern:**
```typescript
// Most operations:
const connection = await this.pool.connect()
await connection.query(query)
connection.release()

// Transactional operations (readMessage):
const result = await executeQueryWithTransaction(this.pool, query)
```

### 3. **Queue Class** (`src/classes/queue.ts`)
Focused interface for queue-specific operations:
- Stores queue name and pool reference
- Provides the same message operations as PGMQ but without requiring queue name
- Methods: `readMessage`, `deleteMessage`, `archiveMessage`

**Pattern:** All methods mirror PGMQ methods but use `this.name` instead of accepting a queue parameter.

### 4. **Types** (`src/classes/types.ts`)
Defines core data structures:
- `Message<T>`: Public-facing message type with camelCase properties
- `DbMessage`: Internal database result type with snake_case properties
- `parseDbMessage<T>()`: Converts DB format to public format

**Message Structure:**
```typescript
interface Message<T> {
  msgId: number           // Unique message ID
  readCount: number       // How many times message was read
  enqueuedAt: Date       // When message was added
  vt: Date               // Visibility timeout
  message: T             // Actual payload (generic)
}
```

### 5. **Queries** (`src/classes/queries.ts`)
SQL query builders for all operations:
- Schema: `createSchemaQuery()`, `deleteSchemaQuery()`
- Queue: `createQueueQuery(name)`, `deleteQueueQuery(name)`
- Message: `sendQuery(queue, vt)`, `readQuery(queue, vt)`, `deleteQuery(queue, id)`, `archiveQuery(queue, id)`

**Constants:**
```typescript
const PGMQ_SCHEMA = "pgmq"
const QUEUE_PREFIX = "q"
const ARCHIVE_PREFIX = "a"
```

### 6. **Utils** (`src/classes/utils.ts`)
Transaction management:
- `executeQueryWithTransaction(pool, query)`: Wraps query in BEGIN/COMMIT/ROLLBACK
- Used for operations requiring atomicity (currently only `readMessage`)

## Adding New Methods (Pattern Guide)

### Step-by-Step Process for Adding Methods Like `readMessage` or `deleteMessage`

#### Step 1: Add Query Builder (`src/classes/queries.ts`)
```typescript
export function newMethodQuery(queue: string, param: type) {
  return `SQL QUERY HERE
          USING ${PGMQ_SCHEMA}.${QUEUE_PREFIX}_${queue}
          RETURNING relevant_fields;`
}
```

**Checklist:**
- [ ] Use `PGMQ_SCHEMA` constant for schema name
- [ ] Use `QUEUE_PREFIX` for queue table or `ARCHIVE_PREFIX` for archive table
- [ ] Add `RETURNING` clause if you need to return data
- [ ] Use parameterized queries ($1, $2) for user input to prevent SQL injection
- [ ] Consider if operation should be in a transaction

#### Step 2: Add Method to PGMQ Class (`src/classes/pgmq.ts`)

**Import the query:**
```typescript
import { newMethodQuery } from "./queries"
```

**Add the method:**
```typescript
/**
 * Clear description of what this method does
 * @param queue - the name of the queue
 * @param param - description of parameter
 * @return what the method returns
 */
public async newMethod(queue: string, param: type): Promise<ReturnType> {
  // Pattern 1: Simple query (no transaction needed)
  const connection = await this.pool.connect()
  const query = newMethodQuery(queue, param)
  const result = await connection.query(query)
  connection.release()
  return processResult(result)

  // Pattern 2: Transactional query (for operations that must be atomic)
  const query = newMethodQuery(queue, param)
  const result = await executeQueryWithTransaction(this.pool, query)
  return processResult(result)
}
```

**Decision Guide - Transaction vs Simple:**
- Use **transaction** (`executeQueryWithTransaction`) when:
  - Operation reads AND modifies data (e.g., `readMessage` - reads, updates vt, increments read_ct)
  - Operation must be atomic (all-or-nothing)
  - Multiple rows might be affected and consistency is critical

- Use **simple** (`connection.query`) when:
  - Single operation (pure read, pure write, pure delete)
  - No race condition concerns
  - Operation is idempotent

#### Step 3: Add Method to Queue Class (`src/classes/queue.ts`)

**Import the query:**
```typescript
import { newMethodQuery } from "./queries"
```

**Add the method (mirrors PGMQ but uses this.name):**
```typescript
/**
 * Same JSDoc as PGMQ method, but without @param queue
 * @param param - description of parameter
 * @return what the method returns
 */
public async newMethod(param: type): Promise<ReturnType> {
  // Copy implementation from PGMQ, replace queue param with this.name
  const query = newMethodQuery(this.name, param)
  // ... rest of implementation
}
```

#### Step 4: Add Type Definitions (if needed) (`src/classes/types.ts`)

If your method returns a new structure:
```typescript
export interface NewType {
  // Public-facing fields (camelCase)
}

interface DbNewType {
  // Database fields (snake_case)
}

export function parseDbNewType(db: DbNewType): NewType {
  return {
    // Map snake_case to camelCase
    // Parse types (strings to numbers, dates, etc.)
  }
}
```

#### Step 5: Add Tests (`test/integration.spec.ts`)

Add tests in both the main describe block and the "Test Queue contracts" block:

```typescript
it("should [do something]", async () => {
  const result = await pgmq.newMethod(QUEUE, params)
  expect(result).to.[assertion]
})

// In "Test Queue contracts" describe block:
it("should [do something]", async () => {
  const queue = pgmq.getQueue(QUEUE)
  const result = await queue.newMethod(params)
  expect(result).to.[assertion]
})
```

## Existing Method Examples

### Example 1: `readMessage` (Transactional)
**Location:** `pgmq.ts:97-104`, `queue.ts:22-29`

**Why transactional:**
- Reads message from queue (SELECT)
- Updates visibility timeout (UPDATE)
- Increments read count (UPDATE)
- Must be atomic to prevent race conditions

**Pattern:**
```typescript
// In PGMQ
public async readMessage<T>(queue: string, vt: number) {
  const query = readQuery(queue, vt)
  const result = await executeQueryWithTransaction(this.pool, query)
  if (result.rows.length > 0) {
    return parseDbMessage<T>(result.rows[0])
  }
  return null
}

// In Queue
public async readMessage<T>(vt = 0) {
  const query = readQuery(this.name, vt)
  const result = await executeQueryWithTransaction(this.pool, query)
  if (result.rows.length > 0) {
    return parseDbMessage<T>(result.rows[0])
  }
  return null
}
```

**Query:** Uses CTE with FOR UPDATE SKIP LOCKED to safely read and lock the message.

### Example 2: `deleteMessage` (Simple)
**Location:** `pgmq.ts:112-118`, `queue.ts:36-42`

**Why simple:**
- Single DELETE operation
- No complex state changes
- Idempotent

**Pattern:**
```typescript
// In PGMQ
public async deleteMessage(queue: string, id: number) {
  const query = deleteQuery(queue, id)
  const connection = await this.pool.connect()
  const msg = await connection.query(query)
  connection.release()
  return parseInt(msg.rows[0].msg_id)
}

// In Queue
public async deleteMessage(id: number) {
  const query = deleteQuery(this.name, id)
  const connection = await this.pool.connect()
  const msg = await connection.query(query)
  connection.release()
  return parseInt(msg.rows[0].msg_id)
}
```

**Query:** Simple DELETE with RETURNING clause.

### Example 3: `archiveMessage` (Simple with CTE)
**Location:** `pgmq.ts:126-132`, `queue.ts:49-55`

**Why simple (despite complexity):**
- CTE handles atomicity within single statement
- No multi-statement transaction needed
- Database guarantees consistency

**Pattern:**
```typescript
public async archiveMessage(queue: string, id: number): Promise<number> {
  const query = archiveQuery(queue, id)
  const connection = await this.pool.connect()
  const msg = await connection.query(query)
  connection.release()
  return parseInt(msg.rows[0].msg_id)
}
```

**Query:** Uses CTE to DELETE from queue and INSERT into archive in one statement.

## Group FIFO Pattern

### Overview
Group FIFO (also known as Israeli Queue or Message Groups pattern) allows parallel processing of different message groups while maintaining strict FIFO ordering within each group. This is ideal for scenarios where you need to process messages sequentially for the same entity (e.g., PR, user, tenant) but can process different entities in parallel.

**Use Cases:**
- Processing GitHub PRs where each PR's messages must be sequential, but different PRs can run in parallel
- User-specific workflows where one user's actions must be ordered, but different users can be processed concurrently
- Tenant-isolated operations in multi-tenant systems

### Core Methods

#### 1. `readMessageByGroupId<T>(queue, groupIdPath, vt)`
Reads the **single oldest available message** across all groups where the oldest message is not in progress.

**Key Behavior:**
- If a group's oldest message is locked (vt in future), **the entire group is skipped**
- Returns the oldest message from any unblocked group
- Enables automatic load balancing across groups

```typescript
// Get next available message across all groups
const msg = await pgmq.readMessageByGroupId('work', ['pr_id'], 30)
// Returns: oldest message from any group where oldest msg is not locked
```

#### 2. `readAllMessagesByGroupId<T>(queue, groupIdPath, groupIdValue, vt)`
Reads **ALL messages** for a specific group ID, including those with future visibility timeout.

**Key Behavior:**
- Ignores visibility timeout (gets even future-scheduled messages)
- Returns all messages for the specified group in FIFO order
- Used when processing all remaining messages for a group you're already working on

```typescript
// I'm working on pr_id=123, give me all remaining messages
const msgs = await pgmq.readAllMessagesByGroupId('work', ['pr_id'], '123', 30)
```

#### 3. `deleteMessagesByIds(queue, ids)`
Batch delete multiple messages by their IDs.

```typescript
const ids = msgs.map(m => m.msgId)
await pgmq.deleteMessagesByIds('work', ids)
```

### Implementation Details

**Query Pattern (`readMessageByGroupIdQuery`):**
```sql
WITH cte0 AS
  (SELECT message #>> $1 AS group_field, MIN(msg_id) AS msg_id
   FROM pgmq.q_{queue}
   GROUP BY group_field),  -- Find oldest msg per group
cte1 AS
  (SELECT t1.msg_id AS msg_id
   FROM pgmq.q_{queue} AS t1
   JOIN cte0 AS t2 ON t1.message #>> $1 = t2.group_field AND t1.msg_id = t2.msg_id
   WHERE vt <= clock_timestamp()  -- Only available messages
   ORDER BY msg_id ASC
   LIMIT 1 FOR UPDATE SKIP LOCKED)  -- Lock the oldest
UPDATE pgmq.q_{queue} m
SET vt = clock_timestamp() + interval '{vt} seconds',
    read_ct = read_ct + 1
FROM cte1
WHERE m.msg_id = cte1.msg_id
RETURNING m.*;
```

**Why Transactional:**
- Uses `FOR UPDATE SKIP LOCKED` to safely handle concurrent workers
- Atomically reads and updates visibility timeout
- Prevents race conditions

### Typical Worker Pattern

```typescript
const queue = pgmq.getQueue('work')

while (true) {
  // Get oldest available message from any unblocked group
  const msg = await queue.readMessageByGroupId(['pr_id'], 30)

  if (!msg) {
    await sleep(1000)
    continue
  }

  const prId = msg.message.pr_id

  // Pull all remaining messages for this specific pr_id
  const allMsgs = await queue.readAllMessagesByGroupId(['pr_id'], prId, 30)

  try {
    // Process all messages for this PR
    await processPR(prId, allMsgs)

    // Delete all when done
    const ids = allMsgs.map(m => m.msgId)
    await queue.deleteMessagesByIds(ids)
  } catch (error) {
    // Messages will become available again after vt expires
    console.error(`Failed to process PR ${prId}:`, error)
  }
}
```

### Group Blocking Behavior

**Example Scenario:**
```
Queue state:
- msg_id=5,  pr_id=123, repo1  [in progress - vt in future]
- msg_id=6,  pr_id=123, repo2  [blocked - waiting for msg 5]
- msg_id=7,  pr_id=123, repo3  [blocked - waiting for msg 5]
- msg_id=10, pr_id=456, repo4  [available]
```

**Query Logic:**
1. `cte0`: Groups by pr_id, finds MIN(msg_id) per group → `{123: 5, 456: 10}`
2. `cte1`: Filters `WHERE vt <= now()` → msg_id=5 blocked, so skip entire pr_id=123
3. Returns: msg_id=10 (oldest available from unblocked groups)

**Result:** Calling `readMessageByGroupId` returns msg_id=10, even though msg_id=5 has a lower ID, because the entire pr_id=123 group is blocked.

### Flexible Group Field Selection

The `groupIdPath` parameter supports nested JSONB fields using PostgreSQL's `#>>` operator:

```typescript
// Top-level field
await pgmq.readMessageByGroupId('work', ['pr_id'], 30)

// Nested field
await pgmq.readMessageByGroupId('work', ['metadata', 'tenant_id'], 30)

// Deep nesting
await pgmq.readMessageByGroupId('work', ['data', 'user', 'id'], 30)
```

### Queue Interface Support

All Group FIFO methods are available on the `Queue` class:

```typescript
const queue = pgmq.getQueue('work')

// Same methods, but queue name is implicit
const msg = await queue.readMessageByGroupId(['pr_id'], 30)
const all = await queue.readAllMessagesByGroupId(['pr_id'], '123', 30)
const ids = await queue.deleteMessagesByIds([1, 2, 3])
```

### Testing Group FIFO

Comprehensive tests in `test/integration.spec.ts` under `describe("Group FIFO")`:
- Empty queue behavior
- Oldest message selection
- Group blocking when oldest message is in progress
- FIFO ordering within single group
- Parallel processing of multiple groups
- readAllMessagesByGroupId with future vt
- Batch deletion
- Nested JSON path support
- Messages without group_id field

## Common Patterns & Best Practices

### Connection Management
```typescript
// Always release connections
const connection = await this.pool.connect()
try {
  await connection.query(query)
} finally {
  connection.release()
}

// Or use executeQueryWithTransaction which handles it automatically
```

### Type Safety
- Use generics for message payloads: `<T>`
- Parse database results through type converters
- Convert string numbers to actual numbers
- Convert string dates to Date objects

### Queue Naming
- Validated by `validateQueueName()` in `pgmq.ts:135-145`
- Must be alphanumeric + underscore only
- Max length: 47 chars (due to PostgreSQL's 63-char identifier limit minus prefixes)

### Error Handling
- Connection pool handles connection errors
- Transaction utility handles rollback automatically
- Query failures throw errors that propagate to caller

## Database Schema

### Queue Table Structure
```sql
pgmq.q_{queue_name}
├── msg_id (BIGINT PRIMARY KEY, GENERATED ALWAYS AS IDENTITY)
├── read_ct (INT, DEFAULT 0)
├── enqueued_at (TIMESTAMP WITH TIME ZONE, DEFAULT now())
├── vt (TIMESTAMP WITH TIME ZONE)
└── message (JSONB)
```

### Archive Table Structure
```sql
pgmq.a_{queue_name}
├── msg_id (BIGINT PRIMARY KEY)
├── read_ct (INT, DEFAULT 0)
├── enqueued_at (TIMESTAMP WITH TIME ZONE, DEFAULT now())
├── archived_at (TIMESTAMP WITH TIME ZONE, DEFAULT now())
├── vt (TIMESTAMP WITH TIME ZONE)
└── message (JSONB)
```

## Testing Strategy

Tests use Mocha + Chai and require a PostgreSQL database:
- Set `DATABASE_URL` environment variable
- Tests create/delete their own queues
- Integration tests cover both PGMQ and Queue interfaces
- Concurrent read test (skipped by default) validates message locking

## Quick Reference: File Locations by Concern

| Concern | File(s) |
|---------|---------|
| Add new method | `queries.ts`, `pgmq.ts`, `queue.ts` |
| Change message format | `types.ts`, potentially `queries.ts` |
| Modify connection handling | `pgmq.ts` (constructor), `utils.ts` |
| Add transaction support | `utils.ts` |
| Change schema/table names | `queries.ts` (constants at top) |
| Add tests | `test/integration.spec.ts` |
| Export new types/classes | `src/index.ts` |

## Dependencies

**Runtime:**
- `pg`: PostgreSQL client for Node.js

**Dev:**
- `typescript`: Type system
- `mocha` + `chai`: Testing
- `eslint` + `prettier`: Code quality
- `ts-node`: Run TypeScript in tests

## Build & Development

```bash
pnpm install          # Install dependencies
pnpm run build        # Compile TypeScript to dist/
pnpm run lint         # Lint source code
pnpm run format:fix   # Format code
pnpm test             # Run integration tests (requires DATABASE_URL)
```

**Output:** Compiled JS goes to `dist/src/`, with type definitions (`.d.ts`)

## Common Extension Scenarios

### Adding a "peek" method (read without modifying)
1. **Query** (`queries.ts`): SELECT without FOR UPDATE
2. **PGMQ** (`pgmq.ts`): Simple connection pattern
3. **Queue** (`queue.ts`): Mirror PGMQ method
4. **No new types needed** - returns same `Message<T>`

### Adding "purge queue" method (delete all messages)
1. **Query** (`queries.ts`): DELETE FROM queue (no WHERE)
2. **PGMQ** (`pgmq.ts`): Simple connection pattern
3. **Queue** (`queue.ts`): Mirror PGMQ method
4. **Return type**: Number of deleted messages

### Adding "set visibility timeout" method (update vt)
1. **Query** (`queries.ts`): UPDATE with WHERE msg_id = $1
2. **PGMQ** (`pgmq.ts`): Simple connection pattern with parameters
3. **Queue** (`queue.ts`): Mirror PGMQ method
4. **Return type**: Message ID or boolean

### Adding "pop" method (read and delete atomically)
1. **Query** (`queries.ts`): CTE with DELETE ... RETURNING
2. **PGMQ** (`pgmq.ts`): Transaction pattern (atomic operation)
3. **Queue** (`queue.ts`): Mirror PGMQ method
4. **Type**: Returns `Message<T>` using `parseDbMessage`

## Key Insights

1. **Dual Interface:** Every message operation exists in both PGMQ (requires queue name) and Queue (uses stored name)
2. **Query Centralization:** All SQL lives in `queries.ts` for easy maintenance
3. **Type Conversion:** Database uses snake_case, API uses camelCase - always convert via parsers
4. **Transaction Discipline:** Only use transactions when truly needed (read+modify operations)
5. **Visibility Timeout:** Core concept - controls when messages are available for consumption
6. **RETURNING Clause:** Most operations return the affected message ID for confirmation

## Notes for LLMs

- Always check both `pgmq.ts` and `queue.ts` when modifying methods
- Remember to release connections - use finally blocks or transaction utility
- Test changes in both test suites (main and "Test Queue contracts")
- Queue names are validated - don't bypass this validation
- The visibility timeout is in seconds in the API but converted to PostgreSQL intervals
- Messages are JSONB in database but parsed as typed objects in TypeScript
