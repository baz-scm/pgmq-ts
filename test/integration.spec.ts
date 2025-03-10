import { beforeEach, describe, it } from "mocha"
import { assert, expect } from "chai"
import { PGMQ } from "../src"

const QUEUE = `tests`

interface TestMessage {
  org: string
  repo: string
  metadata: {
    site: string
    index?: number
  }
}

describe("Integration tests", () => {
  const connString = process.env.DATABASE_URL
  if (!connString) {
    assert.fail("DATABASE_URL must be set for the tests to run")
  }
  before(async () => {
    await pgmq.createSchema()
    await pgmq.createQueue(QUEUE)
  })

  const pgmq = new PGMQ(connString)
  describe("Send message", () => {
    it("should send the message", async () => {
      await pgmq.sendMessage<TestMessage>(
        QUEUE,
        {
          org: "acme",
          repo: "repo",
          metadata: {
            site: "google.com",
          },
        },
        0
      )
    })
  })

  after(async () => {
    await pgmq.deleteQueue(QUEUE)
  })

  beforeEach(async () => {
    await pgmq.sendMessage<TestMessage>(
      QUEUE,
      {
        org: "acme",
        repo: "repo",
        metadata: {
          site: "google.com",
        },
      },
      0
    )
  })

  it("should read a message", async () => {
    const msg = await pgmq.readMessage<TestMessage>(QUEUE, 60)
    expect(msg?.message?.org).to.eq("acme")
  })

  it("should archive a message", async () => {
    const msg = await pgmq.readMessage(QUEUE, 60)
    const id = msg?.msgId
    if (!id) {
      assert.fail("Expected id to be a number")
    }
    expect(msg?.readCount).to.be.gt(0)
    const res = await pgmq.archiveMessage(QUEUE, id)
    expect(res).to.eq(id)
  })

  it("should delete a message", async () => {
    const msg = await pgmq.readMessage(QUEUE, 60)
    const id = msg?.msgId
    if (!id) {
      assert.fail("Expected id to be a number")
    }
    expect(msg?.readCount).to.be.gt(0)
    const res = await pgmq.deleteMessage(QUEUE, id)
    expect(res).to.eq(id)
  })

  describe("Test Queue contracts", () => {
    const queue = pgmq.getQueue(QUEUE)
    it("should read message", async () => {
      const msg = await queue.readMessage<TestMessage>(60)
      expect(msg?.message?.org).to.eq("acme")
    })

    it("should archive a essage", async () => {
      const msg = await queue.readMessage(60)
      const id = msg?.msgId
      if (!id) {
        assert.fail("Expected id to be a number")
      }
      expect(msg?.readCount).to.be.gt(0)
      const res = await queue.archiveMessage(id)
      expect(res).to.eq(id)
    })

    it("should delete a message", async () => {
      const msg = await queue.readMessage(60)
      const id = msg?.msgId
      if (!id) {
        assert.fail("Expected id to be a number")
      }
      expect(msg?.readCount).to.be.gt(0)
      const res = await queue.deleteMessage(id)
      expect(res).to.eq(id)
    })
  })

  describe.skip("Test message reads", () => {
    const name = "test_reads"
    const pgmq = new PGMQ(process.env.DATABASE_URL || "")
    before(async () => {
      await pgmq.createQueue(name)
      // Write 1000 messages to the queue
      for (const i of Array(1000).keys()) {
        console.log(`Sending message ${i}`)
        await pgmq.sendMessage<TestMessage>(
          name,
          {
            org: "test",
            repo: "burst",
            metadata: {
              site: "baz.co",
              index: i,
            },
          },
          0
        )
      }
    })

    after(async () => {
      await pgmq.end()
    })

    it("All messages should be read precisely once", async () => {
      const readMessages = new Set<number>()
      let runs = 0
      const queue = pgmq.getQueue(name)
      while (true) {
        runs++
        const messages = await Promise.all([
          queue.readMessage<TestMessage>(60),
          queue.readMessage<TestMessage>(60),
          queue.readMessage<TestMessage>(60),
          queue.readMessage<TestMessage>(60),
        ])
        for (const m of messages) {
          if (m) {
            const index = m.message.metadata.index
            if (index === undefined) {
              assert.fail(`Message with index ${m.msgId} has no index`)
            } else {
              console.log(`Read message ${m.msgId}`)
            }
            if (readMessages.has(m.msgId)) {
              assert.fail(
                `Message with index ${m.msgId} was read ${m.readCount} times by this thread`
              )
            }
            if (m.readCount > 1) {
              assert.fail(
                `Message with index ${m.msgId} was read ${m.readCount} times on another thread`
              )
            }
            readMessages.add(m.msgId)
          }
        }
        console.log(`Read ${readMessages.size} distinct messages`)
        if (readMessages.size === 1000) {
          break
        }
        if (runs > 1000) {
          assert.fail(`Run ${readMessages.size} distinct messages`)
        }
      }
    })
  })
})
