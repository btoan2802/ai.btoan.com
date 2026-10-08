using System.Text;
using System.Text.RegularExpressions;

namespace BtoanAiNet.Services
{
    public class DiffService : IDiffService
    {
        public string GenerateUnifiedDiff(string oldContent, string newContent, string filePath)
        {
            var oldLines = (oldContent ?? string.Empty).Split('\n');
            var newLines = (newContent ?? string.Empty).Split('\n');

            var sb = new StringBuilder();
            sb.AppendLine($"--- a/{filePath}");
            sb.AppendLine($"+++ b/{filePath}");

            int maxLen = Math.Max(oldLines.Length, newLines.Length);
            int oldStart = 1, newStart = 1;
            int oldCount = 0, newCount = 0;

            var diffLines = new List<string>();

            for (int i = 0; i < maxLen; i++)
            {
                string oldLine = i < oldLines.Length ? oldLines[i].TrimEnd('\r') : null;
                string newLine = i < newLines.Length ? newLines[i].TrimEnd('\r') : null;

                if (oldLine == newLine)
                {
                    if (oldLine != null)
                    {
                        diffLines.Add($" {oldLine}");
                        oldCount++;
                        newCount++;
                    }
                }
                else
                {
                    if (oldLine != null)
                    {
                        diffLines.Add($"-{oldLine}");
                        oldCount++;
                    }
                    if (newLine != null)
                    {
                        diffLines.Add($"+{newLine}");
                        newCount++;
                    }
                }
            }

            sb.AppendLine($"@@ -{oldStart},{oldCount} +{newStart},{newCount} @@");
            foreach (var line in diffLines)
            {
                sb.AppendLine(line);
            }

            return sb.ToString();
        }

        public List<DiffHunkDto> ParseDiffHunks(string diffText)
        {
            var hunks = new List<DiffHunkDto>();
            if (string.IsNullOrWhiteSpace(diffText)) return hunks;

            var lines = diffText.Split('\n');
            DiffHunkDto currentHunk = null;
            int index = 0;

            foreach (var rawLine in lines)
            {
                string line = rawLine.TrimEnd('\r');
                if (line.StartsWith("@@"))
                {
                    currentHunk = new DiffHunkDto
                    {
                        Index = index++,
                        Header = line,
                        Lines = new List<string>()
                    };
                    hunks.Add(currentHunk);
                }
                else if (currentHunk != null)
                {
                    currentHunk.Lines.Add(line);
                }
            }

            return hunks;
        }

        public string ApplyPartialHunks(string oldContent, string diffText, List<int> acceptedHunkIndices)
        {
            var hunks = ParseDiffHunks(diffText);
            var resultLines = new List<string>();
            var oldLines = (oldContent ?? string.Empty).Split('\n').Select(l => l.TrimEnd('\r')).ToList();

            int acceptedSet = acceptedHunkIndices?.Count ?? 0;
            if (acceptedSet == 0) return oldContent;

            int oldIndex = 0;
            foreach (var hunk in hunks)
            {
                bool isAccepted = acceptedHunkIndices.Contains(hunk.Index);

                foreach (var line in hunk.Lines)
                {
                    if (line.StartsWith(" "))
                    {
                        resultLines.Add(line.Substring(1));
                        oldIndex++;
                    }
                    else if (line.StartsWith("-"))
                    {
                        if (isAccepted)
                        {
                            // Skip deleted line
                        }
                        else
                        {
                            resultLines.Add(line.Substring(1)); // Keep old line if rejected
                        }
                        oldIndex++;
                    }
                    else if (line.StartsWith("+"))
                    {
                        if (isAccepted)
                        {
                            resultLines.Add(line.Substring(1)); // Add new line
                        }
                    }
                }
            }

            return string.Join("\n", resultLines);
        }

        public SecurityReviewResult PerformSecurityInspection(string codeContent)
        {
            var result = new SecurityReviewResult();
            if (string.IsNullOrWhiteSpace(codeContent)) return result;

            // 1. SQL Injection Detection
            if (Regex.IsMatch(codeContent, @"SELECT\s+.*\s+FROM\s+.*\+\s*\w+", RegexOptions.IgnoreCase) ||
                Regex.IsMatch(codeContent, @"EXEC\s*\(\s*'.*\+\s*\w+", RegexOptions.IgnoreCase))
            {
                result.CriticalCount++;
                result.Findings.Add("[CRITICAL] SQL Injection Risk: Detected raw string concatenation in SQL query. Use parameterized queries.");
            }

            // 2. Hardcoded Credentials Detection
            if (Regex.IsMatch(codeContent, @"(password|secret|api_key|private_key)\s*=\s*""[A-Za-z0-9_\-]{6,}""", RegexOptions.IgnoreCase))
            {
                result.CriticalCount++;
                result.Findings.Add("[CRITICAL] Hardcoded Secret Risk: Found hardcoded password/secret key. Store credentials in appsettings.json or environment variables.");
            }

            // 3. Dangerous Process Injection Detection
            if (Regex.IsMatch(codeContent, @"Process\.Start\s*\(\s*""cmd\.exe""", RegexOptions.IgnoreCase) ||
                Regex.IsMatch(codeContent, @"Process\.Start\s*\(\s*""powershell""", RegexOptions.IgnoreCase))
            {
                result.CriticalCount++;
                result.Findings.Add("[CRITICAL] Command Execution Risk: Unsafe process creation detected.");
            }

            // 4. Warning: Empty Catch Block
            if (Regex.IsMatch(codeContent, @"catch\s*\([^\)]*\)\s*\{\s*\}"))
            {
                result.WarningCount++;
                result.Findings.Add("[WARNING] Clean Code Violation: Empty catch block suppresses exceptions silently.");
            }

            // 5. Suggestion: Async Without Await
            if (Regex.IsMatch(codeContent, @"public\s+async\s+Task") && !codeContent.Contains("await "))
            {
                result.SuggestionCount++;
                result.Findings.Add("[SUGGESTION] Performance Optimization: Async method lacks 'await' keyword.");
            }

            return result;
        }
    }
}
