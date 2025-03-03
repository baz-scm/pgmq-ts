const PGMQ_SCHEMA = "pgmq"
const QUEUE_PREFIX = "q"
const ARCHIVE_PREFIX = "a"

export function createSchemQuery() {
  return `CREATE SCHEMA IF NOT EXISTS ${PGMQ_SCHEMA}`
}

export function deleteSchemaQuery() {
  return `DROP SCHEMA IF EXISTS ${PGMQ_SCHEMA}`
}

export function createQueueQuery(name: string) {
  return `
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
}

export function deleteQueueQuery(name: string) {
  return `
        DROP TABLE IF EXISTS ${PGMQ_SCHEMA}.${QUEUE_PREFIX}_${name};
        DROP TABLE IF EXISTS ${PGMQ_SCHEMA}.${ARCHIVE_PREFIX}_${name};`
}

export function sendQuery(queue: string, vt: number) {
  return `INSERT INTO ${PGMQ_SCHEMA}.${QUEUE_PREFIX}_${queue} (vt, message)
            VALUES ((now() + interval '${vt} seconds'), $1::jsonb)
            RETURNING msg_id;`
}

export function readQuery(queue: string, vt: number) {
  return `WITH cte AS
                     (SELECT msg_id
                      FROM ${PGMQ_SCHEMA}.${QUEUE_PREFIX}_${queue}
                      WHERE vt <= now()
                      ORDER BY msg_id
                      LIMIT 1 FOR UPDATE SKIP LOCKED)
            UPDATE ${PGMQ_SCHEMA}.${QUEUE_PREFIX}_${queue} t
            SET vt      = now() + interval '${vt} seconds',
                read_ct = read_ct + 1
            FROM cte
            WHERE t.msg_id = cte.msg_id
            RETURNING *;`
}

export function archiveQuery(queue: string, id: number) {
  return `WITH archived AS (
        DELETE FROM ${PGMQ_SCHEMA}.${QUEUE_PREFIX}_${queue}
            WHERE msg_id = ${id}
            RETURNING msg_id, vt, read_ct, enqueued_at, message)
            INSERT
            INTO ${PGMQ_SCHEMA}.${ARCHIVE_PREFIX}_${queue} (msg_id, vt, read_ct, enqueued_at, message)
            SELECT msg_id, vt, read_ct, enqueued_at, message
            FROM archived
            RETURNING msg_id;`
}

export function deleteQuery(queue: string, id: number) {
  return `DELETE
            FROM ${PGMQ_SCHEMA}.${QUEUE_PREFIX}_${queue}
            WHERE msg_id = ${id}
            RETURNING msg_id;`
}
