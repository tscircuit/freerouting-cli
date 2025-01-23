import docker
import requests
import os
import base64
import time
import argparse


def freeroute_board(board_filepath, output_filepath):
    """
    Automates board routing using the Freerouting Docker container.

    Args:
        board_filepath (str): Path to the input DSN file.
        output_filepath (str): Path to save the output SES file.

    Returns:
        bool: True if successful, False otherwise.
    """
    client = docker.from_env()
    container = None

    try:
        # Run the Freerouting Docker container
        container = client.containers.run(
            "ghcr.io/tscircuit/freerouting:master",  # Ensure the correct image and tag
            detach=True,
            ports={"37864/tcp": 37864},
            volumes={
                os.path.abspath(os.path.dirname(board_filepath)): {"bind": "/input", "mode": "ro"},
                os.path.abspath(os.path.dirname(output_filepath)): {"bind": "/output", "mode": "rw"}
            },
            working_dir="/input"
        )

        # Allow the container time to initialize
        time.sleep(5)

        # Read and encode the input DSN file
        with open(board_filepath, "rb") as f:
            dsn_data = base64.b64encode(f.read()).decode("utf-8")

        # Create a routing session
        session_create_url = "http://localhost:37864/v1/sessions/create"
        session_response = requests.post(session_create_url)
        session_response.raise_for_status()
        session_id = session_response.json()["id"]

        # Enqueue a routing job
        board_filename = os.path.basename(board_filepath)
        job_enqueue_url = "http://localhost:37864/v1/jobs/enqueue"
        job_data = {"session_id": session_id, "name": board_filename}
        job_response = requests.post(job_enqueue_url, json=job_data)
        job_response.raise_for_status()
        job_id = job_response.json()["id"]

        # Upload input DSN data to the job
        job_input_url = f"http://localhost:37864/v1/jobs/{job_id}/input"
        input_data = {"filename": board_filename, "data": dsn_data}
        input_response = requests.post(job_input_url, json=input_data)
        input_response.raise_for_status()

        # Start the routing job
        job_start_url = f"http://localhost:37864/v1/jobs/{job_id}/start"
        start_response = requests.put(job_start_url)
        start_response.raise_for_status()

        # Poll the job status until completion
        while True:
            job_status_url = f"http://localhost:37864/v1/jobs/{job_id}"
            status_response = requests.get(job_status_url)
            status_response.raise_for_status()
            job_status = status_response.json()["state"]
            if job_status in ("COMPLETED", "FAILED"):
                break
            time.sleep(5)

        # Retrieve and decode the output SES file
        job_output_url = f"http://localhost:37864/v1/jobs/{job_id}/output"
        output_response = requests.get(job_output_url)
        output_response.raise_for_status()
        ses_data = base64.b64decode(output_response.json()["data"]).decode("utf-8")

        with open(output_filepath, "w") as outfile:
            outfile.write(ses_data)

        print("Routing complete. Output saved to:", output_filepath)
        return True

    except requests.exceptions.RequestException as e:
        print(f"API request failed: {e}")
        return False
    except docker.errors.APIError as e:
        print(f"Docker API Error: {e}")
        return False
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return False
    finally:
        if container:
            container.stop()
            container.remove()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Route a board using Freerouting in Docker.")
    parser.add_argument("input_dsn", help="Path to the input DSN file.")
    parser.add_argument("output_ses", help="Path to the output SES file.")
    args = parser.parse_args()

    # Check if the input DSN file exists
    if not os.path.exists(args.input_dsn):
        print(f"Error: Input DSN file '{args.input_dsn}' not found.")
        exit(1)

    # Run the routing process
    if freeroute_board(args.input_dsn, args.output_ses):
        exit(0)  # Success
    else:
        exit(1)  # Failure
