// tests/cli.test.ts
import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)
let containerId: string

describe("freerouting CLI", () => {
  beforeAll(async () => {
    // Start docker container
    const { stdout } = await execAsync(
      "docker run -d -p 37864:37864 ghcr.io/tscircuit/freerouting:master",
    )
    containerId = stdout.trim()

    // Wait for container to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Configure CLI to use local server
    await execAsync("bun ./cli.ts config set-api-url http://localhost:37864")
    await execAsync(
      "bun ./cli.ts config set-profile e9866fac-e7ae-4f9f-a616-24ec577aa461",
    )
  })

  afterAll(async () => {
    // Stop and remove container
    await execAsync(`docker stop ${containerId}`)
    await execAsync(`docker rm ${containerId}`)

    // Reset CLI config
    await execAsync("bun ./cli.ts config reset")
  })

  test("should show help", async () => {
    const { stdout } = await execAsync("bun ./cli.ts --help")
    expect(stdout).toContain("Usage:")
  })

  test("should complete a basic routing workflow", async () => {
    // Create session
    const { stdout: sessionOutput } = await execAsync(
      "bun ./cli.ts session create",
    )
    expect(sessionOutput).toContain("id")

    // Create job
    const { stdout: jobOutput } = await execAsync("bun ./cli.ts job create")
    expect(jobOutput).toContain("id")
  })

  test("should handle system status", async () => {
    const { stdout } = await execAsync("bun ./cli.ts system status")
    expect(stdout).toBeTruthy()
  })

  test("should handle config operations", async () => {
    // Test config print
    const { stdout: configOutput } = await execAsync(
      "bun ./cli.ts config print",
    )
    expect(configOutput).toContain("Current configuration:")
    expect(configOutput).toContain("http://localhost:37864")
  })
})
