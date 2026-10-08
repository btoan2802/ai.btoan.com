using System.Text.Json;
using BtoanAiNet.Repositories;
using BtoanAiNet.Services;
using BtoanAiNet.ViewModels;
using Microsoft.AspNetCore.Mvc;

namespace BtoanAiNet.Controllers
{
    public class AccountController : Controller
    {
        private readonly IAuthService _authService;
        private readonly IFaceAuthService _faceAuthService;
        private readonly IGoogleAuthService _googleAuthService;
        private readonly IUserRepository _userRepository;

        public AccountController(
            IAuthService authService,
            IFaceAuthService faceAuthService,
            IGoogleAuthService googleAuthService,
            IUserRepository userRepository)
        {
            _authService = authService;
            _faceAuthService = faceAuthService;
            _googleAuthService = googleAuthService;
            _userRepository = userRepository;
        }

        // POST /ai/api/login.php
        [HttpPost]
        [Route("ai/api/login.php")]
        [Route("Account/Login")]
        public async Task<IActionResult> Login([FromBody] LoginRequestModel model)
        {
            if (model == null)
            {
                return Json(new { error = "Invalid request" });
            }

            try
            {
                var (success, user, errorMessage) = await _authService.LoginAsync(model.Username ?? "", model.Password ?? "");
                if (!success || user == null)
                {
                    return Json(new { error = errorMessage });
                }

                HttpContext.Session.SetInt32("user_id", user.Id);
                HttpContext.Session.SetString("username", user.Username ?? "");

                return Json(new
                {
                    success = true,
                    user_id = user.Id,
                    username = user.Username
                });
            }
            catch (Exception ex)
            {
                return Json(new { error = $"Database error: {ex.Message}" });
            }
        }

        // POST /ai/api/register.php
        [HttpPost]
        [Route("ai/api/register.php")]
        [Route("Account/Register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequestModel model)
        {
            if (model == null)
            {
                return Json(new { status = "error", msg = "invalid request" });
            }

            try
            {
                var (success, status, message) = await _authService.RegisterAsync(model.Username ?? "", model.Password ?? "");
                if (!success)
                {
                    return Json(new { status = status, msg = message });
                }

                return Json(new { status = "ok" });
            }
            catch (Exception ex)
            {
                return Json(new { status = "error", msg = $"Database error: {ex.Message}" });
            }
        }

        // POST /ai/api/login_face.php
        [HttpPost]
        [Route("ai/api/login_face.php")]
        [Route("Account/LoginFace")]
        public async Task<IActionResult> LoginFace([FromForm] string username, [FromForm] string descriptor)
        {
            if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(descriptor))
            {
                return Json(new { success = false, message = "Thiếu dữ liệu xác thực (username hoặc descriptor)" });
            }

            try
            {
                var user = await _userRepository.GetByUsernameAsync(username.Trim());
                if (user == null)
                {
                    return Json(new { success = false, message = "Tài khoản không tồn tại" });
                }

                if (user.FaceEnabled != 1 || string.IsNullOrEmpty(user.FaceDescriptor))
                {
                    return Json(new { success = false, message = "Tài khoản chưa thiết lập FaceID" });
                }

                var (isMatch, distance, message) = _faceAuthService.VerifyFace(descriptor, user.FaceDescriptor);
                if (!isMatch)
                {
                    return Json(new { success = false, message, distance });
                }

                HttpContext.Session.SetInt32("user_id", user.Id);
                HttpContext.Session.SetString("username", user.Username ?? "");

                return Json(new
                {
                    success = true,
                    message = "Đăng nhập khuôn mặt thành công",
                    username = user.Username,
                    user_id = user.Id,
                    distance
                });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = $"Database error: {ex.Message}" });
            }
        }

        // POST /ai/api/google-login.php
        [HttpPost]
        [Route("ai/api/google-login.php")]
        [Route("Account/GoogleLogin")]
        public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequestModel model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.Token))
            {
                return Json(new { success = false });
            }

            try
            {
                var user = await _googleAuthService.AuthenticateGoogleTokenAsync(model.Token);
                if (user == null)
                {
                    return Json(new { success = false });
                }

                HttpContext.Session.SetInt32("user_id", user.Id);
                HttpContext.Session.SetString("username", user.Username ?? user.Email ?? "");

                return Json(new
                {
                    success = true,
                    user = new
                    {
                        id = user.Id,
                        username = user.Username ?? user.Email,
                        name = user.FullName,
                        email = user.Email
                    }
                });
            }
            catch
            {
                return Json(new { success = false });
            }
        }

        // GET /ai/api/check_profile.php
        [HttpGet]
        [Route("ai/api/check_profile.php")]
        [Route("Account/CheckProfile")]
        public async Task<IActionResult> CheckProfile([FromQuery] int user_id)
        {
            try
            {
                var (hasProfile, fullName, dob, avatar) = await _authService.CheckProfileAsync(user_id);
                return Json(new
                {
                    has_profile = hasProfile,
                    full_name = fullName,
                    dob = dob?.ToString("yyyy-MM-dd"),
                    avatar
                });
            }
            catch
            {
                return Json(new { has_profile = false });
            }
        }

        // POST /ai/api/update_name.php
        [HttpPost]
        [Route("ai/api/update_name.php")]
        [Route("Account/UpdateName")]
        public async Task<IActionResult> UpdateName([FromBody] UpdateNameRequestModel model)
        {
            if (model == null || !model.User_Id.HasValue)
            {
                return Json(new { success = false, message = "Thiếu dữ liệu" });
            }

            try
            {
                bool success = await _authService.UpdateNameAsync(model.User_Id.Value, model.Full_Name ?? "", model.Dob ?? "");
                return Json(new { success });
            }
            catch
            {
                return Json(new { success = false });
            }
        }

        // GET /ai/api/get_face_profile.php
        [HttpGet]
        [Route("ai/api/get_face_profile.php")]
        [Route("Account/GetFaceProfile")]
        public async Task<IActionResult> GetFaceProfile([FromQuery] string username)
        {
            if (string.IsNullOrWhiteSpace(username))
            {
                return Json(new { success = false, message = "Thiếu username" });
            }

            try
            {
                var user = await _userRepository.GetByUsernameAsync(username.Trim());
                if (user == null || user.FaceEnabled != 1 || string.IsNullOrEmpty(user.FaceDescriptor))
                {
                    return Json(new { success = false, message = "Chưa đăng ký FaceID" });
                }

                return Json(new
                {
                    success = true,
                    username = user.Username,
                    face_descriptor = user.FaceDescriptor,
                    face_image_url = user.FaceImageUrl
                });
            }
            catch
            {
                return Json(new { success = false, message = "Lỗi truy vấn dữ liệu" });
            }
        }
    }
}
