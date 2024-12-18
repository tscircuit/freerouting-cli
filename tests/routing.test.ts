import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import { mkdirSync, existsSync } from "node:fs"
import {
  convertCircuitJsonToDsnString,
  mergeDsnSessionIntoDsnPcb,
  parseDsnToDsnJson,
  type DsnPcb,
  type DsnSession,
  convertDsnPcbToCircuitJson,
} from "dsn-converter"

const execAsync = promisify(exec)
let containerId: string

describe("freerouting routing", () => {
  beforeAll(async () => {
    if (!existsSync("tests/tests-data")) {
      mkdirSync("tests/tests-data", { recursive: true })
    }

    const { stdout } = await execAsync(
      "docker run -d -p 37864:37864 ghcr.io/tscircuit/freerouting:master",
    )
    containerId = stdout.trim()

    await new Promise((resolve) => setTimeout(resolve, 2000))

    await execAsync("bun ./cli.ts config set-api-url http://localhost:37864")
    await execAsync(
      "bun ./cli.ts config set-profile e9866fac-e7ae-4f9f-a616-24ec577aa461",
    )

    try {
      const { stdout: healthCheck } = await execAsync(
        "bun ./cli.ts system status",
      )
      console.log("Server health check:", healthCheck)
    } catch (error) {
      console.error("Server health check failed:", error)
      throw error
    }
  })

  afterAll(async () => {
    await execAsync(`docker stop ${containerId}`)
    await execAsync(`docker rm ${containerId}`)

    await execAsync("bun ./cli.ts config reset")
  })

  test("should route a simple circuit", async () => {
    try {
      const { stdout: sessionOutput } = await execAsync(
        "bun ./cli.ts session create",
      )
      expect(sessionOutput).toContain("id:")

      const { stdout: jobOutput } = await execAsync(
        "bun ./cli.ts job create --name test-routing",
      )
      expect(jobOutput).toContain("id:")

      const circuitJson = await Bun.file(
        "tests/tests-data/circuit-json-with-route.json",
      ).json()

      const dsnString = convertCircuitJsonToDsnString(circuitJson)

      await Bun.write("tests/tests-data/temp.dsn", dsnString)

      const { stdout: uploadOutput } = await execAsync(
        "bun ./cli.ts job upload --file tests/tests-data/temp.dsn",
      )
      expect(uploadOutput).toBeTruthy()

      const { stdout: startOutput } = await execAsync("bun ./cli.ts job start")
      expect(startOutput).toBeTruthy()

      let isComplete = false
      let attempts = 0
      const maxAttempts = 20

      while (!isComplete && attempts < maxAttempts) {
        const { stdout: jobStatus } = await execAsync("bun ./cli.ts job get")
        console.log(`Job status (attempt ${attempts + 1}):`, jobStatus)

        if (jobStatus.includes("COMPLETED")) {
          isComplete = true
          break
        } else if (jobStatus.includes("FAILED")) {
          throw new Error(`Job failed with status: ${jobStatus}`)
        }

        await new Promise((resolve) => setTimeout(resolve, 3000))
        attempts++
      }

      if (!isComplete) {
        throw new Error("Job timed out waiting for completion")
      }

      const { stdout: outputResult } = await execAsync(
        "bun ./cli.ts job output -o tests/tests-data/routed-output.dsn",
      )
      expect(outputResult).toBeTruthy()
      expect(existsSync("tests/tests-data/routed-output.dsn")).toBe(true)

      const routedDsnContent = await Bun.file(
        "tests/tests-data/routed-output.dsn",
      ).text()
      const routedDsnTemp = await Bun.file("tests/tests-data/temp.dsn").text()

      const dsnJson = mergeDsnSessionIntoDsnPcb(
        parseDsnToDsnJson(routedDsnTemp) as DsnPcb,
        parseDsnToDsnJson(routedDsnContent) as DsnSession,
      )

      const routedCircuitJson = convertDsnPcbToCircuitJson(dsnJson)
      const traces = routedCircuitJson.length

      expect(traces).toBeGreaterThan(0)

      await execAsync(
        "rm tests/tests-data/temp.dsn tests/tests-data/routed-output.dsn",
      )
    } catch (error) {
      console.error("Test error:", error)
      console.error("Full error details:", JSON.stringify(error, null, 2))
      throw error
    }
  }, 30000)
})
