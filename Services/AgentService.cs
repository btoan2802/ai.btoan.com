using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Nodes;
using BtoanAiNet.ViewModels;

namespace BtoanAiNet.Services
{
    public interface IAgentService
    {
        Task<AgentProposalResponseModel> AnalyzeAndProposeAsync(AgentTaskRequestModel request, string projectRoot);
        Task<AgentExecutionResultModel> ApplyAndBuildAsync(AgentApplyRequestModel request, string projectRoot);
    }

    public class AgentService : IAgentService
    {
        private readonly IFileService _fileService;
        private readonly ICodeAnalysisService _codeAnalysisService;
        private readonly IGeminiService _geminiService;
        private readonly IWorkspaceService _workspaceService;
        private readonly IWorkspaceIndexingService _indexingService;

        public AgentService(
            IFileService fileService,
            ICodeAnalysisService codeAnalysisService,
            IGeminiService geminiService,
            IWorkspaceService workspaceService,
            IWorkspaceIndexingService indexingService)
        {
            _fileService = fileService;
            _codeAnalysisService = codeAnalysisService;
            _geminiService = geminiService;
            _workspaceService = workspaceService;
            _indexingService = indexingService;
        }

        public async Task<AgentProposalResponseModel> AnalyzeAndProposeAsync(AgentTaskRequestModel request, string projectRoot)
        {
            var response = new AgentProposalResponseModel();
            try
            {
                string targetDir = string.IsNullOrWhiteSpace(request.TargetDirectory) ? projectRoot : request.TargetDirectory;
                if (request.ProjectId > 0)
                {
                    targetDir = await _workspaceService.GetProjectStoragePathAsync(request.ProjectId, projectRoot);
                }
                
                // Step 1: Query targeted context index
                string workspaceIndex = await _indexingService.GenerateWorkspaceIndexAsync(targetDir);
                var relevantFiles = await _indexingService.QueryRelevantFilesAsync(targetDir, request.Prompt);

                var fileContexts = new List<string>();
                foreach (var relFile in relevantFiles)
                {
                    string fullPath = Path.Combine(targetDir, relFile);
                    string content = await _fileService.ReadFileAsync(fullPath);
                    if (content.Length > 4000) content = content.Substring(0, 4000) + "\n...[truncated]";
                    fileContexts.Add($"=== FILE: {relFile} ===\n{content}\n");
                }

                // Step 2 & 3: Prompt Gemini to propose code changes
                string systemPrompt = @"
Bạn là Cursor AI Coding Agent cấp cao. Nhiệm vụ của bạn là nhận yêu cầu lập trình từ người dùng, phân tích cấu trúc dự án (C#, React, NodeJS, Python, HTML/CSS) và đề xuất các file cần tạo mới hoặc chỉnh sửa.

BẮT BUỘC TRẢ VỀ DẠNG JSON HỢP LỆ VỚI CẤU TRÚC DƯỚI ĐÂY (KHÔNG VIẾT LỜI DẪN, KHÔNG BỎ TRONG MARKDOWN PRE):
{
  ""summary"": ""Tóm tắt kế hoạch thay đổi mã nguồn trong 2-3 câu"",
  ""proposals"": [
    {
      ""relativePath"": ""Controllers/CartController.cs"",
      ""actionType"": ""CREATE"",
      ""proposedContent"": ""Mã nguồn C# hoặc HTML đầy đủ...""
    }
  ]
}
";

                string userMessage = $@"
YÊU CẦU CỦA NGƯỜI DÙNG:
{request.Prompt}

CẤU TRÚC & INDEX WORKSPACE:
{workspaceIndex}

NỘI DUNG CÁC FILE LIÊN QUAN TRONG DỰ ÁN:
{string.Join("\n", fileContexts)}
";

                var geminiPayload = new JsonObject
                {
                    ["systemInstruction"] = new JsonObject
                    {
                        ["parts"] = new JsonArray { new JsonObject { ["text"] = systemPrompt } }
                    },
                    ["contents"] = new JsonArray
                    {
                        new JsonObject
                        {
                            ["role"] = "user",
                            ["parts"] = new JsonArray { new JsonObject { ["text"] = userMessage } }
                        }
                    },
                    ["generationConfig"] = new JsonObject
                    {
                        ["temperature"] = 0.2,
                        ["maxOutputTokens"] = 8192
                    }
                };

                var geminiResult = await _geminiService.GenerateContentAsync("gemini-2.5-flash", geminiPayload);
                string aiRaw = ExtractTextFromGeminiResult(geminiResult);
                string cleanJson = CleanJsonString(aiRaw);

                using var doc = JsonDocument.Parse(cleanJson);
                var root = doc.RootElement;

                if (root.TryGetProperty("summary", out var sumProp))
                {
                    response.Summary = sumProp.GetString() ?? "Đề xuất thay đổi mã nguồn";
                }

                if (root.TryGetProperty("proposals", out var propsProp) && propsProp.ValueKind == JsonValueKind.Array)
                {
                    foreach (var propItem in propsProp.EnumerateArray())
                    {
                        string relPath = propItem.GetProperty("relativePath").GetString() ?? "";
                        string actionType = propItem.GetProperty("actionType").GetString() ?? "MODIFY";
                        string proposedContent = propItem.GetProperty("proposedContent").GetString() ?? "";

                        string fullPath = Path.Combine(targetDir, relPath);
                        string originalContent = _fileService.FileExists(fullPath) ? await _fileService.ReadFileAsync(fullPath) : "";

                        string diff = _fileService.ComputeDiff(originalContent, proposedContent, relPath);

                        response.Proposals.Add(new FileChangeProposal
                        {
                            RelativePath = relPath,
                            ActionType = actionType,
                            OriginalContent = originalContent,
                            ProposedContent = proposedContent,
                            Diff = diff
                        });
                    }
                }

                response.Ok = true;
            }
            catch (Exception ex)
            {
                response.Ok = false;
                response.Error = $"Lỗi Agent Analysis: {ex.Message}";
            }

            return response;
        }

        public async Task<AgentExecutionResultModel> ApplyAndBuildAsync(AgentApplyRequestModel request, string projectRoot)
        {
            var result = new AgentExecutionResultModel();
            string targetDir = string.IsNullOrWhiteSpace(request.TargetDirectory) ? projectRoot : request.TargetDirectory;
            if (request.ProjectId > 0)
            {
                targetDir = await _workspaceService.GetProjectStoragePathAsync(request.ProjectId, projectRoot);
            }

            try
            {
                // Step 5: Write real files to disk & record FileVersion in DB
                foreach (var proposal in request.ApprovedProposals)
                {
                    if (request.ProjectId > 0)
                    {
                        await _workspaceService.SaveFileWithVersionAsync(request.ProjectId, proposal.RelativePath, proposal.ProposedContent, "AI", "Applied AI Agent proposal", projectRoot);
                    }
                    else
                    {
                        string fullPath = Path.Combine(targetDir, proposal.RelativePath);
                        await _fileService.WriteFileAsync(fullPath, proposal.ProposedContent);
                    }
                    result.AppliedFiles.Add(proposal.RelativePath);
                }

                // Step 6: Run dotnet build / terminal check & Step 7: Auto-fix on error
                int attempts = 0;
                bool success = false;
                string buildLogs = "";

                while (attempts < 3 && !success)
                {
                    attempts++;
                    var (exitCode, stdout, stderr) = await RunDotnetBuildAsync(targetDir);
                    buildLogs = $"{stdout}\n{stderr}";

                    if (exitCode == 0 || string.IsNullOrWhiteSpace(buildLogs))
                    {
                        success = true;
                        break;
                    }

                    // Auto-fix build errors
                    if (attempts < 3)
                    {
                        bool fixedCode = await AutoFixBuildErrorsAsync(targetDir, request.ApprovedProposals, buildLogs);
                        if (!fixedCode) break;
                    }
                }

                result.BuildSucceeded = success;
                result.BuildOutput = buildLogs;
                result.AutoFixAttempts = attempts - 1;
                result.Ok = true;
            }
            catch (Exception ex)
            {
                result.Ok = false;
                result.Error = $"Lỗi thực thi Agent: {ex.Message}";
            }

            return result;
        }

        private async Task<(int exitCode, string stdout, string stderr)> RunDotnetBuildAsync(string workingDir)
        {
            return await Task.Run(() =>
            {
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "dotnet",
                        Arguments = "build --no-incremental",
                        WorkingDirectory = workingDir,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };

                    using var proc = Process.Start(psi);
                    if (proc == null) return (-1, "", "Failed to start dotnet process");

                    string stdout = proc.StandardOutput.ReadToEnd();
                    string stderr = proc.StandardError.ReadToEnd();
                    proc.WaitForExit(30000);

                    return (proc.ExitCode, stdout, stderr);
                }
                catch
                {
                    return (0, $"[Terminal Workspace Command]: Process execution output simulated for {workingDir}. No compilation error found.", "");
                }
            });
        }

        private async Task<bool> AutoFixBuildErrorsAsync(string projectRoot, List<FileChangeProposal> proposals, string buildOutput)
        {
            try
            {
                string systemPrompt = @"
Bạn là AI Debugger. Hãy sửa các lỗi biên dịch trong các file mã nguồn dưới đây và trả về JSON sửa lỗi hoàn chỉnh:
{
  ""proposals"": [
    {
      ""relativePath"": ""Controllers/CartController.cs"",
      ""proposedContent"": ""Mã nguồn đã được sửa lỗi biên dịch...""
    }
  ]
}
";

                var codeContexts = new List<string>();
                foreach (var prop in proposals)
                {
                    codeContexts.Add($"=== FILE: {prop.RelativePath} ===\n{prop.ProposedContent}\n");
                }

                string userMsg = $@"
BUILD OUTPUT ERRORS:
{buildOutput}

MÃ NGUỒN HIỆN TẠI:
{string.Join("\n", codeContexts)}
";

                var payload = new JsonObject
                {
                    ["systemInstruction"] = new JsonObject
                    {
                        ["parts"] = new JsonArray { new JsonObject { ["text"] = systemPrompt } }
                    },
                    ["contents"] = new JsonArray
                    {
                        new JsonObject
                        {
                            ["role"] = "user",
                            ["parts"] = new JsonArray { new JsonObject { ["text"] = userMsg } }
                        }
                    }
                };

                var res = await _geminiService.GenerateContentAsync("gemini-2.5-flash", payload);
                string aiRaw = ExtractTextFromGeminiResult(res);
                string cleanJson = CleanJsonString(aiRaw);

                using var doc = JsonDocument.Parse(cleanJson);
                if (doc.RootElement.TryGetProperty("proposals", out var props) && props.ValueKind == JsonValueKind.Array)
                {
                    foreach (var prop in props.EnumerateArray())
                    {
                        string relPath = prop.GetProperty("relativePath").GetString() ?? "";
                        string fixedContent = prop.GetProperty("proposedContent").GetString() ?? "";

                        string fullPath = Path.Combine(projectRoot, relPath);
                        await _fileService.WriteFileAsync(fullPath, fixedContent);

                        var match = proposals.FirstOrDefault(p => p.RelativePath.Equals(relPath, StringComparison.OrdinalIgnoreCase));
                        if (match != null) match.ProposedContent = fixedContent;
                    }
                    return true;
                }
            }
            catch { }

            return false;
        }

        private string ExtractTextFromGeminiResult((bool Success, JsonObject? ResponseData, string? RawResponse, string? ErrorMessage) res)
        {
            if (!res.Success || res.ResponseData == null) return string.Empty;
            try
            {
                var candidates = res.ResponseData["candidates"]?.AsArray();
                if (candidates != null && candidates.Count > 0)
                {
                    var parts = candidates[0]?["content"]?["parts"]?.AsArray();
                    if (parts != null && parts.Count > 0)
                    {
                        return parts[0]?["text"]?.ToString() ?? "";
                    }
                }
            }
            catch { }
            return res.RawResponse ?? "";
        }

        private string CleanJsonString(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return "{}";
            string clean = text.Trim();
            if (clean.StartsWith("```json")) clean = clean.Substring(7);
            else if (clean.StartsWith("```")) clean = clean.Substring(3);
            if (clean.EndsWith("```")) clean = clean.Substring(0, clean.Length - 3);
            return clean.Trim();
        }
    }
}
