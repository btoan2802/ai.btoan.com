# Stage 1: Build & Publish
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src

# Copy project file and restore dependencies
COPY ["BtoanAiNet.csproj", "./"]
RUN dotnet restore "BtoanAiNet.csproj"

# Copy all project files and build
COPY . .
RUN dotnet publish "BtoanAiNet.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS runtime
WORKDIR /app

# Install bash, curl and git for terminal and workspace operations
RUN apt-get update && apt-get install -y curl git && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

# Expose ports (Render, Koyeb, HF default to 8080 or PORT env)
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

ENTRYPOINT ["dotnet", "BtoanAiNet.dll"]
