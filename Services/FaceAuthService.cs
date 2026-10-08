using System;
using System.Text.Json;

namespace BtoanAiNet.Services
{
    public interface IFaceAuthService
    {
        (bool IsMatch, double Distance, string Message) VerifyFace(string rawLiveDescriptor, string rawStoredDescriptor);
    }

    public class FaceAuthService : IFaceAuthService
    {
        private const double StrictThreshold = 0.45;

        public (bool IsMatch, double Distance, string Message) VerifyFace(string rawLiveDescriptor, string rawStoredDescriptor)
        {
            if (string.IsNullOrWhiteSpace(rawLiveDescriptor) || string.IsNullOrWhiteSpace(rawStoredDescriptor))
            {
                return (false, 1.0, "Dữ liệu sinh trắc học không hợp lệ");
            }

            try
            {
                var live = JsonSerializer.Deserialize<double[]>(rawLiveDescriptor);
                var stored = JsonSerializer.Deserialize<double[]>(rawStoredDescriptor);

                if (live == null || stored == null || live.Length == 0 || live.Length != stored.Length)
                {
                    return (false, 1.0, "Dữ liệu sinh trắc học không hợp lệ");
                }

                double sum = 0.0;
                for (int i = 0; i < live.Length; i++)
                {
                    sum += Math.Pow(live[i] - stored[i], 2);
                }

                double distance = Math.Sqrt(sum);

                if (distance > StrictThreshold)
                {
                    return (false, distance, "Xác minh khuôn mặt thất bại! Bạn không phải chủ sở hữu tài khoản này.");
                }

                return (true, distance, "Đăng nhập khuôn mặt thành công");
            }
            catch
            {
                return (false, 1.0, "Dữ liệu sinh trắc học không hợp lệ");
            }
        }
    }
}
