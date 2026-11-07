using System.Reflection;
using System.Text.Json.Nodes;
using BtoanAiNet.FunctionCalling.Attributes;

namespace BtoanAiNet.FunctionCalling.Services
{
    public record RegisteredTool(
        string Name, 
        string Description, 
        MethodInfo Method, 
        Type ServiceType, 
        JsonObject JsonSchema);

    public interface IToolRegistry
    {
        void RegisterServiceTools<TService>();
        RegisteredTool? GetTool(string toolName);
        JsonArray GetOpenAiToolsDefinition();
    }

    public class ToolRegistry : IToolRegistry
    {
        private readonly Dictionary<string, RegisteredTool> _tools = new(StringComparer.OrdinalIgnoreCase);

        public void RegisterServiceTools<TService>()
        {
            var serviceType = typeof(TService);
            var methods = serviceType.GetMethods(BindingFlags.Public | BindingFlags.Instance);

            foreach (var method in methods)
            {
                var toolAttr = method.GetCustomAttribute<AiToolAttribute>();
                if (toolAttr == null) continue;

                var schema = BuildJsonSchema(toolAttr.Name, toolAttr.Description, method);
                _tools[toolAttr.Name] = new RegisteredTool(toolAttr.Name, toolAttr.Description, method, serviceType, schema);
            }
        }

        public RegisteredTool? GetTool(string toolName) => 
            _tools.TryGetValue(toolName, out var tool) ? tool : null;

        public JsonArray GetOpenAiToolsDefinition()
        {
            var toolsArray = new JsonArray();
            foreach (var tool in _tools.Values)
            {
                toolsArray.Add(tool.JsonSchema);
            }
            return toolsArray;
        }

        private static JsonObject BuildJsonSchema(string name, string description, MethodInfo method)
        {
            var properties = new JsonObject();
            var requiredParams = new JsonArray();

            foreach (var param in method.GetParameters())
            {
                if (param.Name == null) continue;

                var paramAttr = param.GetCustomAttribute<AiToolParamAttribute>();
                string paramDesc = paramAttr?.Description ?? $"Parameter {param.Name}";
                bool isReq = paramAttr?.IsRequired ?? !param.IsOptional;

                properties[param.Name] = new JsonObject
                {
                    ["type"] = MapClrTypeToJsonType(param.ParameterType),
                    ["description"] = paramDesc
                };

                if (isReq) requiredParams.Add(param.Name);
            }

            return new JsonObject
            {
                ["type"] = "function",
                ["function"] = new JsonObject
                {
                    ["name"] = name,
                    ["description"] = description,
                    ["parameters"] = new JsonObject
                    {
                        ["type"] = "object",
                        ["properties"] = properties,
                        ["required"] = requiredParams
                    }
                }
            };
        }

        private static string MapClrTypeToJsonType(Type type)
        {
            if (type == typeof(string)) return "string";
            if (type == typeof(int) || type == typeof(long)) return "integer";
            if (type == typeof(double) || type == typeof(float)) return "number";
            if (type == typeof(bool)) return "boolean";
            if (type.IsArray || (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(List<>))) return "array";
            return "object";
        }
    }
}
