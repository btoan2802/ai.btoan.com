using BtoanAiNet.Data;
using BtoanAiNet.Repositories;
using BtoanAiNet.Services;
using BtoanAiNet.Services.VectorDb;
using BtoanAiNet.Messaging.Consumers;
using BtoanAiNet.FunctionCalling.Services;
using BtoanAiNet.FunctionCalling.Tools;
using MassTransit;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();

var dbProvider = builder.Configuration.GetValue<string>("DbProvider") ?? "SqlServer";
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
                    ?? builder.Configuration.GetConnectionString("SqlServerConnection");

if (!string.IsNullOrEmpty(connectionString))
{
    if (dbProvider.Equals("SqlServer", StringComparison.OrdinalIgnoreCase) || connectionString.Contains("FS-TOANNB21") || connectionString.Contains("Trusted_Connection") || connectionString.Contains("(local)"))
    {
        builder.Services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(connectionString));
    }
    else
    {
        builder.Services.AddDbContext<AppDbContext>(options =>
            options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 30))));
    }
}

builder.Services.AddHttpClient();

// Register Repositories
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IConversationRepository, ConversationRepository>();
builder.Services.AddScoped<IMemoryRepository, MemoryRepository>();
builder.Services.AddScoped<ITrainingRepository, TrainingRepository>();

// Register Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddSingleton<IFaceAuthService, FaceAuthService>();
builder.Services.AddScoped<IGoogleAuthService, GoogleAuthService>();
builder.Services.AddScoped<IGeminiService, GeminiService>();
builder.Services.AddScoped<IIntentEngineService, IntentEngineService>();
builder.Services.AddScoped<IMemoryService, MemoryService>();
builder.Services.AddScoped<ITrainingService, TrainingService>();
builder.Services.AddScoped<IChatService, ChatService>();
builder.Services.AddScoped<IImageGenerationService, ImageGenerationService>();
builder.Services.AddScoped<IVideoGenerationService, VideoGenerationService>();
builder.Services.AddScoped<IMusicGenerationService, MusicGenerationService>();
builder.Services.AddScoped<IStorageService, StorageService>();
builder.Services.AddScoped<IFileService, FileService>();
builder.Services.AddScoped<ICodeAnalysisService, CodeAnalysisService>();
builder.Services.AddScoped<IProjectScannerService, ProjectScannerService>();
builder.Services.AddScoped<IFileEditorService, FileEditorService>();
builder.Services.AddScoped<ICodeDiffService, CodeDiffService>();
builder.Services.AddScoped<IWorkspaceService, WorkspaceService>();
builder.Services.AddScoped<IWorkspaceIndexingService, WorkspaceIndexingService>();
builder.Services.AddScoped<ITerminalExecutionService, TerminalExecutionService>();
builder.Services.AddScoped<IAgentService, AgentService>();
builder.Services.AddScoped<IRuntimeService, RuntimeService>();
builder.Services.AddScoped<IAgentWorkflowService, AgentWorkflowService>();
builder.Services.AddScoped<IWorkspaceEditService, WorkspaceEditService>();
builder.Services.AddScoped<IVersionControlService, VersionControlService>();
builder.Services.AddSingleton<IProjectRuntimeManagerService, ProjectRuntimeManagerService>();
builder.Services.AddScoped<IContextRetrieverService, ContextRetrieverService>();
builder.Services.AddScoped<IAgentOrchestrator, AgentOrchestrator>();
builder.Services.AddScoped<IDiffService, DiffService>();
builder.Services.AddScoped<IAgentTeamManager, AgentTeamManager>();
builder.Services.AddScoped<IDeploymentService, DeploymentService>();

// Vector Database & Semantic Embeddings
builder.Services.AddHttpClient<IVectorDatabaseService, QdrantVectorDatabaseService>();
builder.Services.AddHttpClient<IEmbeddingService, EmbeddingService>();
builder.Services.AddSingleton<ISemanticChunkingService, SemanticChunkingService>();

// MassTransit Message Queue (RabbitMQ with In-Memory fallback for Dev)
builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<MediaGenerationConsumer>();

    string? rabbitHost = builder.Configuration["RabbitMQ:Host"];
    if (!string.IsNullOrEmpty(rabbitHost) && !rabbitHost.Equals("in-memory", StringComparison.OrdinalIgnoreCase))
    {
        x.UsingRabbitMq((context, cfg) =>
        {
            cfg.Host(rabbitHost, "/", h =>
            {
                h.Username(builder.Configuration["RabbitMQ:User"] ?? "guest");
                h.Password(builder.Configuration["RabbitMQ:Pass"] ?? "guest");
            });

            cfg.ReceiveEndpoint("btoan-media-generation-queue", e =>
            {
                e.ConfigureConsumer<MediaGenerationConsumer>(context);
            });
        });
    }
    else
    {
        x.UsingInMemory((context, cfg) =>
        {
            cfg.ConfigureEndpoints(context);
        });
    }
});

// Native Function Calling Engine
builder.Services.AddSingleton<IToolRegistry>(sp =>
{
    var registry = new ToolRegistry();
    registry.RegisterServiceTools<IWorkspaceTools>();
    return registry;
});
builder.Services.AddScoped<IWorkspaceTools, WorkspaceTools>();
builder.Services.AddScoped<IFunctionCallingDispatcher, FunctionCallingDispatcher>();
builder.Services.AddScoped<IAgentToolLoopOrchestrator, AgentToolLoopOrchestrator>();

builder.Services.AddSignalR();

builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromHours(24);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

builder.Services.AddHttpContextAccessor();

var app = builder.Build();

// Auto ensure DB tables created for Workspace projects
using (var scope = app.Services.CreateScope())
{
    try
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        try
        {
            dbContext.Database.EnsureCreated();
        }
        catch (Exception initEx)
        {
            Console.WriteLine($"DB EnsureCreated Warning: {initEx.Message}");
        }

        string sql = @"
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Projects]') AND name = 'UserId')
BEGIN
    DROP TABLE [dbo].[Projects];
END

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ProjectFiles]') AND name = 'ProjectId')
BEGIN
    DROP TABLE [dbo].[ProjectFiles];
END

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FileVersions]') AND name = 'ProjectFileId')
BEGIN
    DROP TABLE [dbo].[FileVersions];
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[projects]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[projects] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [user_id] INT NOT NULL,
        [name] NVARCHAR(100) NOT NULL,
        [description] NVARCHAR(255) NULL,
        [template] NVARCHAR(50) NOT NULL,
        [storage_path] NVARCHAR(500) NOT NULL,
        [created_at] DATETIME2 NOT NULL,
        [updated_at] DATETIME2 NOT NULL
    );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[project_files]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[project_files] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [project_id] INT NOT NULL,
        [relative_path] NVARCHAR(500) NOT NULL,
        [language] NVARCHAR(50) NOT NULL,
        [content] NVARCHAR(MAX) NOT NULL,
        [is_directory] BIT NOT NULL DEFAULT 0,
        [updated_at] DATETIME2 NOT NULL
    );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[file_versions]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[file_versions] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [project_file_id] INT NOT NULL,
        [version_number] INT NOT NULL,
        [content] NVARCHAR(MAX) NOT NULL,
        [change_summary] NVARCHAR(255) NULL,
        [created_by] NVARCHAR(50) NOT NULL,
        [created_at] DATETIME2 NOT NULL
    );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[terminal_sessions]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[terminal_sessions] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [project_id] INT NOT NULL,
        [user_id] INT NOT NULL,
        [command] NVARCHAR(500) NOT NULL,
        [status] NVARCHAR(50) NOT NULL,
        [stdout] NVARCHAR(MAX) NULL,
        [stderr] NVARCHAR(MAX) NULL,
        [exit_code] INT NULL,
        [started_at] DATETIME2 NOT NULL,
        [finished_at] DATETIME2 NULL
    );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[agent_tasks]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[agent_tasks] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [project_id] INT NOT NULL,
        [user_id] INT NOT NULL,
        [prompt] NVARCHAR(MAX) NOT NULL,
        [status] NVARCHAR(50) NOT NULL,
        [summary] NVARCHAR(MAX) NULL,
        [created_at] DATETIME2 NOT NULL,
        [completed_at] DATETIME2 NULL
    );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[agent_messages]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[agent_messages] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [agent_task_id] INT NOT NULL,
        [role] NVARCHAR(20) NOT NULL,
        [content] NVARCHAR(MAX) NOT NULL,
        [created_at] DATETIME2 NOT NULL
    );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[agent_changes]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[agent_changes] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [agent_task_id] INT NOT NULL,
        [file_path] NVARCHAR(500) NOT NULL,
        [old_content] NVARCHAR(MAX) NULL,
        [new_content] NVARCHAR(MAX) NULL,
        [change_type] NVARCHAR(20) NOT NULL
    );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[project_versions]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[project_versions] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [project_id] INT NOT NULL,
        [user_id] INT NOT NULL,
        [parent_version_id] INT NULL,
        [version_number] INT NOT NULL,
        [commit_message] NVARCHAR(255) NOT NULL,
        [created_by_agent] BIT NOT NULL,
        [created_at] DATETIME2 NOT NULL
    );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[file_snapshots]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[file_snapshots] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [project_version_id] INT NOT NULL,
        [file_path] NVARCHAR(500) NOT NULL,
        [content] NVARCHAR(MAX) NOT NULL,
        [file_hash] NVARCHAR(64) NOT NULL,
        [created_at] DATETIME2 NOT NULL
    );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[file_change_histories]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[file_change_histories] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [project_version_id] INT NOT NULL,
        [file_path] NVARCHAR(500) NOT NULL,
        [action] NVARCHAR(20) NOT NULL,
        [old_hash] NVARCHAR(64) NULL,
        [new_hash] NVARCHAR(64) NULL
    );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[autonomous_agent_tasks]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[autonomous_agent_tasks] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [project_id] INT NOT NULL,
        [parent_task_id] INT NULL,
        [title] NVARCHAR(255) NOT NULL,
        [description] NVARCHAR(MAX) NULL,
        [status] NVARCHAR(50) NOT NULL,
        [execution_order] INT NOT NULL,
        [created_at] DATETIME2 NOT NULL,
        [completed_at] DATETIME2 NULL
    );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[project_memories]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[project_memories] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [project_id] INT NOT NULL,
        [memory_key] NVARCHAR(100) NOT NULL,
        [memory_value] NVARCHAR(MAX) NOT NULL,
        [updated_at] DATETIME2 NOT NULL
    );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[code_changes]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[code_changes] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [agent_task_id] INT NOT NULL,
        [project_id] INT NOT NULL,
        [file_path] NVARCHAR(500) NOT NULL,
        [old_content] NVARCHAR(MAX) NULL,
        [new_content] NVARCHAR(MAX) NULL,
        [diff_text] NVARCHAR(MAX) NULL,
        [status] NVARCHAR(20) NOT NULL,
        [ai_comment] NVARCHAR(MAX) NULL,
        [security_warning_count] INT NOT NULL DEFAULT 0,
        [created_at] DATETIME2 NOT NULL
    );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[team_agent_tasks]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[team_agent_tasks] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [project_id] INT NOT NULL,
        [assigned_agent] NVARCHAR(50) NOT NULL,
        [title] NVARCHAR(255) NOT NULL,
        [description] NVARCHAR(MAX) NULL,
        [priority] NVARCHAR(20) NOT NULL,
        [status] NVARCHAR(50) NOT NULL,
        [execution_order] INT NOT NULL,
        [created_at] DATETIME2 NOT NULL,
        [completed_at] DATETIME2 NULL
    );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[agent_team_messages]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[agent_team_messages] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [project_id] INT NOT NULL,
        [team_task_id] INT NULL,
        [from_agent] NVARCHAR(50) NOT NULL,
        [to_agent] NVARCHAR(50) NOT NULL,
        [message] NVARCHAR(MAX) NOT NULL,
        [created_at] DATETIME2 NOT NULL
    );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[project_knowledge_bases]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[project_knowledge_bases] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [project_id] INT NOT NULL,
        [topic] NVARCHAR(100) NOT NULL,
        [details] NVARCHAR(MAX) NOT NULL,
        [updated_at] DATETIME2 NOT NULL
    );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[deployments]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[deployments] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [project_id] INT NOT NULL,
        [user_id] INT NOT NULL,
        [environment] NVARCHAR(20) NOT NULL,
        [provider] NVARCHAR(50) NOT NULL,
        [status] NVARCHAR(20) NOT NULL,
        [url] NVARCHAR(255) NOT NULL,
        [container_id] NVARCHAR(100) NULL,
        [port] INT NOT NULL,
        [detected_framework] NVARCHAR(50) NOT NULL,
        [created_at] DATETIME2 NOT NULL,
        [updated_at] DATETIME2 NOT NULL
    );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[project_env_vars]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[project_env_vars] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [project_id] INT NOT NULL,
        [environment] NVARCHAR(20) NOT NULL,
        [key_name] NVARCHAR(100) NOT NULL,
        [encrypted_value] NVARCHAR(MAX) NOT NULL,
        [created_at] DATETIME2 NOT NULL
    );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[deployment_logs]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[deployment_logs] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [deployment_id] INT NOT NULL,
        [step] NVARCHAR(100) NOT NULL,
        [message] NVARCHAR(MAX) NOT NULL,
        [log_level] NVARCHAR(20) NOT NULL,
        [timestamp] DATETIME2 NOT NULL
    );
END
";
        if (dbProvider.Equals("SqlServer", StringComparison.OrdinalIgnoreCase))
        {
            dbContext.Database.ExecuteSqlRaw(sql);
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"DB AutoInit Warning: {ex.Message}");
    }
}

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

// Enable serving face-api model shard files (files without extension)
app.UseStaticFiles(new StaticFileOptions
{
    ServeUnknownFileTypes = true
});

app.UseRouting();

app.UseSession();
app.UseAuthorization();

app.MapControllerRoute(
    name: "conversation",
    pattern: "c/{id?}",
    defaults: new { controller = "Home", action = "Index" });

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.MapHub<BtoanAiNet.Hubs.TerminalHub>("/hubs/terminal");
app.MapHub<BtoanAiNet.Hubs.WorkspaceHub>("/ws/workspace");

app.Run();
