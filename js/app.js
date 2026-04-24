// ====== cấu hình ======
const WORKER_URL = "/ai/api/chat.php";

// 📱 MOBILE VIEWPORT HEIGHT FIX
function setAppHeight() {
    const doc = document.documentElement;
    const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    doc.style.setProperty('--app-height', `${height}px`);
}
window.addEventListener('resize', setAppHeight);
if (window.visualViewport) window.visualViewport.addEventListener('resize', setAppHeight);
setAppHeight();

const MODEL = "gemini-2.5-flash";
const TEMPERATURE = 0.5;
const MAX_OUTPUT_TOKENS = 20000;
const REQUEST_TIMEOUT_MS = 600000;

// ====== elements ======
let autoRenamed = false
let conversation_id = null;
let chatEl;
let statusEl;
let msgEl;
let sendBtn;
let attachments;
let lastAIAnswer = ""
let mode = "auto"
let lastExportContent = ""
let isSending = false

const systemInstruction = `
Bạn đang chạy trong một ứng dụng CÓ THỂ tạo và xuất file thật cho người dùng.

QUY TẮC XUẤT FILE:
- Nếu người dùng muốn xuất file, tải file, file Word, DOCX, PDF, TXT, văn bản để tải về, hoặc yêu cầu tương đương:
  1. Hãy tạo RA NỘI DUNG CUỐI CÙNG để đưa vào file
  2. KHÔNG viết lời mở đầu, không giải thích, không nói "Tôi sẽ xuất file", không nói "Đây là nội dung", không thêm nhận xét
  3. Chỉ trả đúng phần nội dung cần nằm trong file
  4. Ở DÒNG CUỐI CÙNG thêm đúng định dạng:
     [EXPORT] docx
     hoặc
     [EXPORT] pdf
     hoặc
     [EXPORT] txt

- Nếu yêu cầu là xuất file Word thì luôn dùng:
  [EXPORT] docx

- KHÔNG được trả lời rằng bạn không thể tạo file.
- KHÔNG được bảo người dùng copy thủ công sang Word.

- QUY TẮC PHƯƠNG TIỆN (QUAN TRỌNG):
  1. TẠO HÌNH ẢNH TĨNH: Nếu người dùng yêu cầu "vẽ ảnh", "tạo ảnh", "bức hình"... (không có chuyển động)
     Trả về: [GENIMAGE] <mô tả chi tiết bằng tiếng Anh>
  2. CHỈNH SỬA ẢNH: Nếu có ảnh đính kèm và yêu cầu thay đổi.
     Trả về: [EDITIMAGE] <mô tả tiếng Anh>
  3. TẠO VIDEO (CHUYỂN ĐỘNG): Nếu người dùng yêu cầu "tạo video", "làm clip", "vẽ video", "animate", "phim"...
     TUYỆT ĐỐI KHÔNG DÙNG [GENIMAGE]. 
     BẮT BUỘC TRẢ VỀ: [GENVIDEO] <mô tả chi tiết bằng tiếng Anh về chuyển động và bối cảnh>
     Ví dụ: [GENVIDEO] A cat flying through the clouds, fur moving in the wind, cinematic.

- NẾU YÊU CẦU LÀ VIDEO, KHÔNG ĐƯỢC TRẢ VỀ ẢNH TĨNH.

Khi viết công thức toán:
- dùng $ ... $
- tránh xuống dòng không cần thiết.

Nếu câu hỏi cần thông tin mới, thông tin thời gian thực, hoặc bạn không chắc chắn:
Hãy trả về theo format:
[SEARCH] <từ khóa tìm kiếm>

KHÔNG trả lời ngay.
`;
// ====== state ======
let chatHistoryBuffer = [];
let lastUserMessage = "";

function escapeHtml(str = "") {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
}

function detectThinking(userText) {

    const keywords = [
        "tại sao",
        "giải thích",
        "phân tích",
        "so sánh",
        "how",
        "why",
        "analyze",
        "explain"
    ]

    for (const k of keywords) {
        if (userText.toLowerCase().includes(k)) {
            return true
        }
    }

    return false
}

function userWantsExport(text = "") {
    const t = String(text || "").toLowerCase()

    return [
        "xuất file",
        "tải file",
        "file word",
        "docx",
        "pdf",
        "txt",
        "lưu file",
        "tạo file",
        "download file",
        "xuất word",
        "xuất docx"
    ].some(k => t.includes(k))
}

document.addEventListener("touchend", (e) => {
    if (window.innerWidth < 768 && msgEl) {

        // ✅ nếu đang select text → KHÔNG blur
        const selection = window.getSelection()?.toString();
        if (selection && selection.length > 0) return;

        // ✅ nếu click trong input → bỏ
        if (msgEl.contains(e.target)) return;

        // ✅ nếu click các vùng tương tác → bỏ
        if (e.target.closest("button")) return;
        if (e.target.closest(".copy-btn")) return;
        if (e.target.closest(".copy-btn-clean")) return;
        if (e.target.closest("pre")) return;
        if (e.target.closest("code")) return;

        // ✅ delay để không phá clipboard
        setTimeout(() => {
            msgEl.blur();
        }, 120);
    }
});
document.addEventListener("touchstart", (e) => {
    // nếu đang giữ để copy → đừng làm gì
    if (window.getSelection()?.toString().length > 0) {
        e.stopPropagation();
    }
}, true);


function addImages(files) {

    const imgInput = document.getElementById("fileImg")
    const dt = new DataTransfer()

    // giữ file cũ (chỉ add nếu files không phải từ chính input đó)
    if (files !== imgInput.files && files !== document.getElementById("fileCam")?.files) {
        Array.from(imgInput.files).forEach(f => dt.items.add(f))
    }

    Array.from(files).forEach(file => {

        if (!file.type.startsWith("image")) return

        dt.items.add(file)

        const reader = new FileReader()

        reader.onload = function (e) {

            const div = document.createElement("div")
            div.className = "atimg"

            div.innerHTML = `
        <img src="${e.target.result}">
        <button class="atremove">×</button>
      `

            div.querySelector(".atremove").onclick = () => {
                div.remove()
            }

            attachments.appendChild(div)
        }

        reader.readAsDataURL(file)

    })

    imgInput.files = dt.files
}


function addUserBubble(text, images = []) {
    const row = document.createElement("div")
    row.className = "msgrow me"

    const bubble = document.createElement("div")
    bubble.className = "bubble position-relative"

    let html = `<div class="usertxt">${escapeHtml(text).replace(/\n/g, "<br>")}</div>`

    if (images && images.length > 0) {
        html += `<div class="mt-2 d-flex flex-wrap gap-2">`

        images.forEach(img => {
            html += `
                <img src="${img}" 
                     style="max-width:150px;border-radius:10px;">
            `
        })

        html += `</div>`
    }

    html += `
        <div class="assistant-corner-actions">
            <button class="corner-action-btn copy-btn-msg" title="Copy tin nhắn">
                <i class="bi bi-clipboard"></i>
            </button>
        </div>
    `

    bubble.innerHTML = html

    const copyBtn = bubble.querySelector(".copy-btn-msg")
    if (copyBtn) {
        copyBtn.onclick = async () => {
            await navigator.clipboard.writeText(text || "")
            copyBtn.innerHTML = `<i class="bi bi-check2"></i>`
            setTimeout(() => {
                copyBtn.innerHTML = `<i class="bi bi-clipboard"></i>`
            }, 1200)
        }
    }

    row.appendChild(bubble)
    chatEl.appendChild(row)
}

function createMessageActions({ text, exportType = null, onExport = null }) {
    const actions = document.createElement("div")
    actions.className = "assistant-corner-actions"

    if (exportType) {
        const exportBtn = document.createElement("button")
        exportBtn.className = "corner-action-btn"
        exportBtn.title = `Tải ${exportType.toUpperCase()}`
        exportBtn.innerHTML = `<i class="bi bi-download"></i>`
        exportBtn.onclick = () => {
            if (typeof onExport === "function") return onExport()
            if (exportType === "docx") exportDOCX(text)
            else exportFile(text)
        }
        actions.appendChild(exportBtn)
    }

    const copyBtn = document.createElement("button")
    copyBtn.className = "corner-action-btn"
    copyBtn.title = "Copy tin nhắn"
    copyBtn.innerHTML = `<i class="bi bi-clipboard"></i>`
    copyBtn.onclick = async () => {
        await navigator.clipboard.writeText(text || "")
        copyBtn.innerHTML = `<i class="bi bi-check2"></i>`
        setTimeout(() => {
            copyBtn.innerHTML = `<i class="bi bi-clipboard"></i>`
        }, 2000)
    }
    actions.appendChild(copyBtn)

    return actions
}


function addBotBubble(text, exportType = null) {
    if (!chatEl) return

    const row = document.createElement("div")
    row.className = "msgrow bot"

    const bubble = document.createElement("div")
    bubble.className = "bubble position-relative"

    const content = document.createElement("div")
    content.className = "message-content"
    content.innerHTML = marked.parse(text)
    bubble.appendChild(content)

    bubble.appendChild(createMessageActions({ text, exportType }))

    row.appendChild(bubble)
    chatEl.appendChild(row)

    /* highlight code */
    bubble.querySelectorAll("pre code").forEach(el => {
        hljs.highlightElement(el)
    })

    /* copy từng block code */
    bubble.querySelectorAll("pre").forEach(block => {
        if (block.querySelector(".copy-code-btn")) return;

        const btn = document.createElement("button")
        btn.className = "copy-code-btn"
        btn.innerHTML = `<i class="bi bi-copy"></i> Copy code`

        btn.onclick = (e) => {
            e.stopPropagation();
            const code = block.querySelector("code")?.innerText || block.innerText

            if (navigator.clipboard) {
                navigator.clipboard.writeText(code)
            } else {
                const textarea = document.createElement("textarea")
                textarea.value = code
                document.body.appendChild(textarea)
                textarea.select()
                document.execCommand("copy")
                document.body.removeChild(textarea)
            }

            btn.innerHTML = `<i class="bi bi-check2"></i> Copied`
            setTimeout(() => {
                btn.innerHTML = `<i class="bi bi-copy"></i> Copy code`
            }, 2000)
        }
        block.appendChild(btn)
    })


    /* math */
    if (window.MathJax) {
        MathJax.typesetPromise([bubble])
    }

    /* scroll */
    setTimeout(() => {
        if (window.innerWidth > 768) {
            chatEl.scrollTop = chatEl.scrollHeight
        }
    }, 50)

}

// 📐 SMART MATH NORMALIZER
function normalizeMathText(text) {
    if (!text) return "";

    // 1. Remove forced line breaks between formula and its condition (với, khi, n != ...)
    // Detect patterns like: $$...$$ \n (với...)
    let cleaned = text.replace(/(\$\$[\s\S]*?\$\$)\s*\n\s*(\(với|\(khi|với|khi|dk:|đk:|n\s*[≠|!=])/gi, "$1 $2");

    // 2. Fix multiple single newlines that should be a single paragraph
    // But keep double newlines as paragraph breaks
    // (This makes it look more like ChatGPT)
    cleaned = cleaned.replace(/([^\n])\n([^\n\*\[\-\d])/g, "$1 $2");

    return cleaned;
}

function streamBot(text, exportType = null) {
    const normalizedText = normalizeMathText(text);

    const row = document.createElement("div")
    row.className = "msgrow bot"

    const bubble = document.createElement("div")
    bubble.className = "bubble position-relative"

    const content = document.createElement("div")
    content.className = "message-content"

    bubble.appendChild(content)
    bubble.appendChild(createMessageActions({ text, exportType }))

    row.appendChild(bubble)
    chatEl.appendChild(row)

    let i = 0
    const timer = setInterval(() => {
        // Use normalized text for rendering
        const currentText = normalizedText.substring(0, i);
        content.innerHTML = marked.parse(currentText)
            .replace(/language-j\b/g, "language-java")


        /* highlight realtime */
        content.querySelectorAll("pre code").forEach(el => {
            hljs.highlightElement(el)
        })

        chatEl.scrollTop = chatEl.scrollHeight

        i++

        if (i >= text.length) {

            clearInterval(timer)

            isSending = false // 🔥 ENABLE KHI STREAM XONG
            /* highlight lại */
            content.querySelectorAll("pre code").forEach(el => {
                hljs.highlightElement(el)
            })

            /* thêm nút copy cho code */
            content.querySelectorAll("pre").forEach(block => {
                if (block.querySelector(".copy-code-btn")) return

                const btn = document.createElement("button")
                btn.className = "copy-code-btn"
                btn.innerHTML = `<i class="bi bi-copy"></i> Copy code`

                btn.onclick = (e) => {
                    e.stopPropagation();
                    const code = block.querySelector("code")?.innerText || block.innerText
                    navigator.clipboard.writeText(code)

                    btn.innerHTML = `<i class="bi bi-check2"></i> Copied`
                    setTimeout(() => {
                        btn.innerHTML = `<i class="bi bi-copy"></i> Copy code`
                    }, 2000)
                }
                block.appendChild(btn)
            })


            /* math */
            if (window.MathJax) {
                MathJax.typesetPromise([bubble])
            }

        }

    }, 5)
}



// ====== Gemini ======
async function callGemini(userText, images, files) {

    let detectedIntent = "chat";

    const isThinking =
        mode === "thinking" ||
        (mode === "auto" && detectThinking(userText))

    const thinkingPrompt = isThinking
        ? "\nHãy suy nghĩ từng bước trước khi trả lời.\n"
        : ""
    const parts = [{ text: userText }];

    const isFromSearch = userText.includes("Dựa vào thông tin sau:");
    const isInternalPrompt = userText.startsWith("Câu hỏi:");

    const toolInstruction = isFromSearch
        ? "\nBạn đang có dữ liệu từ internet. Trả lời luôn, KHÔNG được search nữa.\n"
        : "";

    const payload = {
        contents: [
            {
                role: "user",
                parts: [
                    { text: systemInstruction + thinkingPrompt + toolInstruction + (userText.toLowerCase().match(/video|clip|phim|animate|chuyển động/) ? "\nLƯU Ý: Người dùng đang yêu cầu VIDEO. Bạn phải dùng tag [GENVIDEO]. TUYỆT ĐỐI KHÔNG dùng [GENIMAGE] lúc này.\n" : "") }
                ]
            },

            // KHÔNG gửi history từ client
            {
                role: "user",
                parts: [
                    { text: userText },

                    ...files.map(f => ({
                        text: "File " + f.name + ":\n" + f.content
                    })),

                    ...images.map(img => ({
                        inline_data: {
                            mime_type: img.startsWith("data:image/png") ? "image/png" : "image/jpeg",
                            data: img.split(",")[1]
                        }
                    }))
                ]
            }
        ],

        generationConfig: {
            temperature: isThinking ? 0.7 : 0.5,
            maxOutputTokens: isThinking ? 20000 : 4000
        }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res;

    try {

        res = await fetch(WORKER_URL, {
            method: "POST",
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: MODEL,
                payload: payload,
                user_id: localStorage.getItem("user_id"),
                conversation_id: conversation_id,
                intent: detectedIntent
            })

        });

    } catch (err) {

        if (err.name === "AbortError") {
            throw new Error("timeout");
        }

        throw err;

    }

    clearTimeout(timeout);

    const raw = await res.text();

    let data;

    try {
        data = JSON.parse(raw);
    } catch {
        throw new Error("server trả dữ liệu không phải JSON");
    }

    // 🔥 FIX ĐÚNG CHỖ (sau parse)
    if (data?.conversation_id && !conversation_id) {
        conversation_id = data.conversation_id
        window.history.pushState({ cid: conversation_id }, "", "/c/" + conversation_id);
        loadHistory()
    }



    if (!res.ok) {
        throw new Error(data?.error?.message || "http error");
    }

    const respParts = data?.candidates?.[0]?.content?.parts || [];
    const reply = respParts.map(p => p.text).join("\n");
    // 🔥 AUTO TITLE (CHỈ 1 LẦN)
    if (conversation_id && !autoRenamed) {

        autoRenamed = true
        fetch("/ai/api/rename_conversation.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id: conversation_id,
                isAuto: true
            })
        }).then(() => loadHistory())

    }

    if (!isInternalPrompt) {
        chatHistoryBuffer.push({ role: "user", parts });
        chatHistoryBuffer.push({ role: "model", parts: [{ text: reply }] });
    }

    if (chatHistoryBuffer.length > 20) {
        chatHistoryBuffer = chatHistoryBuffer.slice(-20);
    }


    return {
        text: reply,
        chat_id: data.chat_id
    };

}

// ====== SEND ======
async function send() {

    if (isSending) return
    isSending = true


    const userText = msgEl.value.trim()
    if (!userText.toLowerCase().includes("tìm trên mạng") && !userText.startsWith("/search")) {
        lastUserMessage = userText
    }

    const imgInput = document.getElementById("fileImg")
    const camInput = document.getElementById("fileCam")
    const docInput = document.getElementById("fileDoc")

    let images = []
    let files = []

    // ✅ FIXED: Only collect from imgInput because addImages consolidated everything there
    const allImages = Array.from(imgInput.files)

    if (allImages.length > 0) {
        for (const file of allImages) {


            const base64 = await new Promise(resolve => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result)
                reader.readAsDataURL(file)
            })

            images.push(base64)

        }

    }

    if (docInput.files.length > 0) {

        for (const file of docInput.files) {

            let text = ""

            if (file.name.endsWith(".docx")) {

                const arrayBuffer = await file.arrayBuffer()

                const result = await mammoth.extractRawText({
                    arrayBuffer: arrayBuffer
                })

                text = result.value

            } else {

                text = await file.text()

            }

            files.push({
                name: file.name,
                content: text
            })

        }

    }



    if (!userText && images.length === 0 && files.length === 0) {
        isSending = false
        return
    }
    // ===== TOOL DETECTION =====
    if (userText.startsWith("/search ") || userText.toLowerCase().includes("tìm trên mạng")) {

        let query = userText
        query = query.replace(/tìm trên mạng/gi, "")
        query = query.replace(/^\/search/gi, "")
        query = query.trim()

        if (!query) {
            addBotBubble("❌ bạn chưa nhập nội dung cần tìm")
            isSending = false   // 🔥 THÊM
            return
        }

        addUserBubble(userText)
        scrollToBottom()

        runSearch(query, userText)

        msgEl.value = ""

        isSending = false   // 🔥 QUAN TRỌNG
        return
    }

    // ===== EXPORT COMMAND =====

    // export txt (giữ nguyên)
    if (userText.trim() === "/export") {
        isSending = false
        return exportFile(lastAIAnswer)
    }


    // 🔥 export docx
    if (userText.toLowerCase().includes("xuất file docx")) {
        if (!lastExportContent) {
            addBotBubble("❌ chưa có nội dung để xuất")
            isSending = false
            return
        }
        isSending = false
        return exportDOCX(lastExportContent)
    }

    addUserBubble(userText, images)
    scrollToBottom()

    msgEl.value = ""
    msgEl.style.height = "auto"

    document.getElementById("attachments").innerHTML = ""
    imgInput.value = ""
    camInput.value = ""
    docInput.value = ""


    const typing = document.createElement("div")
    typing.className = "msgrow bot"
    typing.innerHTML = `<div class="bubble">đang trả lời…</div>`

    chatEl.appendChild(typing)

    try {

        let geminiRes = await callGemini(userText, images, files)
        let reply = geminiRes.text;
        let current_chat_id = geminiRes.chat_id;

        // 🔥 AI quyết định export
        let exportType = null
        let rawReply = reply   // 🔥 giữ bản gốc

        if (rawReply.includes("[EXPORT]")) {
            const parts = rawReply.split("[EXPORT]")
            reply = parts[0].trim()
            exportType = parts[1].trim().toLowerCase()

            if (isValidForExport(reply)) {
                lastExportContent = reply
                localStorage.setItem("lastExportContent", reply)
            }
        } else {
            lastAIAnswer = reply

            if (isValidForExport(reply)) {
                lastExportContent = reply
                localStorage.setItem("lastExportContent", reply)
            }
        }

        // 🔥 AUTO GENIMAGE (ROBUST JOIN)
        if (reply.includes("[GENIMAGE]")) {
            // Kiểm tra xem đây có phải là nhầm lẫn không (AI trả [GENIMAGE] cho yêu cầu video)
            const isActuallyVideo = userText.toLowerCase().match(/video|clip|phim|animate|chuyển động/);
            if (isActuallyVideo) {
                typing.remove();
                addBotBubble("⚠️ AI đã nhầm lẫn khi tạo ảnh cho một yêu cầu video. Đang bỏ qua tạo ảnh để tránh sai lệch.");
                isSending = false;
                return;
            }

            const tag = "[GENIMAGE]";
            const index = reply.indexOf(tag);

            let textBefore = reply.substring(0, index).trim();
            let remainder = reply.substring(index + tag.length).trim();

            let promptLines = remainder.split("\n");
            const imagePrompt = promptLines[0].trim();
            let textAfter = promptLines.slice(1).join("\n").trim();

            const fullText = (textBefore + "\n" + textAfter).trim();

            typing.remove();

            if (fullText) {
                streamBot(fullText, exportType);
            }

            const imgLoading = document.createElement("div");
            imgLoading.className = "msgrow bot";
            imgLoading.innerHTML = `<div class="bubble">🎨 Đang vẽ ảnh minh họa...</div>`;
            chatEl.appendChild(imgLoading);
            scrollToBottom();

            try {
                const textToStore = fullText || "Mô tả ảnh:";
                const imgRes = await fetch("/ai/api/generate_image.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        prompt: imagePrompt,
                        conversation_id,
                        user_id: Number(localStorage.getItem("user_id") || 0),
                        assistant_text: textToStore
                    })
                });

                const rawText = await imgRes.text();
                imgLoading.remove();

                let imgData = JSON.parse(rawText);

                if (imgRes.ok && imgData?.success) {
                    const cleanMimeType = String(imgData.mimeType || "image/png").trim();
                    const cleanBase64 = String(imgData.imageBase64 || "").replace(/\s+/g, "");
                    const imageSrc = `data:${cleanMimeType};base64,${cleanBase64}`;

                    const row = document.createElement("div");
                    row.className = "msgrow bot";
                    row.innerHTML = `
                        <div class="bubble image-bubble-premium">
                            <div class="image-wrapper-premium">
                                <img src="${imageSrc}" alt="Generated image" onclick="viewImage('${imageSrc}')">
                                <a href="${imageSrc}" download="btoan_ai_image.png" class="image-download-btn-premium" title="Tải ảnh">
                                    <i class="bi bi-download"></i>
                                </a>
                            </div>
                        </div>
                    `;
                    chatEl.appendChild(row);
                } else {
                    addBotBubble("❌ Lỗi vẽ ảnh: " + (imgData?.error || "Lỗi không xác định"));
                }
            } catch (e) {
                imgLoading.remove();
                addBotBubble("❌ Lỗi kết nối khi vẽ ảnh: " + e.message);
            }

            isSending = false;
            scrollToBottom();
            return;
        }

        // 🔥 AUTO EDITIMAGE
        if (reply.includes("[EDITIMAGE]")) {
            const tag = "[EDITIMAGE]";
            const index = reply.indexOf(tag);

            let textBefore = reply.substring(0, index).trim();
            let remainder = reply.substring(index + tag.length).trim();
            let promptLines = remainder.split("\n");
            const imagePrompt = promptLines[0].trim();
            let textAfter = promptLines.slice(1).join("\n").trim();

            const fullText = (textBefore + "\n" + textAfter).trim();

            typing.remove();

            if (fullText) {
                streamBot(fullText, exportType);
            }

            const baseImage = images.length > 0 ? images[0] : null;

            if (!baseImage) {
                addBotBubble("❌ Bạn cần gửi kèm ảnh để tôi có thể chỉnh sửa.");
                isSending = false;
                return;
            }

            const imgLoading = document.createElement("div");
            imgLoading.className = "msgrow bot";
            imgLoading.innerHTML = `<div class="bubble">✨ Đang chỉnh sửa ảnh theo yêu cầu...</div>`;
            chatEl.appendChild(imgLoading);
            scrollToBottom();

            try {
                const textToStore = fullText || "Ảnh đã chỉnh sửa:";
                const imgRes = await fetch("/ai/api/edit_image.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        prompt: imagePrompt,
                        image: baseImage,
                        conversation_id,
                        user_id: Number(localStorage.getItem("user_id") || 0),
                        assistant_text: textToStore
                    })
                });

                const rawText = await imgRes.text();
                imgLoading.remove();
                let imgData = JSON.parse(rawText);

                if (imgRes.ok && imgData?.success) {
                    const cleanMimeType = String(imgData.mimeType || "image/png").trim();
                    const cleanBase64 = String(imgData.imageBase64 || "").replace(/\s+/g, "");
                    const imageSrc = `data:${cleanMimeType};base64,${cleanBase64}`;

                    const row = document.createElement("div");
                    row.className = "msgrow bot";
                    row.innerHTML = `
                        <div class="bubble image-bubble-premium edit-result">
                            <div class="edit-label">✨ Kết quả chỉnh sửa</div>
                            <div class="image-wrapper-premium">
                                <img src="${imageSrc}" alt="Edited image" onclick="viewImage('${imageSrc}')">
                                <a href="${imageSrc}" download="btoan_edited_image.png" class="image-download-btn-premium" title="Tải ảnh">
                                    <i class="bi bi-download"></i>
                                </a>
                            </div>
                        </div>
                    `;
                    chatEl.appendChild(row);
                } else {
                    addBotBubble("❌ Lỗi chỉnh sửa ảnh: " + (imgData?.error || "Lỗi không xác định"));
                }
            } catch (e) {
                imgLoading.remove();
                addBotBubble("❌ Lỗi kết nối khi sửa ảnh: " + e.message);
            }

            isSending = false;
            scrollToBottom();
            return;
        }

        // 🔥 AUTO GENVIDEO
        if (reply.includes("[GENVIDEO]")) {
            const tag = "[GENVIDEO]";
            const index = reply.indexOf(tag);

            let textBefore = reply.substring(0, index).trim();
            let remainder = reply.substring(index + tag.length).trim();
            let promptLines = remainder.split("\n");
            const videoPrompt = promptLines[0].trim();
            let textAfter = promptLines.slice(1).join("\n").trim();

            const fullText = (textBefore + "\n" + textAfter).trim();

            typing.remove();

            if (fullText) {
                streamBot(fullText, exportType);
            }

            // LUÔN LUÔN CHỈ 1 VIDEO (8S) - Theo yêu cầu người dùng
            const segmentDuration = 8;
            
            // 🛡️ HÀM LÀM SẠCH VĂN BẢN (Né bộ lọc Google)
            const sanitizePrompt = (text) => {
                const map = {
                    "trói buộc": "gắn kết",
                    "quất": "dạy bảo",
                    "đau": "nghiêm khắc",
                    "mũi kiếm": "thử thách",
                    "sắt đá": "kiên cường",
                    "chết đi": "thay đổi",
                    "đánh": "dạy",
                    "kiếm": "thử thách",
                    "bạo lực": "mạnh mẽ"
                };
                let cleanText = text;
                Object.keys(map).forEach(key => {
                    const regex = new RegExp(key, "gi");
                    cleanText = cleanText.replace(regex, map[key]);
                });
                return cleanText;
            };

            const segmentPrompt = sanitizePrompt(videoPrompt);

            // Get reference image (first one)
            let refImage = images.length > 0 ? images[0] : null;

            // 🔥 TỰ ĐỘNG TÌM ẢNH CŨ (BỀN VỮNG: Gọi Backend)
            if (!refImage && conversation_id) {
                try {
                    const lastImgRes = await fetch(`/ai/api/get_last_image.php?conversation_id=${conversation_id}`);
                    const lastImgData = await lastImgRes.json();
                    if (lastImgData.success && lastImgData.image_url) {
                        refImage = lastImgData.image_url;
                    }
                } catch (e) {
                    console.log("History image fetch error:", e);
                }
            }

            // Fallback: Tìm trong DOM nếu backend fail
            if (!refImage) {
                const allUserImages = Array.from(document.querySelectorAll('.msgrow.me .usertxt img, .msgrow.me .img-preview img')).reverse();
                if (allUserImages.length > 0) {
                    refImage = allUserImages[0].src;
                }
            }

            // Create loading bubble
            const vidLoading = document.createElement("div");
            vidLoading.className = "msgrow bot";
            vidLoading.innerHTML = `
                <div class="bubble assistant video-processing-card">
                    <div class="processing-glow"></div>
                    <div class="d-flex align-items-center gap-3">
                        <div class="spinner-border text-primary spinner-border-sm" role="status"></div>
                        <div class="flex-grow-1">
                            <div class="fw-bold mb-1">Đang tạo video cho bạn...</div>
                            <div class="progress" style="height: 6px; background: #f1f5f9; border-radius: 10px;">
                                <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%"></div>
                            </div>
                            <div class="text-muted mt-1 progress-text" style="font-size: 11px;">Đang chuẩn bị nội dung...</div>
                        </div>
                    </div>
                </div>
            `;
            chatEl.appendChild(vidLoading);
            scrollToBottom();

            try {
                const vidRes = await fetch("/ai/api/generate_video.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        prompt: segmentPrompt,
                        conversation_id,
                        user_id: Number(localStorage.getItem("user_id") || 0),
                        chat_id: current_chat_id,
                        image: refImage,
                        duration: segmentDuration
                    })
                });

                const vidData = await vidRes.json();
                if (vidRes.ok && vidData?.success) {
                    pollVideoStatus(vidData.job_id, vidLoading, current_chat_id);
                } else {
                    vidLoading.innerHTML = `<div class="bubble assistant border-danger text-danger">❌ Lỗi: ${vidData?.error || "Lỗi không xác định"}</div>`;
                }
            } catch (e) {
                vidLoading.innerHTML = `<div class="bubble assistant border-danger text-danger">❌ Lỗi kết nối video</div>`;
            }

            isSending = false;
            scrollToBottom();
            return;
        }


        // 🔥 AUTO SEARCH
        if (reply.startsWith("[SEARCH]")) {
            const query = reply.replace("[SEARCH]", "").trim();

            typing.remove();

            addBotBubble("🔎 Đang tìm: " + query);

            await runSearch(query, userText);

            isSending = false;
            return;
        }

        if (!reply.startsWith("[SEARCH]") && !reply.startsWith("[EXPORT]")) {
            if (isValidForExport(reply)) {
                lastExportContent = reply;
                localStorage.setItem("lastExportContent", reply);
            }
        }



        typing.remove();
        streamBot(reply, exportType);

        setTimeout(() => {
            if (window.MathJax) {
                MathJax.typeset();
            }
        }, 100);

    } catch (e) {
        typing.remove();
        addBotBubble("lỗi: " + e.message);
        isSending = false;
    }
}

// ====== LOGIN ======
async function login() {



    const username = document.getElementById("login_username").value;
    const password = document.getElementById("login_password").value;

    const res = await fetch("/ai/api/login.php", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username,
            password
        })
    });

    const raw = await res.text();
    console.log("RAW LOGIN:", raw);

    let data;
    try {
        data = JSON.parse(raw);
    } catch (e) {
        console.error("JSON lỗi:", raw);
        return;
    }

    console.log("PARSED:", data);

    // 🔥 FORCE SAVE luôn (bỏ if)
    if (data.user_id) {

        console.log("SAVE user_id =", data.user_id);

        localStorage.setItem("user_id", String(data.user_id));
        localStorage.setItem("username", data.username)


        console.log("AFTER SAVE:", localStorage.getItem("user_id"));

        document.getElementById("loginBox").remove();

        await checkProfile(data.user_id)  // 🔥 QUAN TRỌNG

        loadHistory()
        newChat()

    } else {
        document.getElementById("loginMsg").innerText = "Sai tài khoản hoặc mật khẩu";
    }

}
// ====== REGISTER ======
async function register() {

    const msgBox = document.getElementById("registerMsg")
    msgBox.innerHTML = ""

    const username = document.getElementById("reg_username").value
    const password = document.getElementById("reg_password").value
    const password2 = document.getElementById("reg_password2").value

    if (password !== password2) {

        msgBox.innerHTML = `<div class="text-danger">
    Mật khẩu nhập lại không khớp
    </div>`

        return
    }

    const res = await fetch("/ai/api/register.php", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username,
            password
        })
    })

    const data = await res.json()

    if (data.status === "ok") {

        msgBox.innerHTML = `<div class="text-success">
    Đăng ký thành công ✔
    </div>`

        setTimeout(() => {
            showLogin()
        }, 1500)

    } else {

        msgBox.innerHTML = `<div class="text-danger">
    ${data.msg}
    </div>`

    }
    document.getElementById("reg_username").value = ""
    document.getElementById("reg_password").value = ""
    document.getElementById("reg_password2").value = ""

}

// ====== LOGOUT ======
function logout() {

    localStorage.clear();
    location.reload();

}

// ====== HISTORY ======
async function loadHistory() {
    const user_id = localStorage.getItem("user_id");
    const res = await fetch("/ai/api/get_conversations.php?user_id=" + user_id);
    const data = await res.json();

    const list = document.getElementById("historyList");
    if (!list) return;

    list.innerHTML = "";
    if (data.length === 0) return;

    data.forEach((c) => {
        const div = document.createElement("div")
        // Apply active class if this is the current conversation
        const isActive = conversation_id == c.id;
        div.className = `chat-history-item d-flex justify-content-between align-items-center ${isActive ? 'active' : ''}`;
        div.setAttribute('data-id', c.id);

        div.innerHTML = `
    <div class="chat-title">${c.title}</div>
    <div class="dropdown" onclick="event.stopPropagation()">
        <button class="history-action-btn" data-bs-toggle="dropdown" aria-expanded="false">
            <i class="bi bi-three-dots"></i>
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
            <li>
                <button class="dropdown-item" onclick="renameChat(${c.id}, '${c.title.replace(/'/g, "\\'")}')">
                    <i class="bi bi-pencil"></i> Đổi tên
                </button>
            </li>
            <li>
                <hr class="dropdown-divider opacity-50">
            </li>
            <li>
                <button class="dropdown-item text-danger" onclick="deleteChat(${c.id})">
                    <i class="bi bi-trash3"></i> Xoá
                </button>
            </li>
        </ul>
    </div>
    `;

        div.onclick = () => loadConversation(c.id);
        list.appendChild(div);
    });
}

function updateSidebarActive(id) {
    document.querySelectorAll('.chat-history-item').forEach(item => {
        if (item.getAttribute('data-id') == id) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}


//rename

async function renameChat(id, oldTitle) {

    const title = prompt("Nhập tên mới", oldTitle)

    if (!title) return

    await fetch("/ai/api/rename_conversation.php", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            id: id,
            title: title
        })
    })

    loadHistory()

}

//delete chat
async function deleteChat(id) {

    if (!confirm("Xoá cuộc trò chuyện này?")) return

    const res = await fetch("/ai/api/delete_conversation.php", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            id: id
        })
    })

    const text = await res.text()

    let data
    try {
        data = JSON.parse(text)
    } catch {
        console.log("SERVER ERROR:", text)
        addBotBubble("❌ server lỗi")
        return
    }
    console.log(data)
    loadHistory()

    chatEl.innerHTML = ""

}

async function loadConversation(id, updateUrl = true) {
    if (conversation_id === id && chatEl.innerHTML !== "" && !updateUrl) return;

    conversation_id = id;
    if (updateUrl) {
        window.history.pushState({ cid: id }, "", `/c/${id}`);
    }



    // Immediate UI Feedback
    updateSidebarActive(id);
    chatEl.innerHTML = `
        <div class="d-flex flex-column align-items-center justify-content-center h-100 text-muted opacity-50">
            <div class="spinner-border spinner-border-sm mb-2" role="status"></div>
            <div style="font-size: 13px;">Đang tải cuộc trò chuyện...</div>
        </div>
    `;
    attachments.innerHTML = "";
    chatHistoryBuffer = [];
    lastExportContent = "";

    try {
        const res = await fetch("/ai/api/get_messages.php?conversation_id=" + id);
        const data = await res.json();

        chatEl.innerHTML = ""; // Clear loader


        data.forEach(m => {
            if (m.role === "user") {
                addUserBubble(m.text, m.images || [])
                chatHistoryBuffer.push({
                    role: "user",
                    parts: [{ text: m.text }]
                })
            } else {
                if (m.text.startsWith("[EXPORT_FILE]||")) {
                    const base64Data = m.text.split("||")[1]
                    const content = atob(base64Data)
                    const clean = fixLatex(cleanExportContent(content))
                    const base64Encoded = btoa(unescape(encodeURIComponent(clean)))
                    const url = "data:text/plain;base64," + base64Encoded
                    addBotBubble(`
    📄 File đã xuất trước đó:

    👉 <a href="${url}" target="_blank">Mở lại</a>
    `)
                } else {
                    let text = m.text
                    let exportType = null
                    if (text.includes("[EXPORT]")) {
                        const parts = text.split("[EXPORT]")
                        text = parts[0].trim()
                        exportType = parts[1].trim().toLowerCase()
                    }
                    if (
                        isValidForExport(text) &&
                        !text.includes("📄 File đã xuất trước đó") &&
                        !text.includes("📄 File DOCX đã sẵn sàng") &&
                        !text.includes("📄 File đã sẵn sàng")
                    ) {
                        lastExportContent = text
                        localStorage.setItem("lastExportContent", text)
                    }
                    addBotBubble(text, exportType)

                    // 🔥 RENDER SAVED VIDEO (SERIES)
                    if (Array.isArray(m.videos) && m.videos.length > 0) {
                        m.videos.forEach(vidUrl => {
                            const row = document.createElement("div");
                            row.className = "msgrow bot";
                            row.innerHTML = `
                                <div class="video-bubble-premium assistant">
                                    <div class="video-container-premium">
                                        <video controls class="video-player-premium">
                                            <source src="${vidUrl}" type="video/mp4">
                                            Your browser does not support the video tag.
                                        </video>
                                    </div>
                                    <div class="video-actions-premium">
                                        <span class="status-badge-premium">
                                            <i class='bx bx-magic-wand'></i> AI Video Cinematic
                                        </span>
                                        <a href="${vidUrl}" target="_blank" download="btoan_ai_video_${Date.now()}.mp4" class="download-btn-premium">
                                            <i class='bx bx-download'></i> Tải Video
                                        </a>
                                    </div>
                                </div>
                            `;
                            chatEl.appendChild(row);
                        });
                    } else if (m.video) {
                        const row = document.createElement("div");
                        row.className = "msgrow bot";
                        row.innerHTML = `
                            <div class="video-bubble-premium assistant">
                                <div class="video-container-premium">
                                    <video controls class="video-player-premium">
                                        <source src="${m.video}" type="video/mp4">
                                        Your browser does not support the video tag.
                                    </video>
                                </div>
                                <div class="video-actions-premium">
                                    <span class="status-badge-premium">
                                        <i class='bx bx-magic-wand'></i> Btoan AI Video
                                    </span>
                                    <a href="${m.video}" target="_blank" download="btoan_ai_video_${Date.now()}.mp4" class="download-btn-premium">
                                        <i class='bx bx-download'></i> Tải Video
                                    </a>
                                </div>
                            </div>
                        `;
                        chatEl.appendChild(row);
                    }

                    if (Array.isArray(m.images) && m.images.length > 0) {
                        const row = document.createElement("div");
                        row.className = "msgrow bot";
                        const bubble = document.createElement("div");
                        bubble.className = "bubble image-bubble-premium";
                        const imageSrc = m.images[0];
                        bubble.innerHTML = `
                            <div class="image-wrapper-premium">
                                <img src="${imageSrc}" alt="Generated image" onclick="viewImage('${imageSrc}')">
                                <a href="${imageSrc}" download="btoan_ai_image.png" class="image-download-btn-premium" title="Tải ảnh về máy">
                                    <i class="bi bi-download"></i>
                                </a>
                            </div>
                            <div class="image-caption-premium">Đây là ảnh của bạn</div>
                        `;
                        row.appendChild(bubble);
                        chatEl.appendChild(row);
                    }

                }
                chatHistoryBuffer.push({
                    role: "model",
                    parts: [{ text: m.text }]
                })
            }
        })
        scrollToBottom()
    } catch (e) {
        console.error("LOAD CONV ERROR:", e)
        chatEl.innerHTML = '<div class="p-4 text-center text-danger">⚠️ Không thể tải cuộc trò chuyện.</div>'
    }
}

function getLastBotMessageText() {
    const botMessages = [...document.querySelectorAll(".msgrow.bot .bubble")]
    if (!botMessages.length) return ""

    for (let i = botMessages.length - 1; i >= 0; i--) {
        const content = botMessages[i].querySelector(".message-content")
        if (!content) continue

        const text = (content.innerText || "").trim()

        if (!text) continue
        if (text.includes("đang trả lời")) continue
        if (text.includes("❌")) continue
        if (text.includes("📄 File DOCX đã sẵn sàng")) continue
        if (text.includes("📄 File đã sẵn sàng")) continue

        return text
    }

    return ""
}

// ====== PAGE LOAD ======
document.addEventListener("paste", async (e) => {

    const items = e.clipboardData.items

    for (const item of items) {
        if (item.type.indexOf("image") !== -1) {

            e.preventDefault()

            const file = item.getAsFile()

            // ✅ dùng hàm chung
            addImages([file])

            return
        }
    }

})




window.onload = function () {

    chatEl = document.getElementById("chat") || null;
    msgEl = document.getElementById("msg") || null;

    chatEl = document.getElementById("chat");
    statusEl = document.getElementById("status");
    msgEl = document.getElementById("msg");


    lastExportContent = localStorage.getItem("lastExportContent") || ""

    // 🔥 đặt SAU khi có msgEl
    if (msgEl) {

        msgEl.addEventListener("focus", () => {

            // ❌ CHẶN MOBILE
            if (window.innerWidth <= 768) return

            setTimeout(() => {
                msgEl.scrollIntoView({ block: "center" });
            }, 300)

        })




        // auto resize
        msgEl.addEventListener("input", () => {
            msgEl.style.height = "auto";
            msgEl.style.height = msgEl.scrollHeight + "px";
        })

    }
    sendBtn = document.getElementById("send");

    // Routing Logic
    // Routing Logic
    const urlParams = new URLSearchParams(window.location.search);
    const cidFromQuery = urlParams.get('c');
    const pathMatch = window.location.pathname.match(/\/c\/([0-9]+)/);
    const cidToLoad = (pathMatch ? pathMatch[1] : null) || cidFromQuery;

    if (cidToLoad) {
        console.log("🚀 BtoanAI: Restoring conversation", cidToLoad);
        setTimeout(() => {
            loadConversation(cidToLoad, false);
        }, 200);
    } else if (window.location.pathname === "/" || window.location.pathname.endsWith("index.php") || window.location.pathname === "") {
        console.log("🚀 BtoanAI: Starting new chat");
        newChat(false);
    }



    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.cid) {
            loadConversation(e.state.cid, false);
        } else {
            newChat(false);
        }
    });

    chatEl.addEventListener("dragover", (e) => {
        e.preventDefault()
    })

    chatEl.addEventListener("drop", (e) => {

        e.preventDefault()

        // ✅ chỉ 1 dòng
        addImages(e.dataTransfer.files)

    })

    attachments = document.getElementById("attachments");
    // camera preview
    document.getElementById("fileCam")?.addEventListener("change", (e) => {
        addImages(e.target.files)
    })

    document.getElementById("send")?.addEventListener("click", send)

    msgEl?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            send()
        }
    })

    // 🖱️ SCROLL TO BOTTOM BUTTON LOGIC
    const scrollBtn = document.getElementById("scrollToBottomBtn");
    if (chatEl && scrollBtn) {
        chatEl.addEventListener("scroll", () => {
            // Hiển thị nút nếu cách đáy hơn 300px
            const threshold = 300;
            const isAtBottom = (chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight) < threshold;

            if (isAtBottom) {
                if (scrollBtn.classList.contains("show")) {
                    scrollBtn.classList.remove("show");
                    setTimeout(() => {
                        if (!scrollBtn.classList.contains("show")) scrollBtn.style.display = "none";
                    }, 400);
                }
            } else {
                if (!scrollBtn.classList.contains("show")) {
                    scrollBtn.style.display = "flex";
                    // Small delay to trigger CSS transition
                    setTimeout(() => scrollBtn.classList.add("show"), 10);
                }
            }
        });

        scrollBtn.addEventListener("click", () => {
            chatEl.scrollTo({
                top: chatEl.scrollHeight,
                behavior: "smooth"
            });
        });
    }

    // 🌗 THEME INITIALIZATION
    const savedTheme = localStorage.getItem("theme") || "light";
    if (savedTheme === "dark") {
        document.body.classList.add("dark-mode");
        const themeBtn = document.getElementById("themeToggleBtn");
        if (themeBtn) themeBtn.innerHTML = '<i class="bi bi-sun"></i>';
    }

    // ===== auto format dd/mm/yyyy =====
    const dobInput = document.getElementById("pf_dob")

    if (dobInput) {
        dobInput.addEventListener("input", (e) => {
            let v = e.target.value.replace(/\D/g, "")

            if (v.length >= 2) v = v.slice(0, 2) + "/" + v.slice(2)
            if (v.length >= 5) v = v.slice(0, 5) + "/" + v.slice(5, 9)

            e.target.value = v
        })
    }
    const avatarInput = document.getElementById("avatarInput")

    if (avatarInput) {

        avatarInput.addEventListener("change", async function () {

            const file = this.files[0]
            if (!file) return

            console.log("🔥 FILE SELECTED:", file)

            const formData = new FormData()
            formData.append("avatar", file)
            formData.append("user_id", localStorage.getItem("user_id"))

            try {

                const res = await fetch("/ai/api/upload_avatar.php", {
                    method: "POST",
                    body: formData
                })

                const text = await res.text()
                console.log("🔥 RAW RESPONSE:", text)

                let data
                try {
                    data = JSON.parse(text)
                } catch {
                    alert("API lỗi không phải JSON")
                    return
                }

                console.log("🔥 PARSED:", data)

                if (!data.success) {
                    alert("Upload thất bại")
                    return
                }

                const url = data.avatar + "?t=" + Date.now()

                document.getElementById("avatarPreview").innerHTML =
                    `<img src="${url}" style="width:100%;height:100%;border-radius:50%">`

                document.getElementById("userAvatar").innerHTML =
                    `<img src="${url}" style="width:100%;height:100%;border-radius:50%">`

            } catch (e) {
                console.error("UPLOAD ERROR:", e)
                alert("Server lỗi")
            }

        })

    }

}
function toggleSidebar() {
    const sb = document.getElementById("sidebar")
    if (!sb) return
    sb.classList.toggle("open")
}


function setMode(m) {
    mode = m;
    const btn = document.getElementById("modeStatus");
    if (!btn) return;

    if (m === "thinking") {
        btn.innerText = "🧠 Thinking";
        btn.className = "badge bg-warning text-dark ms-1";
    } else {
        btn.innerText = "⚡ Fast";
        btn.className = "badge bg-light text-dark ms-1";
    }
}


document.getElementById("pickImage")?.addEventListener("click", () => {
    document.getElementById("fileImg").click()
})

document.getElementById("pickCamera")?.addEventListener("click", async () => {

    // nếu đang chạy trong Flutter
    if (window.flutter_inappwebview) {

        const base64 = await window.flutter_inappwebview.callHandler('openCamera')

        if (base64) {

            const res = await fetch(base64)
            const blob = await res.blob()

            const file = new File([blob], "camera.jpg", { type: "image/jpeg" })

            addImages([file])
        }


    } else {
        // fallback cho trình duyệt
        document.getElementById("fileCam").click()
    }

})

document.getElementById("pickFile")?.addEventListener("click", () => {
    document.getElementById("fileDoc").click()
})


document.getElementById("fileImg")?.addEventListener("change", (e) => {
    addImages(e.target.files)
})

document.getElementById("fileDoc")?.addEventListener("change", (e) => {

    Array.from(e.target.files).forEach(file => {

        const div = document.createElement("div")
        div.className = "atchip"

        div.innerHTML = `
    📄 ${file.name}
    <button class="atremove">×</button>
    `

        div.querySelector(".atremove").onclick = () => {
            div.remove()
        }

        attachments.appendChild(div)

    })

})
function newChat(updateUrl = true) {
    autoRenamed = false
    lastAIAnswer = ""

    conversation_id = null
    if (updateUrl) {
        window.history.pushState(null, "", "/");
    }
    updateSidebarActive(null) // Clear active sidebar state

    chatHistoryBuffer = []

    lastExportContent = ""
    const chatEl = document.getElementById("chat")

    if (chatEl) {
        chatEl.innerHTML = ""
    }
}

document.addEventListener("click", function (e) {

    const sidebar = document.getElementById("sidebar")
    const menuBtn = document.querySelector(".menu-btn")

    // đóng sidebar
    if (sidebar && sidebar.classList.contains("open")) {
        if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
            sidebar.classList.remove("open")
        }
    }



})


function scrollToBottom() {
    if (!chatEl) return

    // ❌ chặn mobile
    if (window.innerWidth < 768) return

    chatEl.scrollTop = chatEl.scrollHeight
}
window.visualViewport?.addEventListener("resize", () => {

    // 🔥 CHẶN nếu đang focus input
    if (document.activeElement !== msgEl) {
        setTimeout(() => {
            scrollToBottom()
        }, 200)
    }

})
function showRegister() {

    document.getElementById("loginForm").style.display = "none"
    document.getElementById("registerForm").style.display = "block"

}

function showLogin() {

    document.getElementById("loginForm").style.display = "block"
    document.getElementById("registerForm").style.display = "none"

}

function togglePassword(id, el) {

    const input = document.getElementById(id);

    if (input.type === "password") {
        input.type = "text";
        el.classList.remove("bi-eye");
        el.classList.add("bi-eye-slash");
    } else {
        input.type = "password";
        el.classList.remove("bi-eye-slash");
        el.classList.add("bi-eye");
    }

}
document.addEventListener("visibilitychange", () => {

    if (!document.hidden) {
        scrollToBottom()
    }

})
async function runSearch(query, originalText) {

    const loading = document.createElement("div")
    loading.className = "msgrow bot"
    loading.innerHTML = `<div class="bubble">🔎 đang tìm kiếm...</div>`
    chatEl.appendChild(loading)

    try {

        const res = await fetch("/ai/api/search.php?q=" + encodeURIComponent(query))
        const data = await res.json()

        let text = ""

        data.results.forEach(r => {
            text += `- ${r.title}\n${r.snippet}\n\n`
        })

        // 🔥 xoá loading
        loading.remove()

        const reply = await callGemini(
            `Câu hỏi: ${originalText}

    Dựa vào thông tin sau:
    ${text}

    Hãy trả lời.`,
            [], []
        )
        lastAIAnswer = reply
        streamBot(reply, null)

    } catch (e) {

        loading.remove()
        addBotBubble("❌ lỗi search")

    }
}
async function exportFile(content) {

    if (!content.trim()) {
        addBotBubble("❌ chưa có nội dung")
        return
    }

    localStorage.setItem("lastExportContent", content)

    // 🔥 gọi API upload
    const res = await fetch("/ai/api/upload.php", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: content,
            ext: "txt"
        })
    })

    const text = await res.text()

    let data
    try {
        data = JSON.parse(text)
    } catch {
        console.log("SERVER ERROR:", text)
        addBotBubble("❌ server lỗi")
        return
    }

    if (!data.url) {
        addBotBubble("❌ upload lỗi")
        return
    }

    // 🔥 render link chuẩn
    addBotBubble(`
    📄 File đã sẵn sàng:

    👉 <a href="${data.url}" target="_blank">
    Mở bằng trình duyệt
    </a>
    `)
}
async function exportDOCX(content) {

    if (!content.trim()) {
        addBotBubble("❌ chưa có nội dung")
        return
    }

    localStorage.setItem("lastExportContent", content)

    const res = await fetch("/ai/api/upload.php", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: content,
            ext: "docx"
        })
    })

    const text = await res.text()

    let data
    try {
        data = JSON.parse(text)
    } catch {
        console.log("SERVER ERROR:", text)
        addBotBubble("❌ server lỗi")
        return
    }

    if (!data.url) {
        addBotBubble("❌ upload lỗi")
        return
    }

    const row = document.createElement("div")
    row.className = "msgrow bot"

    const bubble = document.createElement("div")
    bubble.className = "bubble"

    bubble.innerHTML = `
        <div class="message-content">
            <div>📄 File DOCX đã sẵn sàng:</div>
            <div class="mt-2">
                <a href="${data.url}" target="_blank">👉 Tải file Word</a>
            </div>
        </div>
    `

    row.appendChild(bubble)
    chatEl.appendChild(row)
    scrollToBottom()
}

async function exportPDF(content) {

    if (!content.trim()) {
        addBotBubble("❌ chưa có nội dung")
        return
    }

    localStorage.setItem("lastExportContent", content)

    const res = await fetch("/ai/api/upload.php", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: content,
            ext: "pdf"
        })
    })

    const text = await res.text()

    let data
    try {
        data = JSON.parse(text)
    } catch {
        console.log("SERVER ERROR:", text)
        addBotBubble("❌ server lỗi")
        return
    }

    if (!data.url) {
        addBotBubble("❌ upload lỗi")
        return
    }

    const row = document.createElement("div")
    row.className = "msgrow bot"

    const bubble = document.createElement("div")
    bubble.className = "bubble"

    bubble.innerHTML = `
        <div class="message-content">
            <div>📄 File PDF đã sẵn sàng:</div>
            <div class="mt-2">
                <a href="${data.url}" target="_blank">👉 Tải file PDF</a>
            </div>
        </div>
    `

    row.appendChild(bubble)
    chatEl.appendChild(row)
    scrollToBottom()

}


function extractExportContent(text) {
    let clean = String(text || "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim()

    const lines = clean.split("\n").map(x => x.trim())

    const filtered = lines.filter(line => {
        if (!line) return true

        const lower = line.toLowerCase()

        if (lower.startsWith("tuyệt vời")) return false
        if (lower.startsWith("đây là nội dung")) return false
        if (lower.startsWith("dưới đây là")) return false
        if (lower.startsWith("tôi sẽ xuất")) return false
        if (lower.startsWith("tôi hiểu rằng")) return false
        if (lower.startsWith("chào bạn")) return false
        if (lower.includes("thành file word cho bạn")) return false
        if (lower.includes("nội dung đầy đủ mà bạn yêu cầu")) return false

        return true
    })

    return filtered.join("\n").trim()
}

async function searchHistory(q) {

    const res = await fetch("/ai/api/search_history.php?q=" + encodeURIComponent(q) + "&user_id=" + localStorage.getItem("user_id"))

    const data = await res.json()

    const list = document.getElementById("historyList")
    list.innerHTML = ""

    data.forEach(c => {
        const div = document.createElement("div")
        div.innerText = c.title
        div.onclick = () => loadConversation(c.id)
        list.appendChild(div)
    })
}
// Pull-to-refresh logic removed to prevent unintended reloads on mobile
function fixLatex(text) {

    return text
        .replace(/\$(.*?)\$/g, "$1") // bỏ dấu $
        .replace(/\\times/g, "×")
        .replace(/\\cdot/g, "·")
        .replace(/\\frac{(.*?)}{(.*?)}/g, "($1/$2)")
        .replace(/\\text{(.*?)}/g, "$1")
        .replace(/\\sqrt{(.*?)}/g, "√($1)")
        .replace(/\\left|\\right/g, "")
        .replace(/\\,/g, "")
        .replace(/\\\\/g, "\n")

}
function isValidForExport(text) {

    if (text.length < 50) return false

    if (/ủa|ok|ừ|ờ|hello|hi/i.test(text)) return false

    if (text.includes("?")) return false

    return true
}
function cleanExportContent(text) {
    return String(text || "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/👉|📄|🔎/g, "")
        .trim()
}
async function checkProfile(user_id) {

    const res = await fetch("/ai/api/check_profile.php?user_id=" + user_id)
    const data = await res.json()

    const fullName = data.full_name?.trim()

    const name =
        fullName ||
        localStorage.getItem("full_name") ||
        localStorage.getItem("username") ||
        "User"

    // ✅ set tên
    const nameEls = [
        document.getElementById("userName"), 
        document.getElementById("sidebarUserName")
    ]
    nameEls.forEach(el => { if (el) el.innerText = name })

    // ✅ avatar
    const avatarEls = [
        document.getElementById("userAvatar"), 
        document.getElementById("sidebarUserAvatar")
    ]
    
    avatarEls.forEach(avatarEl => {
        if (!avatarEl) return
        avatarEl.innerHTML = ""
        avatarEl.style.background = "none"

        if (data.avatar) {
            const url = data.avatar + "?t=" + Date.now()
            avatarEl.innerHTML = `<img src="${url}" style="width:100%;height:100%;border-radius:50%">`
        } else {
            avatarEl.innerText = name.charAt(0).toUpperCase()
            const colors = [
                "linear-gradient(135deg,#10a37f,#1a7f64)", // ChatGPT green
                "linear-gradient(135deg,#6366f1,#4f46e5)",
                "linear-gradient(135deg,#f59e0b,#d97706)"
            ]
            avatarEl.style.background = colors[name.length % colors.length]
        }
    })
    
    // Sync theme icon on load
    const savedTheme = localStorage.getItem("theme") || "light";
    const themeIcon = document.getElementById("themeIcon");
    if (themeIcon) {
        themeIcon.className = savedTheme === "dark" ? "bi bi-sun" : "bi bi-moon-stars";
    }

    // 🎨 màu avatar
    const colors = [
        "linear-gradient(135deg,#6366f1,#4f46e5)",
        "linear-gradient(135deg,#22c55e,#16a34a)",
        "linear-gradient(135deg,#f59e0b,#d97706)",
        "linear-gradient(135deg,#ef4444,#dc2626)"
    ]
    avatarEl.style.background = colors[name.length % colors.length]

    // 💾 lưu lại full_name để dùng sau
    if (fullName) {
        localStorage.setItem("full_name", fullName)
    }

    // =========================
    // 🔥 LOGIC MỚI (QUAN TRỌNG)
    // =========================

    // 👉 LUÔN show chat (không dùng profileBox nữa)
    document.getElementById("chatApp").style.display = "flex"

    // 👉 nếu CHƯA có profile → bật popup
    if (!data.has_profile) {

        document.getElementById("profileModal").style.display = "flex"

        localStorage.setItem("has_profile", "0")

    } else {

        // 👉 có profile → đóng popup
        document.getElementById("profileModal").style.display = "none"

        localStorage.setItem("has_profile", "1")
    }

}
async function saveProfile() {

    const user_id = localStorage.getItem("user_id")

    if (!user_id) {
        alert("Lỗi: chưa đăng nhập")
        return
    }

    const nameInput = document.getElementById("pf_name")
    const dobInput = document.getElementById("pf_dob")
    const msg = document.getElementById("profileMsg")

    if (!nameInput || !dobInput || !msg) return

    const full_name = nameInput.value.trim()
    let dob = dobInput.value.trim()

    console.log("📌 INPUT:", { full_name, dob })

    // ===== validate =====
    if (!full_name || !dob) {
        msg.innerText = "Vui lòng nhập đầy đủ"
        return
    }

    // ===== validate dd/mm/yyyy =====
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) {
        msg.innerText = "Ngày sinh phải dạng dd/mm/yyyy"
        return
    }

    const [day, month, year] = dob.split("/").map(Number)

    if (
        day < 1 || day > 31 ||
        month < 1 || month > 12 ||
        year < 1900 || year > 2100
    ) {
        msg.innerText = "Ngày không hợp lệ"
        return
    }

    // ===== convert sang yyyy-mm-dd =====
    dob = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`

    try {

        const res = await fetch("/ai/api/update_name.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id,
                full_name,
                dob
            })
        })

        const data = await res.json()
        console.log("🔥 RESPONSE:", data)

        if (!data.success) {
            msg.innerText = "Lưu thất bại"
            return
        }

        // ===== SAVE LOCAL =====
        localStorage.setItem("full_name", full_name)
        localStorage.setItem("has_profile", "1")

        // ===== UPDATE UI NGAY =====
        const names = [document.getElementById("userName"), document.getElementById("sidebarUserName")]
        const avatars = [document.getElementById("userAvatar"), document.getElementById("sidebarUserAvatar")]

        names.forEach(el => { if (el) el.innerText = full_name })
        avatars.forEach(el => { if (el) el.innerText = full_name.charAt(0).toUpperCase() })

        // ===== ĐÓNG MODAL =====
        const modal = document.getElementById("profileModal")
        if (modal) modal.style.display = "none"

        // ===== SYNC LẠI TOÀN BỘ =====
        checkProfile(user_id)

    } catch (err) {
        console.error("❌ saveProfile error:", err)
        msg.innerText = "Server lỗi"
    }
}
function isMobile() {
    return window.innerWidth <= 768;
}

// ❌ chặn mọi auto focus
document.addEventListener("focusin", (e) => {
    if (isMobile() && e.target === msgEl) {
        if (!e.isTrusted) {
            msgEl.blur();
        }
    }
});
function handleGoogleLogin(response) {
    const id_token = response.credential;

    fetch("ai/api/google-login.php", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ token: id_token })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {

                const user_id = data.user.id;

                // ✅ lưu đúng hệ thống bạn đang dùng
                localStorage.setItem("user_id", user_id);
                localStorage.setItem("username", data.user.username);
                // ✅ ẩn login
                document.getElementById("loginBox").style.display = "none";

                // ✅ auto fill tên (xịn hơn)
                document.getElementById("pf_name").value = data.user.name || "";

                // ✅ check profile NGAY (KHÔNG reload)
                checkProfile(user_id);

                // // 👉 nếu đã có profile → load app luôn
                // loadHistory();
                // newChat();

            } else {
                alert("Login Google thất bại");
            }
        });
}
document.addEventListener("DOMContentLoaded", () => {

    const uid = localStorage.getItem("user_id");

    if (uid && uid !== "undefined") {

        document.getElementById("loginBox").style.display = "none";
        document.getElementById("chatApp").style.display = "flex";

        checkProfile(uid)
        loadHistory()
        // newChat() // Moved to startup routing in window.onload


    } else {

        document.getElementById("loginBox").style.display = "flex";
        document.getElementById("chatApp").style.display = "none";

    }

})

function toggleUserMenu() {
    const menu = document.getElementById("userMenu")
    if (!menu) return
    const isVisible = menu.style.display === "block"
    menu.style.display = isVisible ? "none" : "block"
}

// click ngoài → đóng menu
document.addEventListener("click", function (e) {
    const btn = document.querySelector(".user-account-btn")
    const menu = document.getElementById("userMenu")
    
    if (menu && menu.style.display === "block") {
        if (btn && !btn.contains(e.target) && !menu.contains(e.target)) {
            menu.style.display = "none"
        }
    }
})

function openSettings() {
    toggleUserMenu();
    showToast("Cài đặt sẽ sớm ra mắt!");
}

function openHelp() {
    toggleUserMenu();
    window.open("https://github.com/btoan2802", "_blank");
}

function showToast(text) {
    const toast = document.getElementById("floating-ok");
    const label = document.getElementById("ok-text");
    if (!toast || !label) return;
    
    label.innerText = text;
    toast.style.display = "flex";
    toast.style.animation = "none";
    void toast.offsetWidth; // trigger reflow
    toast.style.animation = "menuAppear 0.3s ease-out";
    
    setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

function openProfile() {

    const modal = document.getElementById("profileModal")
    if (!modal) {
        console.error("❌ profileModal not found")
        return
    }

    const hasProfile = localStorage.getItem("has_profile") === "1"

    // ✅ mở modal
    modal.style.display = "flex"

    // ===== UI TEXT =====
    const title = modal.querySelector(".profile-title")
    const btn = modal.querySelector(".profile-save-btn") // 🔥 fix selector chuẩn

    if (hasProfile) {
        if (title) title.innerText = "Chỉnh sửa thông tin"
        if (btn) btn.innerText = "Lưu thay đổi"
    } else {
        if (title) title.innerText = "Hoàn thiện thông tin"
        if (btn) btn.innerText = "Xác nhận"
    }

    // ===== LOAD DATA =====
    loadProfileData()
}
async function loadProfileData() {

    const user_id = localStorage.getItem("user_id")
    if (!user_id) return

    try {

        const res = await fetch("/ai/api/check_profile.php?user_id=" + user_id)
        const data = await res.json()

        const nameInput = document.getElementById("pf_name")
        const dobInput = document.getElementById("pf_dob")
        const avatarPreview = document.getElementById("avatarPreview")

        // ===== NAME =====
        if (nameInput) {
            nameInput.value = data.full_name || ""
        }

        // ===== DOB =====
        if (dobInput && data.dob) {
            const parts = data.dob.split("-")
            if (parts.length === 3) {
                dobInput.value = `${parts[2]}/${parts[1]}/${parts[0]}`
            }
        }

        // ===== AVATAR =====
        if (avatarPreview) {

            const avatar = data.avatar // ✅ FIX

            if (avatar) {

                const url = avatar + "?t=" + Date.now()

                avatarPreview.innerHTML = `
                    <img src="${url}" 
                         style="width:100%;height:100%;border-radius:50%">
                `

                document.getElementById("userAvatar").innerHTML = `
                    <img src="${url}" 
                         style="width:100%;height:100%;border-radius:50%">
                `

            } else {

                const name = data.full_name || localStorage.getItem("username") || "U"
                avatarPreview.innerText = name.charAt(0).toUpperCase()

            }
        }

    } catch (err) {
        console.error("❌ loadProfileData error:", err)
    }
}



// 📸 Image Preview Logic (Lightbox)

async function pollVideoStatus(job_id, containerBubble, chat_id) {
    let attempts = 0;
    const maxAttempts = 120; // 120 x 5s = 600 seconds (10 mins)
    const interval = 5000;
    let simulatedProgress = 0;
    let isInitialized = false;

    const timer = setInterval(async () => {
        attempts++;

        // 🛡️ CHẶN QUÁ TẢI
        if (attempts > maxAttempts) {
            clearInterval(timer);
            containerBubble.innerHTML = `<div class="bubble assistant border-danger text-danger"><i class='bx bx-time-five'></i> Quá thời gian tạo video. Vui lòng kiểm tra lại sau.</div>`;
            return;
        }

        // 🧠 GIẢ LẬP TIẾN ĐỘ THỰC TẾ (Tăng tốc theo yêu cầu người dùng)
        if (simulatedProgress < 95) {
            // Tốc độ nhảy: 8% mỗi 5s ban đầu, sau đó chậm dần nhưng vẫn nhanh hơn cũ
            const increment = simulatedProgress < 40 ? 8 : (simulatedProgress < 80 ? 3 : 1);
            simulatedProgress = Math.min(95, simulatedProgress + increment);
        }

        try {
            const res = await fetch(`/ai/api/check_video_job.php?job_id=${job_id}&conversation_id=${conversation_id}&user_id=${localStorage.getItem("user_id")}&chat_id=${chat_id}`);
            const data = await res.json();

            // 1️⃣ KHỞI TẠO UI LẦN ĐẦU
            if (!isInitialized) {
                containerBubble.innerHTML = `
                    <div class="bubble assistant video-processing-card">
                        <div class="processing-glow"></div>
                        <div class="d-flex align-items-center gap-3">
                            <div class="spinner-border text-primary spinner-border-sm" role="status"></div>
                            <div class="flex-grow-1">
                                <div class="fw-bold mb-1">Đợi chút nha, tui đang tạo video...</div>
                                <div class="progress" style="height: 6px; background: #f1f5f9; border-radius: 10px;">
                                    <div class="progress-bar progress-bar-striped progress-bar-animated" 
                                         role="progressbar" style="width: 0%; transition: width 0.5s ease-in-out;"></div>
                                </div>
                                <div class="text-muted mt-1 progress-text" style="font-size: 11px;">Tiến độ: 0% - Vui lòng đợi trong giây lát</div>
                            </div>
                        </div>
                    </div>
                `;
                isInitialized = true;
                scrollToBottom();
            }

            // 2️⃣ XỬ LÝ KHI HOÀN THÀNH
            if (data.success && data.status === 'completed') {
                clearInterval(timer);
                const videoUrl = data.video_url;

                // 🔥 ÉP NHẢY LÊN 100% VÀ ĐỔI MÀU THÀNH CÔNG
                const bar = containerBubble.querySelector('.progress-bar');
                const text = containerBubble.querySelector('.progress-text');
                if (bar) {
                    bar.style.width = '100%';
                    bar.classList.remove('progress-bar-animated');
                    bar.style.backgroundColor = '#22c55e'; // Màu xanh lá (Success)
                }
                if (text) {
                    text.innerHTML = '<span style="color: #22c55e; font-weight: bold;"><i class="bx bx-check-double"></i> Đã hoàn thành 100%! Đang tải video...</span>';
                }

                setTimeout(() => {
                    containerBubble.innerHTML = `
                        <div class="video-bubble-premium assistant">
                            <div class="video-container-premium">
                                <video controls class="video-player-premium">
                                    <source src="${videoUrl}" type="video/mp4">
                                </video>
                            </div>
                            <div class="video-actions-premium">
                                <span class="status-badge-premium">
                                    <i class='bx bx-magic-wand'></i> Btoan AI Video
                                </span>
                                <a href="${videoUrl}" target="_blank" download="btoan_ai_video_${Date.now()}.mp4" class="download-btn-premium">
                                    <i class='bx bx-download'></i> Tải Video
                                </a>
                            </div>
                        </div>
                    `;
                    scrollToBottom();
                }, 1200); // Tăng thời gian chờ một chút để nhìn rõ 100%
                return;
            }

            // 3️⃣ CẬP NHẬT TIẾN ĐỘ ĐANG CHẠY (PROCESSING)
            if (data.status === 'processing' || data.success) {
                // Ưu tiên progress thật từ API nếu nó > 0
                const realProgress = parseFloat(data.progress || 0);
                const displayProgress = Math.max(simulatedProgress, realProgress);

                const bar = containerBubble.querySelector('.progress-bar');
                const text = containerBubble.querySelector('.progress-text');
                if (bar) bar.style.width = displayProgress + '%';
                if (text) text.innerText = `Tiến độ: ${Math.floor(displayProgress)}% - Vui lòng đợi trong giây lát`;
            }

            // 4️⃣ XỬ LÝ LỖI
            if (data.status === 'failed' || (data.success === false && data.status !== 'processing')) {
                clearInterval(timer);
                containerBubble.innerHTML = `<div class="bubble assistant border-danger text-danger"><i class='bx bx-error' ></i> Lỗi: ${data.error || "Không thể tạo video."}</div>`;
            }

        } catch (e) {
            console.error("Polling error:", e);
        }
    }, interval);
}

function viewImage(src) {
    const modal = document.getElementById("image-preview-modal");
    const img = document.getElementById("preview-img");
    if (!modal || !img) return;

    img.src = src;
    modal.style.display = "flex";
}

function closeImagePreview() {
    const modal = document.getElementById("image-preview-modal");
    if (modal) modal.style.display = "none";
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") closeImagePreview();
});

function toggleUserMenu() {
    const menu = document.getElementById("userMenu")
    if (!menu) return
    const isVisible = menu.style.display === "block"
    menu.style.display = isVisible ? "none" : "block"
}

// click ngoài → đóng menu
document.addEventListener("click", function (e) {
    const btn = document.querySelector(".user-account-btn")
    const menu = document.getElementById("userMenu")
    
    if (menu && menu.style.display === "block") {
        if (btn && !btn.contains(e.target) && !menu.contains(e.target)) {
            menu.style.display = "none"
        }
    }
})

function openSettings() {
    toggleUserMenu();
    showToast("Cài đặt sẽ sớm ra mắt!");
}

function openHelp() {
    toggleUserMenu();
    window.open("https://github.com/btoan2802", "_blank");
}

function showToast(text) {
    const toast = document.getElementById("floating-ok");
    const label = document.getElementById("ok-text");
    if (!toast || !label) return;
    
    label.innerText = text;
    toast.style.display = "flex";
    toast.style.animation = "none";
    void toast.offsetWidth; // trigger reflow
    toast.style.animation = "menuAppear 0.3s ease-out";
    
    setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

function toggleTheme() {
    const isDark = document.body.classList.toggle("dark-mode");
    const icon = document.getElementById("themeIcon");
    
    if (isDark) {
        localStorage.setItem("theme", "dark");
        if (icon) icon.className = "bi bi-sun";
    } else {
        localStorage.setItem("theme", "light");
        if (icon) icon.className = "bi bi-moon-stars";
    }
}
