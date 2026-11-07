using System.Text.Json;
using System.Text.Json.Nodes;

namespace BtoanAiNet.FunctionCalling.Services
{
    public record ToolExecutionResult(bool Success, string Output, string? Error);

    public interface IFunctionCallingDispatcher
    {
        Task<ToolExecutionResult> DispatchAsync(string toolName, string argumentsJson, CancellationToken cancellationToken = default);
    }

    public class FunctionCallingDispatcher : IFunctionCallingDispatcher
    {
        private readonly IToolRegistry _registry;
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<FunctionCallingDispatcher> _logger;

        public FunctionCallingDispatcher(
            IToolRegistry registry, 
            IServiceProvider serviceProvider,
            ILogger<FunctionCallingDispatcher> logger)
        {
            _registry = registry;
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        public async Task<ToolExecutionResult> DispatchAsync(string toolName, string argumentsJson, CancellationToken cancellationToken = default)
        {
            var tool = _registry.GetTool(toolName);
            if (tool == null)
            {
                return new ToolExecutionResult(false, string.Empty, $"Tool '{toolName}' not found in registry.");
            }

            try
            {
                using var scope = _serviceProvider.CreateScope();
                var serviceInstance = scope.ServiceProvider.GetRequiredService(tool.ServiceType);

                var argsNode = JsonNode.Parse(string.IsNullOrWhiteSpace(argumentsJson) ? "{}" : argumentsJson) as JsonObject
                               ?? new JsonObject();

                var methodParams = tool.Method.GetParameters();
                var invokeArgs = new object?[methodParams.Length];

                for (int i = 0; i < methodParams.Length; i++)
                {
                    var p = methodParams[i];
                    if (p.Name != null && argsNode.TryGetPropertyValue(p.Name, out var jsonVal) && jsonVal != null)
                    {
                        invokeArgs[i] = JsonSerializer.Deserialize(jsonVal.ToJsonString(), p.ParameterType);
                    }
                    else
                    {
                        invokeArgs[i] = p.HasDefaultValue ? p.DefaultValue : null;
                    }
                }

                _logger.LogInformation("Invoking Native Tool: {ToolName} with Args: {Args}", toolName, argumentsJson);

                object? resultObj = tool.Method.Invoke(serviceInstance, invokeArgs);

                string output;
                if (resultObj is Task task)
                {
                    await task;
                    var resultProp = task.GetType().GetProperty("Result");
                    output = resultProp?.GetValue(task)?.ToString() ?? "OK";
                }
                else
                {
                    output = resultObj?.ToString() ?? "OK";
                }

                return new ToolExecutionResult(true, output, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Tool Dispatch Execution Error: {ToolName}", toolName);
                return new ToolExecutionResult(false, string.Empty, ex.InnerException?.Message ?? ex.Message);
            }
        }
    }
}
