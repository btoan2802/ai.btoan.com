namespace BtoanAiNet.FunctionCalling.Attributes
{
    [AttributeUsage(AttributeTargets.Method, Inherited = false)]
    public class AiToolAttribute : Attribute
    {
        public string Name { get; }
        public string Description { get; }

        public AiToolAttribute(string name, string description)
        {
            Name = name;
            Description = description;
        }
    }

    [AttributeUsage(AttributeTargets.Parameter, Inherited = false)]
    public class AiToolParamAttribute : Attribute
    {
        public string Description { get; }
        public bool IsRequired { get; set; } = true;

        public AiToolParamAttribute(string description)
        {
            Description = description;
        }
    }
}

