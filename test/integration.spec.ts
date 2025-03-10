import { beforeEach, describe, it } from "mocha"
import { assert, expect } from "chai"
import { PGMQ } from "../src"

const QUEUE = `tests`

interface TestMessage {
  org: string
  repo: string
  metadata: {
    site: string
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
})
