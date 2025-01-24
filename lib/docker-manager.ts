import Docker from "dockerode"
import debug from "debug"

const log = debug("freerouting:docker-manager")

export class DockerManager {
  private docker: Docker
  private containerId: string | null = null
  private port: number

  constructor(port: number) {
    // Initialize with default options works on Linux and MacOS, for Windows we need to use TCP (must be enabled in Docker Desktop)
    if (this.isWindows()) {
      this.docker = new Docker({
        host: "http://localhost",
        port: 2375,
      })
      this.port = port
    } else {
      this.docker = new Docker({})
      this.port = port
    }
    log("DockerManager initialized, port:", port)
  }
  isWindows(): boolean {
    return process.platform === "win32"
  }

  async startContainer(): Promise<void> {
    try {
      log("Starting docker container")

      await new Promise((resolve, reject) => {
        this.docker.createContainer(
          {
            Image: "ghcr.io/tscircuit/freerouting:master",
            ExposedPorts: {
              [`${this.port}/tcp`]: {},
            },
            HostConfig: {
              PortBindings: {
                [`${this.port}/tcp`]: [{ HostPort: `${this.port}` }],
              },
            },
          },
          (err, container) => {
            if (err) {
              reject(err)
              return
            }
            if (!container) {
              reject(new Error("Failed to create container"))
              return
            }
            this.containerId = container.id
            container.start((startErr) => {
              if (startErr) {
                reject(startErr)
                return
              }
              log("Container started with ID: %s", this.containerId)
              resolve(container)
            })
          },
        )
      })
    } catch (error) {
      throw new Error(
        `${this.isWindows() ? `For Windows, Docker must be running with TCP socket enabled: Go to Docker Desktop -> Settings -> General -> Enable "Expose daemon on tcp://localhost:2375 without TLS" \n Error: ${error}` : `Failed to start container: ${error}`}`,
      )
    }
  }

  async stopContainer(): Promise<void> {
    if (!this.containerId) return

    try {
      const container = this.docker.getContainer(this.containerId)
      await container.stop()
      await container.remove()
      log("Docker container %s stopped and removed", this.containerId)
      this.containerId = null
    } catch (error) {
      log("Error stopping/removing container: %s", error)
    }
  }

  async isContainerRunning(): Promise<boolean> {
    if (!this.containerId) return false

    try {
      const container = this.docker.getContainer(this.containerId)
      const info = await container.inspect()
      return info.State.Running
    } catch (error) {
      return false
    }
  }

  getContainerId(): string | null {
    return this.containerId
  }
}
