import { describe, test, expect, beforeAll } from "bun:test"
import { routeCircuit } from "../lib/route-using-local-freerouting"
import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

describe("freerouting router", () => {
  test("should complete a basic routing workflow", async () => {
    const inputPath = "tests/tests-data/test-circuit.dsn"

    try {
      // Route the circuit
      const routedDsn = await routeCircuit({ inputPath })
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
      routeCircuit({
        inputPath: "tests/tests-data/invalid-input.dsn",
      }),
    ).rejects.toThrow()
  })
})
