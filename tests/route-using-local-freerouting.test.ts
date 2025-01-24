import { describe, test, expect, beforeAll } from "bun:test"
import { routeUsingLocalFreerouting } from "../lib/route-using-local-freerouting"
import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

describe("freerouting router", () => {
  test("should complete a basic routing workflow", async () => {
    const inputPath = "tests/assets/test-circuit.dsn"

    try {
      // Route the circuit
      const routedDsn = await routeUsingLocalFreerouting({ inputPath })
      expect(routedDsn).toBeTruthy()
    } catch (error) {
      console.error("Routing error:", error)
      if (error instanceof Error) {
        console.error("Error message:", error.message)
        console.error("Error stack:", error.stack)
      }
      throw error
    }
  }, 30000)

  test("should handle invalid input", async () => {
    await expect(
      routeUsingLocalFreerouting({
        inputPath: "tests/tests-data/invalid-input.dsn",
      }),
    ).rejects.toThrow()
  })
})
