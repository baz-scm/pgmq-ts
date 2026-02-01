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
  group_id?: string
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

  describe("Group FIFO", () => {
    const GROUP_FIFO_QUEUE = "group_fifo_tests"

    before(async () => {
      await pgmq.createQueue(GROUP_FIFO_QUEUE)
    })

    after(async () => {
      await pgmq.deleteQueue(GROUP_FIFO_QUEUE)
    })

    describe("readMessageByGroupId - Basic", () => {
      it("should return null on empty queue", async () => {
        const msg = await pgmq.readMessageByGroupId<TestMessage>(
          GROUP_FIFO_QUEUE,
          ["group_id"],
          60
        )
        expect(msg).to.be.null
      })

      it("should read the oldest available message", async () => {
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "acme", repo: "repo1", metadata: { site: "a.com" }, group_id: "123" },
          0
        )
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "acme", repo: "repo2", metadata: { site: "b.com" }, group_id: "456" },
          0
        )

        const msg = await pgmq.readMessageByGroupId<TestMessage>(
          GROUP_FIFO_QUEUE,
          ["group_id"],
          60
        )
        expect(msg).to.not.be.null
        expect(msg?.message?.repo).to.eq("repo1") // oldest by msg_id
      })

      it("should skip groups where oldest message is in progress", async () => {
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "acme", repo: "repo1", metadata: { site: "a.com" }, group_id: "123" },
          0
        )
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "acme", repo: "repo2", metadata: { site: "b.com" }, group_id: "123" },
          0
        )
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "acme", repo: "repo3", metadata: { site: "c.com" }, group_id: "456" },
          0
        )

        // Read and lock the first message (repo1, group_id=123)
        const msg1 = await pgmq.readMessageByGroupId<TestMessage>(
          GROUP_FIFO_QUEUE,
          ["group_id"],
          60
        )
        expect(msg1?.message?.repo).to.eq("repo1")
        expect(msg1?.message?.group_id).to.eq("123")

        // Now try to read again - should skip group_id=123 entirely and get group_id=456
        const msg2 = await pgmq.readMessageByGroupId<TestMessage>(
          GROUP_FIFO_QUEUE,
          ["group_id"],
          60
        )
        expect(msg2).to.not.be.null
        expect(msg2?.message?.group_id).to.eq("456")
        expect(msg2?.message?.repo).to.eq("repo3")

        // Third read should return null (group_id=123 blocked, group_id=456 in progress)
        const msg3 = await pgmq.readMessageByGroupId<TestMessage>(
          GROUP_FIFO_QUEUE,
          ["group_id"],
          60
        )
        expect(msg3).to.be.null
      })

      it("should maintain FIFO within single group", async () => {
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "acme", repo: "first", metadata: { site: "a.com" }, group_id: "999" },
          0
        )
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "acme", repo: "second", metadata: { site: "a.com" }, group_id: "999" },
          0
        )
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "acme", repo: "third", metadata: { site: "a.com" }, group_id: "999" },
          0
        )

        const msg1 = await pgmq.readMessageByGroupId<TestMessage>(
          GROUP_FIFO_QUEUE,
          ["group_id"],
          60
        )
        expect(msg1?.message?.repo).to.eq("first")
        await pgmq.deleteMessage(GROUP_FIFO_QUEUE, msg1!.msgId)

        const msg2 = await pgmq.readMessageByGroupId<TestMessage>(
          GROUP_FIFO_QUEUE,
          ["group_id"],
          60
        )
        expect(msg2?.message?.repo).to.eq("second")
        await pgmq.deleteMessage(GROUP_FIFO_QUEUE, msg2!.msgId)

        const msg3 = await pgmq.readMessageByGroupId<TestMessage>(
          GROUP_FIFO_QUEUE,
          ["group_id"],
          60
        )
        expect(msg3?.message?.repo).to.eq("third")
        await pgmq.deleteMessage(GROUP_FIFO_QUEUE, msg3!.msgId)
      })

      it("should handle multiple groups in parallel", async () => {
        // Simulate worker pattern: process different groups concurrently
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "acme", repo: "g1_m1", metadata: { site: "a.com" }, group_id: "g1" },
          0
        )
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "acme", repo: "g1_m2", metadata: { site: "a.com" }, group_id: "g1" },
          0
        )
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "acme", repo: "g2_m1", metadata: { site: "b.com" }, group_id: "g2" },
          0
        )

        const msg1 = await pgmq.readMessageByGroupId<TestMessage>(
          GROUP_FIFO_QUEUE,
          ["group_id"],
          60
        )
        expect(msg1?.message?.group_id).to.eq("g1")
        expect(msg1?.message?.repo).to.eq("g1_m1")

        // While g1 is in progress, g2 can still be processed
        const msg2 = await pgmq.readMessageByGroupId<TestMessage>(
          GROUP_FIFO_QUEUE,
          ["group_id"],
          60
        )
        expect(msg2?.message?.group_id).to.eq("g2")
        expect(msg2?.message?.repo).to.eq("g2_m1")

        // Clean up
        await pgmq.deleteMessage(GROUP_FIFO_QUEUE, msg1!.msgId)
        await pgmq.deleteMessage(GROUP_FIFO_QUEUE, msg2!.msgId)

        // Now g1_m2 should be available
        const msg3 = await pgmq.readMessageByGroupId<TestMessage>(
          GROUP_FIFO_QUEUE,
          ["group_id"],
          60
        )
        expect(msg3?.message?.group_id).to.eq("g1")
        expect(msg3?.message?.repo).to.eq("g1_m2")
      })
    })

    describe("readAllMessagesByGroupId", () => {
      it("should read all messages for specific group in FIFO order", async () => {
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "acme", repo: "repo1", metadata: { site: "a.com" }, group_id: "123" },
          0
        )
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "acme", repo: "repo2", metadata: { site: "b.com" }, group_id: "123" },
          0
        )
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "acme", repo: "repo3", metadata: { site: "c.com" }, group_id: "456" },
          0
        )

        const msgs = await pgmq.readAllMessagesByGroupId<TestMessage>(
          GROUP_FIFO_QUEUE,
          ["group_id"],
          "123",
          60
        )
        expect(msgs.length).to.eq(2)
        expect(msgs[0].message.group_id).to.eq("123")
        expect(msgs[1].message.group_id).to.eq("123")
        expect(msgs[0].message.repo).to.eq("repo1")
        expect(msgs[1].message.repo).to.eq("repo2")
        // Verify FIFO: msg_id should be ascending
        expect(msgs[0].msgId).to.be.lt(msgs[1].msgId)
      })

      it("should read messages even with future vt", async () => {
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "acme", repo: "future1", metadata: { site: "a.com" }, group_id: "future" },
          3600 // 1 hour in future
        )
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "acme", repo: "future2", metadata: { site: "b.com" }, group_id: "future" },
          3600
        )

        const msgs = await pgmq.readAllMessagesByGroupId<TestMessage>(
          GROUP_FIFO_QUEUE,
          ["group_id"],
          "future",
          60
        )
        expect(msgs.length).to.eq(2) // Should get both even though vt is in future
      })

      it("should return empty array for non-existent group", async () => {
        const msgs = await pgmq.readAllMessagesByGroupId<TestMessage>(
          GROUP_FIFO_QUEUE,
          ["group_id"],
          "nonexistent",
          60
        )
        expect(msgs.length).to.eq(0)
      })
    })

    describe("deleteMessagesByIds", () => {
      it("should delete multiple messages by IDs", async () => {
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "acme", repo: "del1", metadata: { site: "a.com" }, group_id: "del" },
          0
        )
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "acme", repo: "del2", metadata: { site: "b.com" }, group_id: "del" },
          0
        )

        const msgs = await pgmq.readAllMessagesByGroupId<TestMessage>(
          GROUP_FIFO_QUEUE,
          ["group_id"],
          "del",
          60
        )
        const ids = msgs.map((m) => m.msgId)
        const deletedIds = await pgmq.deleteMessagesByIds(GROUP_FIFO_QUEUE, ids)

        expect(deletedIds.length).to.eq(2)
        expect(deletedIds).to.include.members(ids)

        // Verify messages are deleted
        const afterMsgs = await pgmq.readAllMessagesByGroupId<TestMessage>(
          GROUP_FIFO_QUEUE,
          ["group_id"],
          "del",
          60
        )
        expect(afterMsgs.length).to.eq(0)
      })

      it("should handle empty IDs array", async () => {
        const deletedIds = await pgmq.deleteMessagesByIds(GROUP_FIFO_QUEUE, [])
        expect(deletedIds.length).to.eq(0)
      })
    })

    describe("Edge cases", () => {
      it("should work with nested JSON paths", async () => {
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "nested1", repo: "test1", metadata: { site: "site1.com", index: 1 } },
          0
        )
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "nested2", repo: "test2", metadata: { site: "site1.com", index: 2 } },
          0
        )
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "nested3", repo: "test3", metadata: { site: "site2.com", index: 3 } },
          0
        )

        const msg = await pgmq.readMessageByGroupId<TestMessage>(
          GROUP_FIFO_QUEUE,
          ["metadata", "site"],
          60
        )
        expect(msg).to.not.be.null
        expect(msg?.message?.repo).to.eq("test1") // oldest message

        // Lock site1.com group
        const msg2 = await pgmq.readMessageByGroupId<TestMessage>(
          GROUP_FIFO_QUEUE,
          ["metadata", "site"],
          60
        )
        expect(msg2?.message?.metadata?.site).to.eq("site2.com") // site1.com is blocked
      })

      it("should handle messages without group_id field", async () => {
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "no_group", repo: "test", metadata: { site: "test.com" } }, // no group_id
          0
        )

        const msg = await pgmq.readMessageByGroupId<TestMessage>(
          GROUP_FIFO_QUEUE,
          ["group_id"],
          60
        )
        // Should still be able to read it (grouped as null/undefined)
        expect(msg).to.not.be.null
        expect(msg?.message?.repo).to.eq("test")
      })
    })

    describe("Queue interface", () => {
      const queue = pgmq.getQueue(GROUP_FIFO_QUEUE)

      it("should read message by group ID", async () => {
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "queue", repo: "q1", metadata: { site: "a.com" }, group_id: "q1" },
          0
        )

        const msg = await queue.readMessageByGroupId<TestMessage>(["group_id"], 60)
        expect(msg).to.not.be.null
        expect(msg?.message?.group_id).to.eq("q1")
      })

      it("should read all messages by group ID", async () => {
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "queue", repo: "q2_1", metadata: { site: "a.com" }, group_id: "q2" },
          0
        )
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "queue", repo: "q2_2", metadata: { site: "b.com" }, group_id: "q2" },
          0
        )

        const msgs = await queue.readAllMessagesByGroupId<TestMessage>(
          ["group_id"],
          "q2",
          60
        )
        expect(msgs.length).to.eq(2)
        expect(msgs[0].message.group_id).to.eq("q2")
      })

      it("should delete messages by IDs", async () => {
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "queue", repo: "q3_1", metadata: { site: "a.com" }, group_id: "q3" },
          0
        )
        await pgmq.sendMessage<TestMessage>(
          GROUP_FIFO_QUEUE,
          { org: "queue", repo: "q3_2", metadata: { site: "b.com" }, group_id: "q3" },
          0
        )

        const msgs = await queue.readAllMessagesByGroupId<TestMessage>(
          ["group_id"],
          "q3",
          60
        )
        const ids = msgs.map((m) => m.msgId)
        const deletedIds = await queue.deleteMessagesByIds(ids)
        expect(deletedIds.length).to.eq(2)
      })
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
        // Create an array of 4 promises using Array.from for better readability
        const messages = await Promise.all(
          Array.from({ length: 4 }, () => queue.readMessage<TestMessage>(60))
        )
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
          assert.fail(`Read ${readMessages.size} distinct messages`)
        }
      }
    })
  })
})
