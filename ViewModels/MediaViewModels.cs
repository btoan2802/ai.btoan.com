namespace BtoanAiNet.ViewModels
{
    public class ImageGenerationRequestModel
    {
        public string? Prompt { get; set; }
        public int Conversation_Id { get; set; }
        public int User_Id { get; set; }
        public string? Assistant_Text { get; set; } = "Đây là ảnh của bạn:";
        public string? Aspect_Ratio { get; set; } = "1:1";
    }

    public class EditImageRequestModel
    {
        public string? Prompt { get; set; }
        public string? Image { get; set; } // Base64 or local URL
        public int Conversation_Id { get; set; }
        public int User_Id { get; set; }
        public string? Assistant_Text { get; set; } = "Đây là ảnh đã chỉnh sửa của bạn:";
    }

    public class VideoGenerationRequestModel
    {
        public string? Prompt { get; set; }
        public string? Conversation_Id { get; set; } = "default";
        public string? User_Id { get; set; } = "unknown";
        public int Chat_Id { get; set; }
        public string? Image { get; set; }
        public int Duration { get; set; } = 8;
    }

    public class MusicGenerationRequestModel
    {
        public int User_Id { get; set; }
        public int Conversation_Id { get; set; }
        public int Chat_Id { get; set; }
        public string? Prompt { get; set; }
        public int Duration { get; set; } = 30;
    }

    public class FileUploadRequestModel
    {
        public string? Content { get; set; }
        public string? Ext { get; set; } = "txt";
    }
}
