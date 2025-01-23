#!/bin/sh

#
# Copyright © 2015-2021 the original authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# Freerouting CLI for interacting with the Freerouting API
# Adjustments for custom configuration paths and CLI commands
##############################################################################

# Attempt to set APP_HOME

# Resolve links: $0 may be a link
app_path=$0

# Need this for daisy-chained symlinks.
while
    APP_HOME=${app_path%"${app_path##*/}"}  # leaves a trailing /; empty if no leading path
    [ -h "$app_path" ]
do
    ls=$( ls -ld "$app_path" )
    link=${ls#*' -> '}
    case $link in             
      /*)   app_path=$link ;;
      *)    app_path=$APP_HOME$link ;;
    esac
done

APP_BASE_NAME=${0##*/}
APP_HOME=$( cd "${APP_HOME:-./}" && pwd -P ) || exit

# Define constants for Freerouting
FREEROUTING_API_URL="https://api.freerouting.app"
FREEROUTING_CLI_PATH="$APP_HOME/cli"

# Set Java command
JAVACMD=java
if [ ! -x "$JAVACMD" ] ; then
    die "ERROR: Java is not found in your PATH. Please install Java or set JAVA_HOME."
fi

# Configuration function for Freerouting CLI
configure_freerouting() {
    echo "Configuring Freerouting CLI..."

    if [ -n "$1" ]; then
        profile_id="$1"
        echo "Setting profile ID: $profile_id"
        freerouting config set-profile "$profile_id"
    else
        echo "Creating a new profile..."
        freerouting config create-profile
    fi

    if [ -n "$2" ]; then
        api_url="$2"
        echo "Setting custom API URL: $api_url"
        freerouting config set-api-url "$api_url"
    else
        echo "Using default API URL: $FREEROUTING_API_URL"
    fi
}

# Start Freerouting local server
start_local_server() {
    echo "Starting Freerouting local server..."
    freerouting server start
}

# Check API system status
check_system_status() {
    echo "Checking Freerouting API system status..."
    freerouting system status
}

# Main functionality to handle CLI commands
case $1 in
    "config")
        configure_freerouting "$2" "$3"
        ;;
    "server")
        start_local_server
        ;;
    "status")
        check_system_status
        ;;
    *)
        echo "Usage: $0 {config|server|status}"
        exit 1
        ;;
esac

