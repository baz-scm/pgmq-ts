# PGMQ-TS

[![npm version](https://badge.fury.io/js/@baz-scm%2Fpgmq-ts.svg)](https://www.npmjs.com/package/@baz-scm/pgmq-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

PGMQ-TS is a TypeScript library that provides a message queue implementation using PostgreSQL as the backend. It's the TypeScript equivalent of pgmq-rs, offering a robust and type-safe way to implement message queues in your Node.js applications.

## Features

- 🔒 **Type-safe**: Full TypeScript support with generics for message types
- 🎯 **Simple API**: Easy-to-use interface for queue operations
- 📦 **PostgreSQL-backed**: Leverages PostgreSQL's reliability and ACID properties
- 🔄 **Message Visibility**: Configurable visibility timeout for message processing
- 📚 **Message Archives**: Built-in support for archiving processed messages
- 🔌 **Connection Pooling**: Efficient database connection management

## Installation

```bash
npm install @baz-scm/pgmq-ts
# or
yarn add @baz-scm/pgmq-ts
# or
pnpm add @baz-scm/pgmq-ts
```

## Quick Start

```typescript
import { PGMQ } from '@baz-scm/pgmq-ts';

// Initialize PGMQ with your PostgreSQL connection string
const pgmq = new PGMQ('postgresql://user:password@localhost:5432/dbname');

// Create the PGMQ schema and a queue
await pgmq.createSchema();
await pgmq.createQueue('my_queue');

// Define your message type
interface MyMessage {
  id: string;
  data: {
    value: string;
  };
}

// Send a message
await pgmq.sendMessage<MyMessage>('my_queue', {
  id: '123',
  data: {
    value: 'Hello PGMQ!'
  }
}, 0);

// Read a message (with 60 second visibility timeout)
const message = await pgmq.readMessage<MyMessage>('my_queue', 60);

if (message) {
  // Process the message
  console.log(message.message); // Access the typed message content
  
  // After processing, either delete or archive the message
  await pgmq.deleteMessage('my_queue', message.msgId);
  // or
  await pgmq.archiveMessage('my_queue', message.msgId);
}
```

## Queue Operations

### Creating a Queue

```typescript
await pgmq.createQueue('my_queue');
```

### Using Queue Objects

You can also get a Queue object for more focused operations:

```typescript
const queue = pgmq.getQueue('my_queue');

// Read messages from the queue
const message = await queue.readMessage<MyMessage>();

// Delete a message
await queue.deleteMessage(messageId);

// Archive a message
await queue.archiveMessage(messageId);
```

### Message Visibility

The visibility timeout determines how long a message stays hidden after being read. This prevents other consumers from processing the same message during this period:

```typescript
// Message will be hidden for 60 seconds after being read
const message = await pgmq.readMessage<MyMessage>('my_queue', 60);
```

## Best Practices

1. Always define TypeScript interfaces for your message types
2. Handle connection cleanup by calling `pgmq.end()` when shutting down
3. Use appropriate visibility timeouts based on your processing needs
4. Consider archiving important messages instead of deleting them
5. Validate queue names (alphanumeric and underscore characters only)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.