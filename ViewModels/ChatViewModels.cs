using System.Text.Json.Nodes;

namespace BtoanAiNet.ViewModels
{
    public class ChatRequestModel
    {
        public string? Model { get; set; } = "gemini-2.5-flash";
        public JsonObject? Payload { get; set; }
        public int? User_Id { get; set; }
        public int? Conversation_Id { get; set; }
        public string? Intent { get; set; }
    }

    public class RenameConversationRequestModel
    {
        public int Id { get; set; }
        public string? Title { get; set; }
        public bool? IsAuto { get; set; }
    }

    public class DeleteConversationRequestModel
    {
        public int Id { get; set; }
    }

    public class SaveMemoryRequestModel
    {
        public int User_Id { get; set; }
        public string? Memory { get; set; }
    }

    public class SaveTrainingRequestModel
    {
        public string? Question { get; set; }
        public string? Ai_Answer { get; set; }
        public string? Correct_Answer { get; set; }
        public int User_Id { get; set; }
    }
}
