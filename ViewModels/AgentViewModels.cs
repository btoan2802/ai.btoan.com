namespace BtoanAiNet.ViewModels
{
    public class AgentTaskRequestModel
    {
        public int ProjectId { get; set; }
        public string Prompt { get; set; } = string.Empty;
        public string TargetDirectory { get; set; } = string.Empty;
    }

    public class FileChangeProposal
    {
        public string RelativePath { get; set; } = string.Empty;
        public string ActionType { get; set; } = "MODIFY"; // MODIFY, CREATE, DELETE
        public string OriginalContent { get; set; } = string.Empty;
        public string ProposedContent { get; set; } = string.Empty;
        public string Diff { get; set; } = string.Empty;
    }

    public class AgentProposalResponseModel
    {
        public bool Ok { get; set; } = true;
        public string Summary { get; set; } = string.Empty;
        public List<FileChangeProposal> Proposals { get; set; } = new();
        public string Error { get; set; } = string.Empty;
    }

    public class AgentApplyRequestModel
    {
        public int ProjectId { get; set; }
        public List<FileChangeProposal> ApprovedProposals { get; set; } = new();
        public string TargetDirectory { get; set; } = string.Empty;
    }

    public class AgentExecutionResultModel
    {
        public bool Ok { get; set; } = true;
        public bool BuildSucceeded { get; set; } = true;
        public List<string> AppliedFiles { get; set; } = new();
        public string BuildOutput { get; set; } = string.Empty;
        public int AutoFixAttempts { get; set; } = 0;
        public string Error { get; set; } = string.Empty;
    }

    public class CreateProjectRequestModel
    {
        public int UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Template { get; set; } = "dotnet-mvc";
    }

    public class SaveWorkspaceFileRequestModel
    {
        public int ProjectId { get; set; }
        public string Path { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }

    public class RollbackRequestModel
    {
        public int VersionId { get; set; }
    }

    public class ImportGitRequestModel
    {
        public int UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string GitUrl { get; set; } = string.Empty;
    }

    public class CreateItemRequestModel
    {
        public int ProjectId { get; set; }
        public string Path { get; set; } = string.Empty;
        public bool IsDirectory { get; set; }
    }

    public class RenameItemRequestModel
    {
        public int ProjectId { get; set; }
        public string OldPath { get; set; } = string.Empty;
        public string NewPath { get; set; } = string.Empty;
    }

    public class DeleteItemRequestModel
    {
        public int ProjectId { get; set; }
        public string Path { get; set; } = string.Empty;
    }

    public class ExecuteTerminalRequestModel
    {
        public int ProjectId { get; set; }
        public string Command { get; set; } = string.Empty;
    }
}
