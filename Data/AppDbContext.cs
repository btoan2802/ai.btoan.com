using BtoanAiNet.Models;
using Microsoft.EntityFrameworkCore;

namespace BtoanAiNet.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; } = null!;
        public DbSet<Conversation> Conversations { get; set; } = null!;
        public DbSet<Chat> Chats { get; set; } = null!;
        public DbSet<UserMemory> UserMemories { get; set; } = null!;
        public DbSet<AiTraining> AiTrainings { get; set; } = null!;
        public DbSet<Message> Messages { get; set; } = null!;
        public DbSet<Project> Projects { get; set; } = null!;
        public DbSet<ProjectFile> ProjectFiles { get; set; } = null!;
        public DbSet<FileVersion> FileVersions { get; set; } = null!;
        public DbSet<TerminalSession> TerminalSessions { get; set; } = null!;
        public DbSet<AgentTask> AgentTasks { get; set; } = null!;
        public DbSet<AgentMessage> AgentMessages { get; set; } = null!;
        public DbSet<AgentChange> AgentChanges { get; set; } = null!;
        public DbSet<ProjectVersion> ProjectVersions { get; set; } = null!;
        public DbSet<FileSnapshot> FileSnapshots { get; set; } = null!;
        public DbSet<FileChangeHistory> FileChangeHistories { get; set; } = null!;
        public DbSet<AutonomousAgentTask> AutonomousAgentTasks { get; set; } = null!;
        public DbSet<ProjectMemory> ProjectMemories { get; set; } = null!;
        public DbSet<CodeChange> CodeChanges { get; set; } = null!;
        public DbSet<TeamAgentTask> TeamAgentTasks { get; set; } = null!;
        public DbSet<AgentTeamMessage> AgentTeamMessages { get; set; } = null!;
        public DbSet<ProjectKnowledgeBase> ProjectKnowledgeBases { get; set; } = null!;
        public DbSet<Deployment> Deployments { get; set; } = null!;
        public DbSet<ProjectEnvironmentVariable> ProjectEnvironmentVariables { get; set; } = null!;
        public DbSet<DeploymentLog> DeploymentLogs { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<User>(entity =>
            {
                entity.HasIndex(e => e.Username).IsUnique();
            });

            modelBuilder.Entity<Project>(entity =>
            {
                entity.HasIndex(e => e.UserId);
                entity.HasMany(e => e.Files)
                      .WithOne(f => f.Project)
                      .HasForeignKey(f => f.ProjectId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<ProjectFile>(entity =>
            {
                entity.HasIndex(e => new { e.ProjectId, e.RelativePath }).IsUnique();
                entity.HasMany(e => e.Versions)
                      .WithOne(v => v.ProjectFile)
                      .HasForeignKey(v => v.ProjectFileId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<FileVersion>(entity =>
            {
                entity.HasIndex(e => new { e.ProjectFileId, e.VersionNumber });
            });
        }
    }
}
