using System.Text.Json.Nodes;
using BtoanAiNet.FunctionCalling.Services;

namespace BtoanAiNet.Services
{
    public interface IAgentToolLoopOrchestrator
    {
        Task<string> ExecutePromptWithToolsAsync(string userPrompt, int maxToolTurns = 5, CancellationToken cancellationToken = default);
    }

    public class AgentToolLoopOrchestrator : IAgentToolLoopOrchestrator
    {
        private readonly IGeminiService _geminiService;
        private readonly IToolRegistry _toolRegistry;
        private readonly IFunctionCallingDispatcher _dispatcher;
        private readonly ILogger<AgentToolLoopOrchestrator> _logger;

        public AgentToolLoopOrchestrator(
            IGeminiService geminiService,
            IToolRegistry toolRegistry,
            IFunctionCallingDispatcher dispatcher,
            ILogger<AgentToolLoopOrchestrator> logger)
        {
            _geminiService = geminiService;
            _toolRegistry = toolRegistry;
            _dispatcher = dispatcher;
            _logger = logger;
        }

        public async Task<string> ExecutePromptWithToolsAsync(string userPrompt, int maxToolTurns = 5, CancellationToken cancellationToken = default)
        {
            var toolsSchema = _toolRegistry.GetOpenAiToolsDefinition();

            var messages = new JsonArray
            {
                new JsonObject
                {
                    ["role"] = "user",
                    ["parts"] = new JsonArray { new JsonObject { ["text"] = userPrompt } }
                }
            };

            int currentTurn = 0;
            while (currentTurn < maxToolTurns)
            {
                currentTurn++;

                var payload = new JsonObject
                {
                    ["contents"] = messages.DeepClone(),
                    ["tools"] = new JsonArray { new JsonObject { ["functionDeclarations"] = toolsSchema.DeepClone() } }
                };

                var (success, responseData, _, error) = await _geminiService.GenerateContentAsync("gemini-2.5-pro", payload);
                if (!success || responseData == null)
                {
                    return $"AI Generation Failed: {error}";
                }

                var candidate = responseData["candidates"]?[0]?["content"];
                if (candidate == null)
                {
                    return "AI Generation returned empty candidate response.";
                }

                var functionCall = candidate["parts"]?[0]?["functionCall"];

                if (functionCall != null)
                {
                    string toolName = functionCall["name"]?.ToString() ?? string.Empty;
                    string argsJson = functionCall["args"]?.ToJsonString() ?? "{}";

                    _logger.LogInformation("Agent requested Tool Calling [Turn {Turn}]: {ToolName}", currentTurn, toolName);

                    var toolResult = await _dispatcher.DispatchAsync(toolName, argsJson, cancellationToken);
                    string toolOutput = toolResult.Success ? toolResult.Output : $"Error: {toolResult.Error}";

                    messages.Add(candidate.DeepClone());

                    messages.Add(new JsonObject
                    {
                        ["role"] = "function",
                        ["parts"] = new JsonArray
                        {
                            new JsonObject
                            {
                                ["functionResponse"] = new JsonObject
                                {
                                    ["name"] = toolName,
                                    ["response"] = new JsonObject { ["output"] = toolOutput }
                                }
                            }
                        }
                    });
                }
                else
                {
                    string finalResponse = candidate?["parts"]?[0]?["text"]?.ToString() ?? "Task completed.";
                    return finalResponse;
                }
            }

            return "Agent reached maximum tool execution iterations limit.";
        }
    }
}
