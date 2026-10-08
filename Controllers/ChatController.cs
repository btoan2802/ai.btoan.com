using BtoanAiNet.Repositories;
using BtoanAiNet.Services;
using BtoanAiNet.ViewModels;
using Microsoft.AspNetCore.Mvc;

namespace BtoanAiNet.Controllers
{
    public class ChatController : Controller
    {
        private readonly IChatService _chatService;
        private readonly IConversationRepository _conversationRepository;
        private readonly IMemoryService _memoryService;
        private readonly ITrainingService _trainingService;
        private readonly IWebHostEnvironment _env;

        public ChatController(
            IChatService chatService,
            IConversationRepository conversationRepository,
            IMemoryService memoryService,
            ITrainingService trainingService,
            IWebHostEnvironment env)
        {
            _chatService = chatService;
            _conversationRepository = conversationRepository;
            _memoryService = memoryService;
            _trainingService = trainingService;
            _env = env;
        }

        // POST /ai/api/chat.php
        [HttpPost]
        [Route("ai/api/chat.php")]
        [Route("Chat/Send")]
        public async Task<IActionResult> Chat([FromBody] ChatRequestModel model)
        {
            if (model == null)
            {
                return Json(new { ok = false, error = "Invalid request payload" });
            }

            try
            {
                string webRootPath = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                var result = await _chatService.ProcessChatAsync(model, webRootPath);
                return Content(result.ToJsonString(), "application/json");
            }
            catch (Exception ex)
            {
                return Json(new { ok = false, error = ex.Message });
            }
        }

        // GET /ai/api/get_conversations.php
        [HttpGet]
        [Route("ai/api/get_conversations.php")]
        [Route("Chat/GetConversations")]
        public async Task<IActionResult> GetConversations([FromQuery] int user_id)
        {
            try
            {
                var conversations = await _conversationRepository.GetConversationsByUserIdAsync(user_id);
                var result = conversations.Select(c => new
                {
                    id = c.Id,
                    title = c.Title
                });

                return Json(result);
            }
            catch
            {
                return Json(new List<object>());
            }
        }

        // GET /ai/api/get_messages.php
        [HttpGet]
        [Route("ai/api/get_messages.php")]
        [Route("Chat/GetMessages")]
        public async Task<IActionResult> GetMessages([FromQuery] int conversation_id)
        {
            if (conversation_id == 0)
            {
                return Json(new List<object>());
            }

            try
            {
                var chats = await _conversationRepository.GetMessagesByConversationIdAsync(conversation_id);
                var data = new List<object>();

                foreach (var chat in chats)
                {
                    if (!string.IsNullOrEmpty(chat.Question))
                    {
                        List<string> images = new List<string>();
                        if (!string.IsNullOrEmpty(chat.Images))
                        {
                            try
                            {
                                var decoded = System.Text.Json.JsonSerializer.Deserialize<List<string>>(chat.Images);
                                if (decoded != null) images = decoded;
                            }
                            catch { }
                        }

                        data.Add(new
                        {
                            role = "user",
                            text = chat.Question,
                            images = images
                        });
                    }

                    if (!string.IsNullOrEmpty(chat.Answer))
                    {
                        data.Add(new
                        {
                            role = "assistant",
                            text = chat.Answer,
                            images = new List<string>(),
                            videos = (object?)null,
                            music_url = (string?)null,
                            music_prompt = (string?)null,
                            music_duration = (int?)null
                        });
                    }
                }

                return Json(data);
            }
            catch
            {
                return Json(new List<object>());
            }
        }

        // POST /ai/api/rename_conversation.php
        [HttpPost]
        [Route("ai/api/rename_conversation.php")]
        [Route("Chat/RenameConversation")]
        public async Task<IActionResult> RenameConversation([FromBody] RenameConversationRequestModel model)
        {
            if (model == null || model.Id == 0)
            {
                return Json(new { status = "error", message = "missing id" });
            }

            try
            {
                string title = model.Title?.Trim() ?? "Chat mới";
                await _conversationRepository.UpdateConversationTitleAsync(model.Id, title);

                return Json(new { status = "ok", title = title });
            }
            catch
            {
                return Json(new { status = "error", message = "db error" });
            }
        }

        // POST /ai/api/delete_conversation.php
        [HttpPost]
        [Route("ai/api/delete_conversation.php")]
        [Route("Chat/DeleteConversation")]
        public async Task<IActionResult> DeleteConversation([FromBody] DeleteConversationRequestModel model)
        {
            if (model == null || model.Id == 0)
            {
                return Json(new { error = "no data" });
            }

            try
            {
                await _conversationRepository.DeleteConversationAsync(model.Id);
                return Json(new { status = "deleted" });
            }
            catch
            {
                return Json(new { error = "db error" });
            }
        }

        // GET /ai/api/get_memory.php
        [HttpGet]
        [Route("ai/api/get_memory.php")]
        [Route("Chat/GetMemory")]
        public async Task<IActionResult> GetMemory([FromQuery] int user_id)
        {
            try
            {
                var memories = await _memoryService.GetMemoryByUserIdAsync(user_id);
                var result = memories.Select(m => new
                {
                    id = m.Id,
                    user_id = m.UserId,
                    memory_value = m.MemoryValue
                });

                return Json(result);
            }
            catch
            {
                return Json(new List<object>());
            }
        }

        // POST /ai/api/save_memory.php
        [HttpPost]
        [Route("ai/api/save_memory.php")]
        [Route("Chat/SaveMemory")]
        public async Task<IActionResult> SaveMemory([FromBody] SaveMemoryRequestModel model)
        {
            if (model == null || model.User_Id == 0 || string.IsNullOrWhiteSpace(model.Memory))
            {
                return Json(new { status = "error", message = "missing data" });
            }

            try
            {
                await _memoryService.SaveMemoryAsync(model.User_Id, model.Memory.Trim());
                return Json(new { status = "ok" });
            }
            catch
            {
                return Json(new { status = "error", message = "db error" });
            }
        }

        // GET /ai/api/get_training.php
        [HttpGet]
        [Route("ai/api/get_training.php")]
        [Route("Chat/GetTraining")]
        public async Task<IActionResult> GetTraining([FromQuery] string q)
        {
            try
            {
                var trainings = await _trainingService.SearchTrainingAsync(q ?? "");
                var result = trainings.Select(t => new
                {
                    id = t.Id,
                    question = t.Question,
                    correct_answer = t.CorrectAnswer
                });

                return Json(result);
            }
            catch
            {
                return Json(new List<object>());
            }
        }

        // POST /ai/api/save_training.php
        [HttpPost]
        [Route("ai/api/save_training.php")]
        [Route("Chat/SaveTraining")]
        public async Task<IActionResult> SaveTraining([FromBody] SaveTrainingRequestModel model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Question))
            {
                return Json(new { status = "error", message = "missing data" });
            }

            try
            {
                await _trainingService.SaveTrainingAsync(model.Question, model.Ai_Answer ?? "", model.Correct_Answer ?? "", model.User_Id);
                return Json(new { status = "ok" });
            }
            catch
            {
                return Json(new { status = "error", message = "db error" });
            }
        }
    }
}
