#!/usr/bin/env node
import { Command } from "commander"
import axios from "redaxios"
import { z } from "zod"
import debug from "debug"
import Conf from "conf"
import { randomUUID } from "crypto"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

const handleApiError = (error: any) => {
  console.error("API Error:")
  console.log(error)
  if (error.data) {
    // The request was made and the server responded with a status code
    console.error(`Status: ${error.status}`)
    console.error("Response data:", error.data)
  } else if (error.request) {
    // The request was made but no response was received
    console.error("No response received from server")
    console.error(error.request)
  } else {
    // Something happened in setting up the request
    console.error("Error:", error.message)
  }
  process.exit(1)
}

const log = debug("freerouting:cli")

const config = new Conf({
  projectName: "freerouting-api-cli",
  defaults: {
    lastSessionId: "",
    lastJobId: "",
    profileId: "",
    apiBaseUrl: "https://api.freerouting.app",
  },
})

async function checkDocker() {
  try {
    await execAsync("docker --version")
    return true
  } catch (error) {
    console.error("Docker is not installed. Please install Docker first.")
    process.exit(1)
  }
}

const program = new Command()

program
  .name("freerouting")
  .description("CLI for interacting with the freerouting API")
  .version("0.0.1")

// Common options
const commonOptions = {
  profileId:
    program.opts().profileId ||
    config.get("profileId") ||
    process.env.FREEROUTING_PROFILE_ID,
  host:
    program.opts().host || process.env.FREEROUTING_HOST || "tscircuit/0.0.1",
  apiBaseUrl:
    program.opts().apiBaseUrl ||
    process.env.FREEROUTING_API_BASE_URL ||
    config.get("apiBaseUrl"),
}

const API_BASE = commonOptions.apiBaseUrl

const getHeaders = (needsAuth = true) => {
  if (!commonOptions.profileId && needsAuth) {
    console.error(
      'Profile ID is not set, use --profile-id, do "freerouting config set-profile" or set FREEROUTING_PROFILE_ID environment variable',
    )
    process.exit(1)
  }
  return {
    "Freerouting-Profile-ID": commonOptions.profileId,
    "Freerouting-Environment-Host": commonOptions.host,
  }
}

// Session commands
const sessionCommand = new Command("session")
  .alias("sessions")
  .description("Manage routing sessions")

sessionCommand
  .command("create")
  .description("Create a new routing session")
  .action(async () => {
    const response = await axios.post(`${API_BASE}/v1/sessions/create`, "", {
      headers: getHeaders(),
    })
    config.set("lastSessionId", response.data.id)
    console.log(response.data)
  })

sessionCommand
  .command("list")
  .description("List all sessions")
  .action(async () => {
    const response = await axios.get(`${API_BASE}/v1/sessions/list`, {
      headers: getHeaders(),
    })
    console.log(response.data)
  })

sessionCommand
  .command("get [sessionId]")
  .description("Get session details")
  .action(async (sessionId: string) => {
    sessionId ??= config.get("lastSessionId")
    if (!sessionId) {
      console.error(
        "No session ID provided and no last session ID found in config",
      )
      return
    }
    const response = await axios.get(`${API_BASE}/v1/sessions/${sessionId}`, {
      headers: getHeaders(),
    })
    console.log(response.data)
  })

// Config commands
const configCommand = new Command("config").description(
  "Manage configuration settings",
)

configCommand
  .command("set-profile")
  .description("Set the Freerouting Profile ID")
  .argument("<profileId>", "Profile ID to set")
  .action(async (profileId: string) => {
    config.set("profileId", profileId)
    console.log(`Profile ID set to: ${profileId}`)
  })

configCommand
  .command("set-api-url")
  .description("Set the Freerouting API Base URL")
  .argument("<apiBaseUrl>", "API Base URL to set")
  .action(async (apiBaseUrl: string) => {
    config.set("apiBaseUrl", apiBaseUrl)
    console.log(`API Base URL set to: ${apiBaseUrl}`)
  })

configCommand
  .command("create-profile")
  .description("Generate and set a new random UUID v4 as the Profile ID")
  .action(async () => {
    const profileId = randomUUID()
    config.set("profileId", profileId)
    console.log(`New Profile ID generated and set to: ${profileId}`)
  })

configCommand
  .command("reset")
  .description("Reset all configuration to defaults")
  .action(async () => {
    config.set("lastSessionId", "")
    config.set("lastJobId", "")
    config.set("profileId", "")
    config.set("apiBaseUrl", "https://api.freerouting.app")
    console.log("Configuration reset to defaults")
  })

// Job commands
const jobCommand = new Command("job")
  .alias("jobs")
  .description("Manage routing jobs")

jobCommand
  .command("create")
  .description("Create a new routing job")
  .option(
    "-s, --session-id <sessionId>",
    "Session ID",
    config.get("lastSessionId"),
  )
  .option("-n, --name <name>", "Job name", "untitled")
  .option("-p, --priority <priority>", "Job priority", "NORMAL")
  .action(async (opts: any) => {
    const response = await axios.post(
      `${API_BASE}/v1/jobs/enqueue`,
      {
        session_id: opts.sessionId ?? config.get("lastSessionId"),
        name: opts.name,
        priority: opts.priority,
      },
      { headers: getHeaders() },
    )
    config.set("lastJobId", response.data.id)
    console.log(response.data)
  })

jobCommand
  .command("list")
  .description("List jobs for a session")
  .argument("<sessionId>", "Session ID")
  .action(async (sessionId: string) => {
    sessionId ??= config.get("lastSessionId")
    const response = await axios.get(`${API_BASE}/v1/jobs/list/${sessionId}`, {
      headers: getHeaders(),
    })
    console.log(response.data)
  })

jobCommand
  .command("get")
  .description("Get job details")
  .argument("[jobId]", "Job ID")
  .action(async (jobId: string) => {
    jobId ??= config.get("lastJobId")
    const response = await axios.get(`${API_BASE}/v1/jobs/${jobId}`, {
      headers: getHeaders(),
    })
    console.log(response.data)
  })

jobCommand
  .command("upload")
  .description("Upload design file for a job")
  .option("-j, --job-id <jobId>", "Job ID", config.get("lastJobId"))
  .requiredOption("-f, --file <file>", "Design file path")
  .action(async (opts: any) => {
    opts.jobId ??= config.get("lastJobId")
    if (!opts.jobId) {
      console.error("No job ID provided and no last job ID found in config")
      return
    }
    const fileData = await Bun.file(opts.file).text()
    const response = await axios.post(
      `${API_BASE}/v1/jobs/${opts.jobId}/input`,
      {
        filename: opts.file,
        data: Buffer.from(fileData).toString("base64"),
      },
      { headers: getHeaders() },
    )
    console.log(response.data)
  })

jobCommand
  .command("start")
  .description("Start a routing job")
  .argument("[jobId]", "Job ID")
  .action(async (jobId: string) => {
    jobId ??= config.get("lastJobId")
    if (!jobId) {
      console.error("No job ID provided and no last job ID found in config")
      return
    }
    const response = await axios.put(`${API_BASE}/v1/jobs/${jobId}/start`, "", {
      headers: getHeaders(),
    })
    console.log(response.data)
  })

jobCommand
  .command("output")
  .description("Get job output")
  .argument("[jobId]", "Job ID")
  .option("-o, --output <file>", "Output file path")
  .action(async (jobId: string, opts: any) => {
    jobId ??= config.get("lastJobId")
    if (!jobId) {
      console.error("No job ID provided and no last job ID found in config")
      return
    }
    try {
      const response = await axios.get(`${API_BASE}/v1/jobs/${jobId}/output`, {
        headers: getHeaders(),
      })

      const outputPath = opts.output || response.data.filename
      if (outputPath) {
        // Decode base64 and write to file
        const decodedData = Buffer.from(response.data.data, "base64").toString()
        await Bun.write(outputPath, decodedData)
        console.log(`Output written to ${outputPath}`)
      } else {
        console.log(response.data)
      }
    } catch (error) {
      handleApiError(error)
    }
  })

// System commands
const systemCommand = new Command("system").description(
  "Manage system operations",
)

systemCommand
  .command("status")
  .description("Get system status")
  .action(async () => {
    const response = await axios.get(`${API_BASE}/v1/system/status`)
    console.log(response.data)
  })

// Add all command groups to the main program
// Server commands
const serverCommand = new Command("server")
  .description("Manage local freerouting server")

serverCommand
  .command("start")
  .description("Start a local freerouting server")
  .action(async () => {
    await checkDocker()
    try {
      const { stdout } = await execAsync("docker run -d -p 37864:37864 ghcr.io/tscircuit/freerouting:master")
      const containerId = stdout.trim()
      console.log("Container started with ID:", containerId)
      
      // Show logs from the container
      const { stdout: logs } = await execAsync(`docker logs ${containerId}`)
      console.log("\nContainer logs:")
      console.log(logs)
      config.set("apiBaseUrl", "http://localhost:37864")
      config.set("profileId", "e9866fac-e7ae-4f9f-a616-24ec577aa461")
      config.set("lastSessionId", "")
      config.set("lastJobId", "")
      console.log("Local freerouting server started on http://localhost:37864")
      console.log("API URL and profile ID have been configured automatically")
    } catch (error) {
      console.error("Failed to start docker container:", error)
      process.exit(1)
    }
  })

program
  .addCommand(sessionCommand)
  .addCommand(configCommand)
  .addCommand(jobCommand)
  .addCommand(systemCommand)
  .addCommand(serverCommand)

program.parse(process.argv)
