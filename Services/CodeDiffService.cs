using System.Text;

namespace BtoanAiNet.Services
{
    public interface ICodeDiffService
    {
        string GenerateDiff(string originalText, string newText, string fileName);
    }

    public class CodeDiffService : ICodeDiffService
    {
        public string GenerateDiff(string originalText, string newText, string fileName)
        {
            var sb = new StringBuilder();
            sb.AppendLine($"--- a/{fileName}");
            sb.AppendLine($"+++ b/{fileName}");

            var origLines = (originalText ?? string.Empty).Split('\n');
            var newLines = (newText ?? string.Empty).Split('\n');

            int max = Math.Max(origLines.Length, newLines.Length);
            for (int i = 0; i < max; i++)
            {
                string? origLine = i < origLines.Length ? origLines[i].TrimEnd('\r') : null;
                string? newLine = i < newLines.Length ? newLines[i].TrimEnd('\r') : null;

                if (origLine == newLine)
                {
                    if (origLine != null) sb.AppendLine($"  {origLine}");
                }
                else
                {
                    if (origLine != null) sb.AppendLine($"- {origLine}");
                    if (newLine != null) sb.AppendLine($"+ {newLine}");
                }
            }

            return sb.ToString();
        }
    }
}
