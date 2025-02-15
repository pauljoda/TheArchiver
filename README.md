# The Archiver
## Description
The Archiver is a project that formed from my free time playing with .net aspire. 

This project started as a simple webapi that I could send a POST request from my phone and trigger a download of content.

As I developed it for that specific use, I found I wanted to expand it out so I can use it for whatever I want

The app consists of:
- A WebAPI: This is by default just on localhost, I suggest using a reverse proxy like cloudflare to access remotely
- Data: The db context and models for the sql server instance that runs for the cache. URLs are stored in the cache, and processed. Failed downloads are added to a table you can review
- DownloadPluginAPI: This is the package pushed to NuGet in order to create plugins to add functionality
- DownloadWorker: The background task that checks for new things to download
- Host: The aspire host
- MigrationService: Since aspire creates new containers and is meant to scale and move, this ensures that the changes to the db are applied and created each time
- ServiceDefaults: Standard .net aspire defaults to enable better local dev

Feel free to clone and run on your own, or do whatever you like with it. I'll likely update this as I need, and have example plugins you can use in other repos

To use a plugin, define the plugin folder ENV in the compose file, and place the dll of the libary there. You must implement the IDownloadHandler class and use the DownloadHandler attribute for the reflection to find it

## Setup Dev
Clone the repo, and add the .net secret to the host for the password, place a default sql password with the key "sql-password", this will be the default password for the "sa" account setup on the sql server instance.

Since this uses a persistant docker volume, this db will persist between runs so you can log into it at the IP of the host on the exposed port

## Running on Docker

This project is meant to run on your local server, since the goal is to archive things for yourself. 
In order to export an aspire project in a way that you can run locally, you need to use [aspir8](https://prom3theu5.github.io/aspirational-manifests/getting-started.html).

The images are not uploaded to a popular repo like DockerHub, by default Aspir8 will push to your machines image store, which for most is fine, but you can also push to a local registry, as I have in the example compose below. If you do not define a ContainerRegistry in the inti stage of aspirate, simply remove the reference to the registry, and it will pull from the local images

You can use the registry listed in the below example, but this is the one I use, so the images may be testing, best option is to clone and push to your machine or registry.

Once installed, run the following command from the host directory

```commandline
aspirate generate --output-format compose
```
Change the following in the docker compose, you will have to adjust for your enviornment

Add this to the background-download section under image, make sure to set the env below to match those shares
```yaml
    volumes:
      - "<YOUR SHARE LOCATION, WILL DOWNLOAD RELATIVE TO THIS>/share"
      - "<PLUGIN DIRECTORY>:/plugins"
...
    environment:
      MaxConcurrentThreads: "10"
      ShareLocation: "/share"
      PluginsLocation: "/plugins"
```

Change the API ports, remove the 2 ports and only have this
```yaml
    ports:
    - target: 5255
      published: 5255
```

Delete the restart for migrations
```yaml
    restart: unless-stopped
```

Example Complete, be sure to change things like share paths and password in connection string
```yaml
services:
  # Dashboard
  aspire-dashboard:
    container_name: "archiver-dashboard"
    image: "mcr.microsoft.com/dotnet/aspire-dashboard:8.0"
    environment:
      DOTNET_DASHBOARD_UNSECURED_ALLOW_ANONYMOUS: "true"
    networks:
      home_network:
        ipv4_address: 10.10.10.90 # Port 18888
    restart: unless-stopped

  # SQL
  sql:
    container_name: "archiver-sql"
    image: "mcr.microsoft.com/mssql/server:2022-latest"
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: "PASSWORD"
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:18889"
      OTEL_SERVICE_NAME: "sql"
    volumes:
    - "download-cache-data:/var/opt/mssql"
    network_mode: service:aspire-dashboard # port 1433
    restart: unless-stopped

  # SQL Migrations
  migrations:
    container_name: "archiver-migrations"
    image: "ghcr.io/pauljoda/the-archiver-migrations:latest"
    network_mode: service:aspire-dashboard 
    environment:
      OTEL_DOTNET_EXPERIMENTAL_OTLP_EMIT_EXCEPTION_LOG_ATTRIBUTES: "true"
      OTEL_DOTNET_EXPERIMENTAL_OTLP_EMIT_EVENT_LOG_ATTRIBUTES: "true"
      OTEL_DOTNET_EXPERIMENTAL_OTLP_RETRY: "in_memory"
      ConnectionStrings__download-cache: "Server=localhost,1433;User ID=sa;Password=PASSWORD;TrustServerCertificate=true;Database=download-cache"
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:18889"
      OTEL_SERVICE_NAME: "migrations"

  # Web API
  api:
    container_name: "archiver-api"
    image: "ghcr.io/pauljoda/the-archiver-api:latest"
    environment:
      OTEL_DOTNET_EXPERIMENTAL_OTLP_EMIT_EXCEPTION_LOG_ATTRIBUTES: "true"
      OTEL_DOTNET_EXPERIMENTAL_OTLP_EMIT_EVENT_LOG_ATTRIBUTES: "true"
      OTEL_DOTNET_EXPERIMENTAL_OTLP_RETRY: "in_memory"
      ASPNETCORE_FORWARDEDHEADERS_ENABLED: "true"
      Kestrel__Endpoints__http__Url: "http://*:5255"
      ConnectionStrings__download-cache: "Server=localhost,1433;User ID=sa;Password=PASSWORD;TrustServerCertificate=true;Database=download-cache"
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:18889"
      OTEL_SERVICE_NAME: "api"
    network_mode: service:aspire-dashboard # port 5255
    restart: unless-stopped

  # Background Downloader
  background-download:
    container_name: "archiver-background-download"
    image: "ghcr.io/pauljoda/the-archiver-downloadworker:latest"
    user: "100:100"
    network_mode: service:aspire-dashboard
    volumes:
      - "/path/to/storage:/share"
      - "/path/to/Plugins:/plugins"
    environment:
      OTEL_DOTNET_EXPERIMENTAL_OTLP_EMIT_EXCEPTION_LOG_ATTRIBUTES: "true"
      OTEL_DOTNET_EXPERIMENTAL_OTLP_EMIT_EVENT_LOG_ATTRIBUTES: "true"
      OTEL_DOTNET_EXPERIMENTAL_OTLP_RETRY: "in_memory"
      MaxConcurrentThreads: "10"
      ShareLocation: "/share"
      PluginsLocation: "/plugins"
      NotificationUrl: "https://notify.YOURDOMAINEXAMPLE.com/local"
      ConnectionStrings__download-cache: "Server=localhost,1433;User ID=sa;Password=PASSWORD;TrustServerCertificate=true;Database=download-cache"
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:18889"
      OTEL_SERVICE_NAME: "background-download"
    restart: unless-stopped

  # FFMPEG
  ffmpeg:
    container_name: "archiver-ffmpeg"
    image: "ghcr.io/pauljoda/the-archiver-ffmpeg:latest"
    user: "1000:1000"
    network_mode: service:aspire-dashboard 
    volumes:
      - "/home/path/:/scan"
    environment:
      ScanLocation: "/scan" 
      OTEL_DOTNET_EXPERIMENTAL_OTLP_EMIT_EXCEPTION_LOG_ATTRIBUTES: "true"
      OTEL_DOTNET_EXPERIMENTAL_OTLP_EMIT_EVENT_LOG_ATTRIBUTES: "true"
      OTEL_DOTNET_EXPERIMENTAL_OTLP_RETRY: "in_memory"
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:18889"
      OTEL_SERVICE_NAME: "ffmpeg"

# Voluemes
volumes:
  download-cache-data: {}

# Network
networks:
  home_network:
    external: true

```
If you setup the dotnet secret correct PASSWORD in sql and connection strings will be proper, if not change it to whatever you like here for production

Also, it is worth setting up an .env for reused variables like the password, this is a template I use and for the sake of keeping it portable I have it all in this compose example
