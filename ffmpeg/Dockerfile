FROM mcr.microsoft.com/dotnet/runtime:9.0 AS base
USER $APP_UID
WORKDIR /app

# Add FFMPEG
USER root
RUN apt-get -y update
RUN apt-get -y upgrade
RUN apt-get install -y ffmpeg

USER $APP_UID
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["ffmpeg/ffmpeg.csproj", "ffmpeg/"]
RUN dotnet restore "ffmpeg/ffmpeg.csproj"
COPY . .
WORKDIR "/src/ffmpeg"
RUN dotnet build "ffmpeg.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "ffmpeg.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "ffmpeg.dll"]
