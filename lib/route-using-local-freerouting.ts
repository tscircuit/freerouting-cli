import axios from "redaxios"
import { readFileSync, existsSync } from "node:fs"
import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

interface RouteOptions {
  inputPath: string
  port?: number
}

export async function routeCircuit({
  inputPath,
  port = 37864,
}: RouteOptions): Promise<string> {
  if (!existsSync(inputPath)) {
    throw new Error(`Input file does not exist: ${inputPath}`)
  }

  let containerId: string = ""
  const API_BASE = `http://localhost:${port}`
  const headers = {
    "Freerouting-Profile-ID": "e9866fac-e7ae-4f9f-a616-24ec577aa461",
    "Freerouting-Environment-Host": "tscircuit/0.0.1",
  }

  try {
    // Start container
    const { stdout } = await execAsync(
      `docker run -d -p ${port}:${port} ghcr.io/tscircuit/freerouting:master`,
    )
    containerId = stdout.trim()

    // Wait for server to be ready and verify it's responding
    let serverReady = false
    let attempts = 0
    const maxStartAttempts = 10

    while (!serverReady && attempts < maxStartAttempts) {
      try {
        await axios.get(`${API_BASE}/v1/system/status`)
        serverReady = true
      } catch (error) {
        attempts++
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    if (!serverReady) {
      throw new Error("Server failed to start after multiple attempts")
    }

    // Create session
    const sessionResponse = await axios.post(
      `${API_BASE}/v1/sessions/create`,
      "",
      { headers },
    )
    const sessionId = sessionResponse.data.id

    // Create job
    const jobResponse = await axios.post(
      `${API_BASE}/v1/jobs/enqueue`,
      {
        session_id: sessionId,
        name: "circuit-routing",
        priority: "NORMAL",
      },
      { headers },
    )
    const jobId = jobResponse.data.id

    // Upload DSN file
    const fileData = readFileSync(inputPath)
    await axios.post(
      `${API_BASE}/v1/jobs/${jobId}/input`,
      {
        filename: inputPath,
        data: Buffer.from(fileData).toString("base64"),
      },
      { headers },
    )

    // Start job
    await axios.put(`${API_BASE}/v1/jobs/${jobId}/start`, "", { headers })

    // Wait for completion
    let isComplete = false
    attempts = 0
    const maxAttempts = 20

    while (!isComplete && attempts < maxAttempts) {
      const jobStatus = await axios.get(`${API_BASE}/v1/jobs/${jobId}`, {
        headers,
      })

      if (jobStatus.data?.state === "COMPLETED") {
        isComplete = true
        break
      } else if (jobStatus.data?.state === "FAILED") {
        throw new Error(`Job failed with state: ${jobStatus.data.state}`)
      } else if (jobStatus.data?.state === "RUNNING") {
        await new Promise((resolve) => setTimeout(resolve, 3000))
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      attempts++
    }

    if (!isComplete) {
      throw new Error("Job timed out waiting for completion")
    }

    // Get output
    const outputResponse = await axios.get(
      `${API_BASE}/v1/jobs/${jobId}/output`,
      { headers },
    )

    if (!outputResponse.data?.data) {
      throw new Error("No output received from job")
    }

    return Buffer.from(outputResponse.data.data, "base64").toString()
  } finally {
    // Cleanup container
    if (containerId) {
      try {
        await execAsync(`docker stop ${containerId}`)
        await execAsync(`docker rm ${containerId}`)
      } catch (error) {
        // Silently handle cleanup errors
      }
    }
  }
}
