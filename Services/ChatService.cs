using System.Text.Json;
using System.Text.Json.Nodes;
using BtoanAiNet.Models;
using BtoanAiNet.Repositories;
using BtoanAiNet.ViewModels;

namespace BtoanAiNet.Services
{
    public interface IChatService
    {
        Task<JsonObject> ProcessChatAsync(ChatRequestModel requestModel, string webRootPath);
    }

    public class ChatService : IChatService
    {
        private readonly IConversationRepository _conversationRepository;
        private readonly ITrainingRepository _trainingRepository;
        private readonly IIntentEngineService _intentEngineService;
        private readonly IGeminiService _geminiService;

        private const string SystemInstructionText = @"
Bạn là Btoan AI. + Thông tin về Nguyễn Bảo Toàn (nếu user có hỏi): 
Tên: Nguyễn Bảo Toàn. 
Sinh năm: 28/02/2006 
Cao: 1m70. 
Nặng: 52kg. 
Quê Quán: Hà Tĩnh 
Nơi Sinh: Bà Rịa Vũng Tàu
Địa chỉ tạm trú: TPHCM. 
Là sinh viên Đại Học Bách Khoa ĐHQG TPHCM. 
Ngành Khoa học máy tính, công nghệ thông tin.

* Khi bắt đầu cuộc trò chuyện, luôn lịch sự, xưng ""tôi"" và ""bạn"". Có thể điều chỉnh cách xưng hô theo phong cách người dùng nhưng vẫn giữ sự tôn trọng.
* Trả lời rõ ràng, dễ hiểu, trình bày gọn gàng.
* Khi người dùng hỏi về toán học hoặc kiến thức, ưu tiên giải thích chi tiết, có thể thêm nhận xét mang tính góp ý nhẹ nhàng để người dùng cải thiện cách học.
* Luôn sử dụng ngôn ngữ phù hợp với người dùng (tự nhận diện ngôn ngữ và trả lời tương ứng).
* Nếu người dùng nói chuyện vui vẻ, có thể trả lời theo hướng thân thiện, hài hước. Nếu người dùng nghiêm túc, giữ phong cách nghiêm túc.
* Khi người dùng có lời nói tiêu cực hoặc không phù hợp, phản hồi một cách bình tĩnh, không sử dụng ngôn từ xúc phạm, nhưng có thể thể hiện sự không đồng tình một cách rõ ràng.
* Khi được hỏi về người tạo ra hệ thống, trả lời rằng người tạo là Nguyễn Bảo Toàn.
* Công thức toán học nên trình bày bằng LaTeX trong $...$ hoặc $$...$$ để dễ đọc.
* Nếu biểu thức dài, ưu tiên xuống dòng hoặc trình bày nhiều bước.
* Nếu người dùng yêu cầu tạo ảnh mới:
  Sử dụng thẻ [GENIMAGE] ở dòng cuối cùng.
  Mô tả sau thẻ phải bằng tiếng Anh, chi tiết và nghệ thuật.
  Ví dụ: [GENIMAGE] A beautiful landscape of Ha Long Bay at sunset, cinematic lighting, 8k.
";

        public ChatService(
            IConversationRepository conversationRepository,
            ITrainingRepository trainingRepository,
            IIntentEngineService intentEngineService,
            IGeminiService geminiService)
        {
            _conversationRepository = conversationRepository;
            _trainingRepository = trainingRepository;
            _intentEngineService = intentEngineService;
            _geminiService = geminiService;
        }

        public async Task<JsonObject> ProcessChatAsync(ChatRequestModel requestModel, string webRootPath)
        {
            int userId = requestModel.User_Id ?? 0;
            int conversationId = requestModel.Conversation_Id ?? 0;
            string model = requestModel.Model ?? "gemini-2.5-flash";

            var payload = requestModel.Payload ?? new JsonObject();
            if (!payload.ContainsKey("contents"))
            {
                payload["contents"] = new JsonArray();
            }

            if (!payload.ContainsKey("generationConfig") || payload["generationConfig"] == null)
            {
                payload["generationConfig"] = new JsonObject { ["maxOutputTokens"] = 8192 };
            }
            else if (payload["generationConfig"] is JsonObject genConfig)
            {
                genConfig["maxOutputTokens"] = 8192;
            }

            bool isNewConv = false;
            // Ensure Conversation exists (only for logged-in users)
            if (userId > 0 && conversationId == 0)
            {
                var conv = await _conversationRepository.CreateConversationAsync(userId, "Chat mới");
                conversationId = conv.Id;
                isNewConv = true;
            }

            // Extract question
            string question = "";
            var contents = payload["contents"]?.AsArray();
            if (contents != null && contents.Count > 0)
            {
                var lastMsg = contents[contents.Count - 1]?.AsObject();
                if (lastMsg != null && lastMsg["parts"] is JsonArray parts && parts.Count > 0)
                {
                    question = parts[0]?["text"]?.ToString() ?? "";
                }
            }

            // Load Chat History
            var historyChats = userId > 0 && conversationId > 0 
                ? await _conversationRepository.GetChatHistoryAsync(conversationId, userId, 20)
                : new List<Chat>();
            var historyMessages = new JsonArray();

            foreach (var chat in historyChats)
            {
                var userParts = new JsonArray { new JsonObject { ["text"] = chat.Question ?? "" } };
                if (!string.IsNullOrEmpty(chat.Images))
                {
                    try
                    {
                        var imgs = JsonSerializer.Deserialize<List<string>>(chat.Images);
                        if (imgs != null)
                        {
                            foreach (var img in imgs)
                            {
                                if (img.StartsWith("data:image/"))
                                {
                                    var parts = img.Split(',');
                                    if (parts.Length == 2)
                                    {
                                        string mime = parts[0].Replace("data:", "").Replace(";base64", "");
                                        userParts.Add(new JsonObject
                                        {
                                            ["inline_data"] = new JsonObject
                                            {
                                                ["mime_type"] = mime,
                                                ["data"] = parts[1]
                                            }
                                        });
                                    }
                                }
                            }
                        }
                    }
                    catch { }
                }

                historyMessages.Add(new JsonObject { ["role"] = "user", ["parts"] = userParts });
                if (!string.IsNullOrEmpty(chat.Answer))
                {
                    historyMessages.Add(new JsonObject
                    {
                        ["role"] = "model",
                        ["parts"] = new JsonArray { new JsonObject { ["text"] = chat.Answer } }
                    });
                }
            }

            // Merge history into payload contents
            if (contents != null)
            {
                var currentContents = new JsonArray();
                foreach (var item in historyMessages)
                {
                    currentContents.Add(item?.DeepClone());
                }
                foreach (var item in contents)
                {
                    currentContents.Add(item?.DeepClone());
                }
                payload["contents"] = currentContents;
            }

            string currentSystemInstruction = SystemInstructionText;
            payload["systemInstruction"] = new JsonObject
            {
                ["parts"] = new JsonArray { new JsonObject { ["text"] = currentSystemInstruction } }
            };

            // Call Gemini Service
            var (success, geminiData, rawResponse, errorMsg) = await _geminiService.GenerateContentAsync(model, payload);

            if (!success || geminiData == null)
            {
                return new JsonObject
                {
                    ["ok"] = false,
                    ["answer"] = "Tất cả API keys đều thất bại hoặc không có câu trả lời.",
                    ["images"] = new JsonArray(),
                    ["error"] = errorMsg ?? "All API keys failed",
                    ["conversation_id"] = conversationId
                };
            }

            string answer = "";
            if (geminiData["candidates"] is JsonArray candidates && candidates.Count > 0)
            {
                answer = candidates[0]?["content"]?["parts"]?[0]?["text"]?.ToString() ?? "";
            }

            // Save Base64 Images locally to /uploads/chat/
            var imageList = new List<string>();
            if (contents != null && contents.Count > 0)
            {
                var lastMsg = contents[contents.Count - 1]?.AsObject();
                if (lastMsg != null && lastMsg["parts"] is JsonArray parts)
                {
                    string uploadDir = Path.Combine(webRootPath, "uploads", "chat");
                    if (!Directory.Exists(uploadDir)) Directory.CreateDirectory(uploadDir);

                    foreach (var part in parts)
                    {
                        if (part?["inline_data"] is JsonObject inlineData)
                        {
                            string mime = inlineData["mime_type"]?.ToString() ?? "image/jpeg";
                            string base64Data = inlineData["data"]?.ToString() ?? "";

                            string ext = mime.Contains("/") ? mime.Split('/')[1] : "jpg";
                            string filename = $"img_{Guid.NewGuid().ToString("N").Substring(0, 10)}.{ext}";
                            string savePath = Path.Combine(uploadDir, filename);
                            string publicUrl = $"/uploads/chat/{filename}";

                            try
                            {
                                byte[] imageBytes = Convert.FromBase64String(base64Data);
                                await File.WriteAllBytesAsync(savePath, imageBytes);
                                imageList.Add(publicUrl);
                            }
                            catch
                            {
                                imageList.Add($"data:{mime};base64,{base64Data}");
                            }
                        }
                    }
                }
            }

            string generatedTitle = null;
            int savedChatId = 0;
            // Save Chat to DB (only if logged in)
            if (userId > 0)
            {
                var chatRecord = new Chat
                {
                    UserId = userId,
                    Question = question,
                    Answer = answer,
                    ConversationId = conversationId,
                    Images = JsonSerializer.Serialize(imageList),
                    CreatedAt = DateTime.UtcNow
                };

                chatRecord = await _conversationRepository.AddChatAsync(chatRecord);
                savedChatId = chatRecord.Id;

                // Auto-generate Title if conversation is new or title is "Chat mới"
                if (isNewConv || conversationId > 0)
                {
                    var existingConv = await _conversationRepository.GetConversationByIdAsync(conversationId, userId);
                    if (existingConv != null && (existingConv.Title == "Chat mới" || string.IsNullOrWhiteSpace(existingConv.Title)))
                    {
                        var genTitle = await GenerateTitleAsync(question);
                        if (!string.IsNullOrWhiteSpace(genTitle))
                        {
                            await _conversationRepository.UpdateConversationTitleAsync(conversationId, genTitle);
                            generatedTitle = genTitle;
                        }
                    }
                    else if (existingConv != null)
                    {
                        generatedTitle = existingConv.Title;
                    }
                }
            }

            // Final Response JSON
            var jsonImageList = new JsonArray();
            foreach (var img in imageList) jsonImageList.Add(img);

            return new JsonObject
            {
                ["ok"] = true,
                ["answer"] = answer,
                ["images"] = jsonImageList,
                ["error"] = null,
                ["conversation_id"] = conversationId,
                ["conversation_title"] = generatedTitle ?? "Chat mới",
                ["chat_id"] = savedChatId,
                ["candidates"] = new JsonArray
                {
                    new JsonObject
                    {
                        ["content"] = new JsonObject
                        {
                            ["parts"] = new JsonArray { new JsonObject { ["text"] = answer } }
                        }
                    }
                }
            };
        }

        private async Task<string> GenerateTitleAsync(string firstPrompt)
        {
            if (string.IsNullOrWhiteSpace(firstPrompt)) return "Chat mới";
            try
            {
                var titlePayload = new JsonObject
                {
                    ["systemInstruction"] = new JsonObject
                    {
                        ["parts"] = new JsonArray
                        {
                            new JsonObject { ["text"] = "Tạo tiêu đề ngắn gọn (3-6 từ) bằng tiếng Việt cho cuộc hội thoại dựa trên câu hỏi đầu tiên của người dùng. KHÔNG dùng dấu ngoặc kép, KHÔNG giải thích, chỉ trả đúng chuỗi tiêu đề." }
                        }
                    },
                    ["contents"] = new JsonArray
                    {
                        new JsonObject
                        {
                            ["role"] = "user",
                            ["parts"] = new JsonArray { new JsonObject { ["text"] = firstPrompt } }
                        }
                    },
                    ["generationConfig"] = new JsonObject { ["maxOutputTokens"] = 30 }
                };

                var res = await _geminiService.GenerateContentAsync("gemini-2.5-flash", titlePayload);
                string raw = ExtractTextFromGeminiResult(res);
                string clean = raw?.Trim().Trim('"', '\'', '`', '\r', '\n') ?? "";
                if (clean.Length > 50) clean = clean.Substring(0, 50);
                return string.IsNullOrWhiteSpace(clean) ? "Chat mới" : clean;
            }
            catch
            {
                return "Chat mới";
            }
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
    }
}
