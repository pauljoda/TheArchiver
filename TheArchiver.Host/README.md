## Aspire Command

To Generate the Compose
```commandline
aspirate generate --output-format compose --non-interactive --secret-password teamneat
```
Change the following in the docker compose

Add this to the background-download section under image, make sure to set the env below to match those shares
```yaml
    volumes:
      - "D:\\Share:/share"
      - "D:\\TheArchiver\\Plugins:/plugins"
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

Example Complete
```yaml
services:
  aspire-dashboard:
    container_name: "aspire-dashboard"
    image: "mcr.microsoft.com/dotnet/aspire-dashboard:8.0"
    environment:
      DOTNET_DASHBOARD_UNSECURED_ALLOW_ANONYMOUS: "true"
    ports:
    - target: 18888
      published: 18888
    restart: unless-stopped
  sql:
    container_name: "sql"
    image: "mcr.microsoft.com/mssql/server:2022-latest"
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: "I0ftheT!ger"
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://aspire-dashboard:18889"
      OTEL_SERVICE_NAME: "sql"
    volumes:
    - "download-cache-data:/var/opt/mssql"
    ports:
    - target: 1433
      published: 1433
    restart: unless-stopped
  migrations:
    container_name: "migrations"
    image: "10.1.20.3:5050/download-manager/migrations:latest"
    environment:
      OTEL_DOTNET_EXPERIMENTAL_OTLP_EMIT_EXCEPTION_LOG_ATTRIBUTES: "true"
      OTEL_DOTNET_EXPERIMENTAL_OTLP_EMIT_EVENT_LOG_ATTRIBUTES: "true"
      OTEL_DOTNET_EXPERIMENTAL_OTLP_RETRY: "in_memory"
      ConnectionStrings__download-cache: "Server=sql,1433;User ID=sa;Password=I0ftheT!ger;TrustServerCertificate=true;Database=download-cache"
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://aspire-dashboard:18889"
      OTEL_SERVICE_NAME: "migrations"
  api:
    container_name: "api"
    image: "10.1.20.3:5050/download-manager/api:latest"
    environment:
      OTEL_DOTNET_EXPERIMENTAL_OTLP_EMIT_EXCEPTION_LOG_ATTRIBUTES: "true"
      OTEL_DOTNET_EXPERIMENTAL_OTLP_EMIT_EVENT_LOG_ATTRIBUTES: "true"
      OTEL_DOTNET_EXPERIMENTAL_OTLP_RETRY: "in_memory"
      ASPNETCORE_FORWARDEDHEADERS_ENABLED: "true"
      Kestrel__Endpoints__http__Url: "http://*:5255"
      ConnectionStrings__download-cache: "Server=sql,1433;User ID=sa;Password=I0ftheT!ger;TrustServerCertificate=true;Database=download-cache"
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://aspire-dashboard:18889"
      OTEL_SERVICE_NAME: "api"
    ports:
    - target: 5255
      published: 5255
    restart: unless-stopped
  background-download:
    container_name: "background-download"
    image: "10.1.20.3:5050/download-manager/background-download:latest"
    volumes:
      - "D:\\Share:/share"
      - "D:\\TheArchiver\\Plugins:/plugins"
    environment:
      OTEL_DOTNET_EXPERIMENTAL_OTLP_EMIT_EXCEPTION_LOG_ATTRIBUTES: "true"
      OTEL_DOTNET_EXPERIMENTAL_OTLP_EMIT_EVENT_LOG_ATTRIBUTES: "true"
      OTEL_DOTNET_EXPERIMENTAL_OTLP_RETRY: "in_memory"
      MaxConcurrentThreads: "10"
      ShareLocation: "/share"
      PluginsLocation: "/plugins"
      ConnectionStrings__download-cache: "Server=sql,1433;User ID=sa;Password=I0ftheT!ger;TrustServerCertificate=true;Database=download-cache"
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://aspire-dashboard:18889"
      OTEL_SERVICE_NAME: "background-download"
    restart: unless-stopped
volumes:
  download-cache-data: {}

```