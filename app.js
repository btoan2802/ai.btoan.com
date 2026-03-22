// ====== cấu hình ======
const WORKER_URL = "/ai/api/chat.php";
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

const systemInstruction = `
Nếu người dùng yêu cầu xuất file:

1. Trước tiên hãy tạo nội dung đầy đủ theo yêu cầu
2. Sau đó ở dòng CUỐI CÙNG, thêm:
[EXPORT] <loại file>

KHÔNG được bỏ qua nội dung.

Nếu đã có thông tin về người dùng, hãy sử dụng nó khi trả lời.

Nếu có nhiều thông tin về cùng một dữ kiện,
hãy luôn dùng thông tin mới nhất và bỏ qua thông tin cũ.

Khi viết công thức toán:
- dùng $ ... $
- tránh xuống dòng không cần thiết.

Nếu câu hỏi cần thông tin mới, thông tin thời gian thực, hoặc bạn không chắc chắn:

Hãy trả về theo format:
[SEARCH] <từ khóa tìm kiếm>

KHÔNG trả lời ngay.

Ví dụ:
User: Ronaldo bao nhiêu tuổi
Bạn: [SEARCH] Cristiano Ronaldo age

Sau khi có dữ liệu, bạn sẽ trả lời bình thường.

`;

// ====== state ======
let history = [];
let lastUserMessage = "";
function detectThinking(userText){

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

for(const k of keywords){
if(userText.toLowerCase().includes(k)){
return true
}
}

return false
}

document.addEventListener("touchend", (e)=>{
    if(window.innerWidth < 768 && msgEl){

        // ✅ nếu đang select text → KHÔNG blur
        const selection = window.getSelection()?.toString();
        if(selection && selection.length > 0) return;

        // ✅ nếu click trong input → bỏ
        if(msgEl.contains(e.target)) return;

        // ✅ nếu click các vùng tương tác → bỏ
        if(e.target.closest("button")) return;
        if(e.target.closest(".copy-btn")) return;
        if(e.target.closest(".copy-btn-clean")) return;
        if(e.target.closest("pre")) return;
        if(e.target.closest("code")) return;

        // ✅ delay để không phá clipboard
        setTimeout(()=>{
            msgEl.blur();
        }, 120);
    }
});
document.addEventListener("touchstart", (e)=>{
    // nếu đang giữ để copy → đừng làm gì
    if(window.getSelection()?.toString().length > 0){
        e.stopPropagation();
    }
}, true);






// ====== UI ======
function addUserBubble(text, images=[]){

const row = document.createElement("div")
row.className = "msgrow me"

const bubble = document.createElement("div")
bubble.className = "bubble position-relative"

bubble.innerHTML = `
<div class="usertxt">${text}</div>

<button class="btn btn-sm btn-light copy-btn-msg">
  <i class="bi bi-clipboard"></i>
</button>
`

// copy
bubble.querySelector(".copy-btn-msg").onclick = ()=>{
  navigator.clipboard.writeText(text)
}

row.appendChild(bubble)
chatEl.appendChild(row)
}

function addBotBubble(text, exportType=null){
	if(!chatEl) return

const row = document.createElement("div")
row.className = "msgrow bot"

const bubble = document.createElement("div")
bubble.className = "bubble position-relative"

/* markdown render */
let html = marked.parse(text)

// 🔥 nếu có export → thêm nút cuối
if(exportType){

    html += `
    <div class="mt-2 d-flex gap-2">
        <button class="btn btn-sm btn-success export-btn">
            📄 ${exportType.toUpperCase()}
        </button>

    </div>
    `
}

bubble.innerHTML = html

if(exportType){

    const btn = bubble.querySelector(".export-btn")

    btn.onclick = ()=>{
        if(exportType === "docx"){
            exportDOCX(text)
        }else{
            exportFile(text)
        }
    }

}

/* 🔥 TẠO BUTTON TRƯỚC */
const copyAllBtn = document.createElement("button")
copyAllBtn.className = "copy-btn-clean"
copyAllBtn.innerText = "Copy"

copyAllBtn.onclick = ()=>{

  navigator.clipboard.writeText(text)

  copyAllBtn.innerText = "Copied ✓"

  setTimeout(()=>{
    copyAllBtn.innerText = "Copy"
  },1200)
}

// /* 🔥 onclick CHỈ 1 LẦN */
// copyAllBtn.onclick = ()=>{

//   const temp = document.createElement("textarea")
//   temp.value = text
//   document.body.appendChild(temp)
//   temp.select()
//   document.execCommand("copy")
//   document.body.removeChild(temp)

//   copyAllBtn.innerHTML = `<i class="bi bi-check"></i>`

//   setTimeout(()=>{
//     copyAllBtn.innerHTML = `<i class="bi bi-clipboard"></i>`
//   },1500)
// }

const footer = document.createElement("div")
footer.style.display = "flex"
footer.style.justifyContent = "flex-end"
footer.style.marginTop = "6px"

footer.appendChild(copyAllBtn)
bubble.appendChild(footer)

row.appendChild(bubble)
chatEl.appendChild(row)

/* highlight code */
bubble.querySelectorAll("pre code").forEach(el=>{
hljs.highlightElement(el)
})

/* copy từng block code */
bubble.querySelectorAll("pre").forEach(block=>{

const btn = document.createElement("button")
btn.className = "copy-btn"
btn.innerHTML = `<i class="bi bi-clipboard"></i>`

btn.onclick = ()=>{

const code = block.querySelector("code")?.innerText || block.innerText

if(navigator.clipboard){
navigator.clipboard.writeText(code)
}else{
const textarea = document.createElement("textarea")
textarea.value = code
document.body.appendChild(textarea)
textarea.select()
document.execCommand("copy")
document.body.removeChild(textarea)
}

btn.innerHTML = `<i class="bi bi-check"></i>`

setTimeout(()=>{
btn.innerHTML = `<i class="bi bi-clipboard"></i>`
},1500)

}

block.appendChild(btn)

})

/* math */
if(window.MathJax){
MathJax.typesetPromise([bubble])
}

/* scroll */
setTimeout(()=>{
if(window.innerWidth > 768){
    chatEl.scrollTop = chatEl.scrollHeight
}
},50)

}

function streamBot(text, exportType=null){

const row = document.createElement("div")
row.className = "msgrow bot"

const bubble = document.createElement("div")
bubble.className = "bubble position-relative"

// 🔥 tách content riêng (KHÔNG bị reset)
const content = document.createElement("div")

// 🔥 nút copy luôn tồn tại
const copyAllBtn = document.createElement("button")
copyAllBtn.className = "copy-btn-clean"
copyAllBtn.innerText = "Copy"

copyAllBtn.onclick = ()=>{
  navigator.clipboard.writeText(text)
  copyAllBtn.innerText = "Copied ✓"
  setTimeout(()=> copyAllBtn.innerText = "Copy", 1200)
}

const footer = document.createElement("div")
footer.style.display = "flex"
footer.style.justifyContent = "flex-end"
footer.style.marginTop = "6px"

footer.appendChild(copyAllBtn)

bubble.appendChild(content)
bubble.appendChild(footer)

row.appendChild(bubble)
chatEl.appendChild(row)

let i = 0

const timer = setInterval(()=>{

    // ❗ CHỈ render content → KHÔNG đụng footer
    content.innerHTML = marked.parse(text.substring(0,i))
      .replace(/language-j\b/g,"language-java")

    /* highlight realtime */
    content.querySelectorAll("pre code").forEach(el=>{
        hljs.highlightElement(el)
    })

    chatEl.scrollTop = chatEl.scrollHeight

    i++

    if(i > text.length){

        clearInterval(timer)

        /* highlight lại */
        content.querySelectorAll("pre code").forEach(el=>{
            hljs.highlightElement(el)
        })

        /* thêm nút copy cho code */
        content.querySelectorAll("pre").forEach(block=>{

            if(block.querySelector(".copy-btn")) return

            const btn = document.createElement("button")
            btn.className = "copy-btn"
            btn.innerHTML = `<i class="bi bi-clipboard"></i>`

            btn.onclick = ()=>{
                const code = block.innerText
                navigator.clipboard.writeText(code)

                btn.innerHTML = `<i class="bi bi-check"></i>`

                setTimeout(()=>{
                    btn.innerHTML = `<i class="bi bi-clipboard"></i>`
                },1500)
            }

            block.appendChild(btn)
        })

        /* math */
        if(window.MathJax){
            MathJax.typesetPromise([bubble])
        }

        /* export */
        if(exportType){

            const wrap = document.createElement("div")
            wrap.style.display = "flex"
            wrap.style.gap = "6px"
            wrap.style.marginTop = "6px"

            const btn = document.createElement("button")
            btn.className = "btn btn-sm btn-success"
            btn.innerText = "⬇️ Tải file " + exportType.toUpperCase()

            btn.onclick = ()=>{
                if(exportType === "docx"){
                    exportDOCX(text)
                }else{
                    exportFile(text)
                }
            }
wrap.appendChild(btn)

            footer.appendChild(wrap)
        }

    }

},5)
}



// ====== Gemini ======
async function callGemini(userText, images, files){

let memoryData=[]

try{

const mem = await fetch("/ai/api/get_memory.php?user_id="+localStorage.getItem("user_id"))
let text = await mem.text()

if(text.trim() === ""){
memoryData=[]
}else{
memoryData = JSON.parse(text)
}

}catch(e){
console.log("memory load error",e)
}

// lấy dữ liệu training liên quan
let trainingData = []

try{

const res = await fetch("/ai/api/get_training.php?q=" + encodeURIComponent(userText))
trainingData = await res.json()

}catch(e){
console.log("training load error",e)
}

let extraKnowledge=""
let userMemory=""

if(memoryData.length){
userMemory = `
Thông tin mới nhất về người dùng:
${memoryData[0].memory_value}
`
}

trainingData.forEach(t=>{
extraKnowledge += `
User correction:
Question: ${t.question}
Correct answer: ${t.correct_answer}

`
})
const isThinking = 
mode === "thinking" || 
(mode === "auto" && detectThinking(userText))

const thinkingPrompt = isThinking
? "\nHãy suy nghĩ từng bước trước khi trả lời.\n"
: ""
const parts = [{text:userText}];

const isFromSearch = userText.includes("Dựa vào thông tin sau:");
const isInternalPrompt = userText.startsWith("Câu hỏi:");

const toolInstruction = isFromSearch
? "\nBạn đang có dữ liệu từ internet. Trả lời luôn, KHÔNG được search nữa.\n"
: "";

const payload={
contents:[
{
role:"user",
parts:[
{text: systemInstruction + thinkingPrompt + toolInstruction + "\n" + userMemory + extraKnowledge}
]
},
// KHÔNG gửi history từ client
{
role:"user",
parts:[
{text:userText},

...files.map(f=>({
text: "File "+f.name+":\n"+f.content
})),

...images.map(img=>({
inline_data:{
mime_type: img.startsWith("data:image/png") ? "image/png" : "image/jpeg",
data:img.split(",")[1]
}
}))
]
}
],

generationConfig:{
temperature: isThinking ? 0.7 : 0.5,
maxOutputTokens: isThinking ? 20000 : 4000
}
};

const controller=new AbortController();
const timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);

let res;

try{

res = await fetch(WORKER_URL,{
method:"POST",
signal: controller.signal,
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
model:MODEL,
payload:payload,
user_id:localStorage.getItem("user_id"),
conversation_id:conversation_id
})
});

}catch(err){

if(err.name==="AbortError"){
throw new Error("timeout");
}

throw err;

}

clearTimeout(timeout);

const raw=await res.text();

let data;

try{
    data = JSON.parse(raw);
}catch{
    throw new Error("server trả dữ liệu không phải JSON");
}

// 🔥 FIX ĐÚNG CHỖ (sau parse)
if(data?.conversation_id && !conversation_id){
    conversation_id = data.conversation_id

    // 👉 load history NGAY
    loadHistory()

    
}


if(!res.ok){
throw new Error(data?.error?.message || "http error");
}

const respParts=data?.candidates?.[0]?.content?.parts || [];
const reply=respParts.map(p=>p.text).join("\n");
// 🔥 AUTO TITLE (CHỈ 1 LẦN)
if(conversation_id && !autoRenamed){

    autoRenamed = true
const cleanTitle = (lastUserMessage || "Chat mới")
    .replace(/[#*\n]/g," ")
    .trim()
    .substring(0,40)

    fetch("/ai/api/rename_conversation.php",{
        method:"POST",
        headers:{
            "Content-Type":"application/json"
        },
        body:JSON.stringify({
            id: conversation_id,
            title: cleanTitle
        })
    }).then(()=>loadHistory())
}

if(!isInternalPrompt){
    history.push({role:"user",parts});
    history.push({role:"model",parts:[{text:reply}]});
}

if(history.length>20){
history=history.slice(-20);
}

return reply;

}

// ====== SEND ======
async function send(){


const userText = msgEl.value.trim()
if(!userText.toLowerCase().includes("tìm trên mạng") && !userText.startsWith("/search")){
    lastUserMessage = userText
}
detectMemory(userText)

const imgInput = document.getElementById("fileImg")
const camInput = document.getElementById("fileCam")
const docInput = document.getElementById("fileDoc")

let images = []
let files = []

if(imgInput.files.length>0 || camInput.files.length>0){

const allImages = [
...Array.from(imgInput.files),
...Array.from(camInput.files)
]

for(const file of allImages){

const base64 = await new Promise(resolve=>{
const reader = new FileReader()
reader.onload = ()=>resolve(reader.result)
reader.readAsDataURL(file)
})

images.push(base64)

}

}

if(docInput.files.length>0){

for(const file of docInput.files){

let text=""

if(file.name.endsWith(".docx")){

const arrayBuffer = await file.arrayBuffer()

const result = await mammoth.extractRawText({
arrayBuffer: arrayBuffer
})

text = result.value

}else{

text = await file.text()

}

files.push({
name: file.name,
content: text
})

}

}



if(!userText && images.length===0 && files.length===0) return
// ===== TOOL DETECTION =====
if(userText.startsWith("/search ") || userText.toLowerCase().includes("tìm trên mạng")){

    let query = userText

    // clean keyword
    query = query.replace(/tìm trên mạng/gi,"")
    query = query.replace(/^\/search/gi,"")
    query = query.trim()

    if(!query){
        addBotBubble("❌ bạn chưa nhập nội dung cần tìm")
        return
    }

    addUserBubble(userText)
    scrollToBottom()

    runSearch(query, userText)

    msgEl.value = ""   // 🔥 FIX BUG INPUT KHÔNG XÓA

    return
}

// ===== EXPORT COMMAND =====

// export txt (giữ nguyên)
if(userText.trim() === "/export"){
    return exportFile(lastAIAnswer)
}


// 🔥 export docx
if(userText.toLowerCase().includes("xuất file docx") || userText.trim() === "/export docx"){
    if(!lastExportContent){
        addBotBubble("❌ chưa có nội dung để xuất")
        return
    }
    return exportDOCX(lastExportContent)
}

addUserBubble(userText, images)
scrollToBottom()

msgEl.value=""
msgEl.style.height="auto"

document.getElementById("attachments").innerHTML=""
imgInput.value=""
camInput.value=""
docInput.value=""

const btn = document.getElementById("send")
if(btn) btn.disabled = true

const typing=document.createElement("div")
typing.className="msgrow bot"
typing.innerHTML=`<div class="bubble">đang trả lời…</div>`

chatEl.appendChild(typing)

try{

let reply = await callGemini(userText, images, files)
// 🔥 FORCE EXPORT FORMAT
// 🔥 detect export trực tiếp từ user
if(userText.toLowerCase().includes("xuất file docx")){

    typing.remove()

    const content = lastExportContent || lastAIAnswer || userText

    if(!content){
        addBotBubble("❌ chưa có nội dung để xuất")
        return
    }

    exportDOCX(content)
    return
}

// 🔥 AI quyết định export
// 🔥 AI quyết định export (ĐÚNG LOGIC)
// 🔥 EXPORT (FIX CHUẨN)
let exportType = null

let rawReply = reply   // 🔥 giữ bản gốc

if(rawReply.includes("[EXPORT]")){
    const parts = rawReply.split("[EXPORT]")
    reply = parts[0].trim()
    exportType = parts[1].trim().toLowerCase()
}else{
    lastAIAnswer = reply
}

// 🔥 AUTO SEARCH
if(reply.startsWith("[SEARCH]")){

    const query = reply.replace("[SEARCH]", "").trim()

    typing.remove()

    addBotBubble("🔎 Đang tìm: " + query)

    await runSearch(query, userText)

    return
}


if(!reply.startsWith("[SEARCH]") && !reply.startsWith("[EXPORT]")){
    if(isValidForExport(reply)){
        lastExportContent = reply
        localStorage.setItem("lastExportContent", reply)
    }
}

detectCorrection(userText)

typing.remove()
streamBot(reply, exportType)

setTimeout(()=>{
if(window.MathJax){
MathJax.typeset()
}
},100)

}catch(e){

typing.remove()
addBotBubble("lỗi: "+e.message)

}

}

// ====== LOGIN ======
async function login(){

const username = document.getElementById("login_username").value;
const password = document.getElementById("login_password").value;

const res = await fetch("/ai/api/login.php",{
    method:"POST",
    headers:{
        "Content-Type":"application/json"
    },
    body:JSON.stringify({
        username,
        password
    })
});

let data;
try{
    data = await res.json();
}catch{
    document.getElementById("loginMsg").innerText = "Server lỗi (JSON)";
    return;
}

console.log("LOGIN RESPONSE:", data);

if(data.success){

    // ✅ lưu user_id
    localStorage.setItem("user_id", data.user_id);

    // ✅ lưu tên (nếu có)
    if(data.full_name){
        localStorage.setItem("full_name", data.full_name);
    }

    document.getElementById("loginBox").remove();

    // 👉 check profile
    checkProfile(data.user_id);

}else{
    document.getElementById("loginMsg").innerText = "Sai tài khoản hoặc mật khẩu";
}

}

// ====== REGISTER ======
async function register(){

const msgBox = document.getElementById("registerMsg")
msgBox.innerHTML=""

const username=document.getElementById("reg_username").value
const password=document.getElementById("reg_password").value
const password2=document.getElementById("reg_password2").value

if(password!==password2){

msgBox.innerHTML=`<div class="text-danger">
Mật khẩu nhập lại không khớp
</div>`

return
}

const res=await fetch("/ai/api/register.php",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
username,
password
})
})

const data=await res.json()

if(data.status==="ok"){

msgBox.innerHTML=`<div class="text-success">
Đăng ký thành công ✔
</div>`

setTimeout(()=>{
showLogin()
},1500)

}else{

msgBox.innerHTML=`<div class="text-danger">
${data.msg}
</div>`

}
document.getElementById("reg_username").value=""
document.getElementById("reg_password").value=""
document.getElementById("reg_password2").value=""

}

// ====== LOGOUT ======
function logout(){

localStorage.clear();
location.reload();

}

// ====== HISTORY ======
async function loadHistory(){

const user_id=localStorage.getItem("user_id");

const res=await fetch("/ai/api/get_conversations.php?user_id="+user_id);
const data=await res.json();

const list=document.getElementById("historyList");
if(!list) return;

list.innerHTML="";

if(data.length===0) return;

data.forEach((c,i)=>{

const div = document.createElement("div")
div.className = "chat-history-item d-flex justify-content-between align-items-center"

div.innerHTML = `
<div class="chat-title flex-grow-1">${c.title}</div>

<div class="dropdown">
<button class="btn btn-sm" data-bs-toggle="dropdown">⋮</button>

<ul class="dropdown-menu dropdown-menu-end">

<li>
<button class="dropdown-item"
onclick="renameChat(${c.id}, '${c.title}')">
✏️ Đổi tên
</button>
</li>

<li>
<button class="dropdown-item text-danger"
onclick="deleteChat(${c.id})">
🗑️ Xoá
</button>
</li>

</ul>
</div>
`


div.onclick = () => loadConversation(c.id)
div.style.cursor = "pointer"


list.appendChild(div)


});

}

//rename

async function renameChat(id, oldTitle){

const title = prompt("Nhập tên mới", oldTitle)

if(!title) return

await fetch("/ai/api/rename_conversation.php",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
id:id,
title:title
})
})

loadHistory()

}

//delete chat
async function deleteChat(id){

if(!confirm("Xoá cuộc trò chuyện này?")) return

const res = await fetch("/ai/api/delete_conversation.php",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
id:id
})
})

const text = await res.text()

let data
try{
  data = JSON.parse(text)
}catch{
  console.log("SERVER ERROR:", text)
  addBotBubble("❌ server lỗi")
  return
}
console.log(data)
loadHistory()

chatEl.innerHTML=""

}

async function loadConversation(id){

conversation_id=id

const res = await fetch("/ai/api/get_messages.php?conversation_id="+id)
const data = await res.json()

chatEl.innerHTML=""
history=[]

data.forEach(m=>{

if(m.role==="user"){

addUserBubble(m.text, m.images ? JSON.parse(m.images) : [])

history.push({
role:"user",
parts:[{text:m.text}]
})

}else{

if(m.text.startsWith("[EXPORT_FILE]||")){

const base64Data = m.text.split("||")[1]
const content = atob(base64Data)

const clean = fixLatex(cleanExportContent(content))

const base64Encoded = btoa(unescape(encodeURIComponent(clean)))
const url = "data:text/plain;base64," + base64Encoded

    addBotBubble(`
📄 File đã xuất trước đó:

👉 <a href="${url}" target="_blank">Mở lại</a>
`)
}else{

    let text = m.text
    let exportType = null

    if(text.includes("[EXPORT]")){
        const parts = text.split("[EXPORT]")
        text = parts[0].trim()
        exportType = parts[1].trim().toLowerCase()
    }

    addBotBubble(text, exportType)
}

history.push({
role:"model",
parts:[{text:m.text}]
})

}

})

scrollToBottom()

}

// ====== PAGE LOAD ======
document.addEventListener("paste", async (e)=>{

// 🔥 chỉ xử lý nếu có ảnh
const items = e.clipboardData.items

let hasImage = false

for(const item of items){
    if(item.type.indexOf("image") !== -1){
        hasImage = true
    }
}

// 👉 nếu KHÔNG phải ảnh → cho paste bình thường
if(!hasImage) return

e.preventDefault()

const imgInput = document.getElementById("fileImg")
const dt = new DataTransfer()

for(const item of items){

if(item.type.indexOf("image") !== -1){

const file = item.getAsFile()
dt.items.add(file)

const reader = new FileReader()

reader.onload = function(ev){

const div=document.createElement("div")
div.className="atimg"

div.innerHTML=`
<img src="${ev.target.result}">
<button class="atremove">×</button>
`

div.querySelector(".atremove").onclick=()=>{
div.remove()
}

attachments.appendChild(div)

}

reader.readAsDataURL(file)

}

}

imgInput.files = dt.files

})




window.onload = function(){
	chatEl = document.getElementById("chat") || null;
	msgEl = document.getElementById("msg") || null;

    chatEl = document.getElementById("chat");
    statusEl = document.getElementById("status");
    msgEl = document.getElementById("msg");
	

    lastExportContent = localStorage.getItem("lastExportContent") || ""

    // 🔥 đặt SAU khi có msgEl
if(msgEl){

  msgEl.addEventListener("focus", ()=>{

  // ❌ CHẶN MOBILE
  if(window.innerWidth <= 768) return

  setTimeout(()=>{
    msgEl.scrollIntoView({block:"center"});
  },300)

})




  // auto resize
  msgEl.addEventListener("input", ()=>{
    msgEl.style.height = "auto";
    msgEl.style.height = msgEl.scrollHeight + "px";
  })

}
sendBtn = document.getElementById("send");

chatEl.addEventListener("dragover",(e)=>{
    e.preventDefault()
})

chatEl.addEventListener("drop",(e)=>{

    e.preventDefault()

    const droppedFiles = e.dataTransfer.files
    const docInput = document.getElementById("fileDoc")
    const imgInput = document.getElementById("fileImg")

    const dtDoc = new DataTransfer()
    const dtImg = new DataTransfer()

    Array.from(droppedFiles).forEach(file=>{

        // ảnh
        if(file.type.startsWith("image")){

            const reader = new FileReader()

            reader.onload = function(ev){

                const div=document.createElement("div")
                div.className="atimg"

                div.innerHTML=`
                <img src="${ev.target.result}">
                <button class="atremove">×</button>
                `

                div.querySelector(".atremove").onclick=()=>{
                    div.remove()
                }

                attachments.appendChild(div)

            }

            reader.readAsDataURL(file)

            dtImg.items.add(file)

        }

        // file document
        else{

            const div=document.createElement("div")
            div.className="atchip"

            div.innerHTML=`
            📄 ${file.name}
            <button class="atremove">×</button>
            `

            div.querySelector(".atremove").onclick=()=>{
                div.remove()
            }

            attachments.appendChild(div)

            dtDoc.items.add(file)

        }

    })

    imgInput.files = dtImg.files
    docInput.files = dtDoc.files

})

attachments = document.getElementById("attachments");
// camera preview
document.getElementById("fileCam")?.addEventListener("change",(e)=>{

attachments.innerHTML=""

Array.from(e.target.files).forEach(file=>{

const reader = new FileReader()

reader.onload = function(ev){

const div = document.createElement("div")
div.className="atimg"

div.innerHTML=`
<img src="${ev.target.result}">
<button class="atremove">×</button>
`

div.querySelector(".atremove").onclick=()=>{
div.remove()
}

attachments.appendChild(div)

}

reader.readAsDataURL(file)

})

})

const uid = localStorage.getItem("user_id");

if(uid){

    document.getElementById("loginBox").style.display="none";

    // 👉 check profile luôn
    checkProfile(uid)


    loadHistory()

    // 🔥 luôn tạo chat mới
    newChat()

}else{

document.getElementById("loginBox").style.display="flex";
document.getElementById("chatApp").style.display="none";

}

document.getElementById("send")?.addEventListener("click",send)

msgEl?.addEventListener("keydown",(e)=>{
if(e.key==="Enter" && !e.shiftKey){
e.preventDefault()
send()
}
})

// ===== auto format dd/mm/yyyy =====
const dobInput = document.getElementById("pf_dob")

if(dobInput){
  dobInput.addEventListener("input", (e)=>{
    let v = e.target.value.replace(/\D/g,"")

    if(v.length >= 2) v = v.slice(0,2) + "/" + v.slice(2)
    if(v.length >= 5) v = v.slice(0,5) + "/" + v.slice(5,9)

    e.target.value = v
  })
}


}
function toggleSidebar(){

const sb = document.getElementById("sidebar")

if(!sb) return

sb.classList.toggle("open")

}

function setMode(m){

mode = m

const btn = document.getElementById("modeBtn")

if(m === "thinking"){
    btn.innerText = "🧠 Thinking"
}else{
    btn.innerText = "⚡ Fast"
}

}

document.getElementById("pickImage")?.addEventListener("click",()=>{
document.getElementById("fileImg").click()
})

document.getElementById("pickCamera")?.addEventListener("click", async ()=>{

    // nếu đang chạy trong Flutter
    if(window.flutter_inappwebview){

        const path = await window.flutter_inappwebview.callHandler('openCamera')

        if(path){
            console.log("Ảnh từ Flutter:", path)
            // TODO: nếu muốn preview thì xử lý thêm ở đây
        }

    }else{
        // fallback cho trình duyệt
        document.getElementById("fileCam").click()
    }

})

document.getElementById("pickFile")?.addEventListener("click",()=>{
document.getElementById("fileDoc").click()
})


document.getElementById("fileImg")?.addEventListener("change",(e)=>{

attachments.innerHTML = ""

const files = e.target.files

for(let i = 0; i < files.length; i++){

const file = files[i]
const reader = new FileReader()

reader.onload = function(ev){

const div = document.createElement("div")
div.className = "atimg"

div.innerHTML = `
<img src="${ev.target.result}">
<button class="atremove">×</button>
`

div.querySelector(".atremove").onclick = ()=>{
div.remove()
}

attachments.appendChild(div)

}

reader.readAsDataURL(file)

}

})

document.getElementById("fileDoc")?.addEventListener("change",(e)=>{

Array.from(e.target.files).forEach(file=>{

const div=document.createElement("div")
div.className="atchip"

div.innerHTML=`
📄 ${file.name}
<button class="atremove">×</button>
`

div.querySelector(".atremove").onclick=()=>{
div.remove()
}

attachments.appendChild(div)

})

})
function newChat(){
	autoRenamed = false  // 🔥 THÊM DÒNG NÀY
lastAIAnswer = ""

conversation_id=null
history=[]
lastExportContent = ""
chatEl.innerHTML=""

addBotBubble("chào bạn 😄 tôi là Btoan AI.")

}
document.addEventListener("click", function(e){

    const sidebar = document.getElementById("sidebar")
    const menuBtn = document.querySelector(".menu-btn")

    // đóng sidebar
    if(sidebar && sidebar.classList.contains("open")){
        if(!sidebar.contains(e.target) && !menuBtn.contains(e.target)){
            sidebar.classList.remove("open")
        }
    }

    

})


function scrollToBottom(){
    if(!chatEl) return

    // ❌ chặn mobile
    if(window.innerWidth < 768) return

    chatEl.scrollTop = chatEl.scrollHeight
}
window.visualViewport?.addEventListener("resize",()=>{

    // 🔥 CHẶN nếu đang focus input
    if(document.activeElement !== msgEl){
        setTimeout(()=>{
            scrollToBottom()
        },200)
    }

})
function showRegister(){

document.getElementById("loginForm").style.display="none"
document.getElementById("registerForm").style.display="block"

}

function showLogin(){

document.getElementById("loginForm").style.display="block"
document.getElementById("registerForm").style.display="none"

}

async function detectCorrection(userText){

const keywords = [
"sai",
"không đúng",
"phải là",
"đáp án là",
"correct",
"actually"
]

let isCorrection=false

keywords.forEach(k=>{
if(userText.toLowerCase().includes(k)){
isCorrection=true
}
})

if(!isCorrection) return

await fetch("/ai/api/save_training.php",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
question:lastUserMessage,
ai_answer:lastAIAnswer,
correct_answer:userText,
user_id:localStorage.getItem("user_id")
})
})

console.log("AI learned correction")

}
async function detectMemory(userText){

const keywords=[
"tôi là",
"tên tôi",
"tôi tên",
"tôi năm nay",
"tuổi",
"tôi sống ở"
]

let save=false

keywords.forEach(k=>{
if(userText.toLowerCase().includes(k)){
save=true
}
})

if(!save) return

await fetch("/ai/api/save_memory.php",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
user_id:localStorage.getItem("user_id"),
memory:userText
})
})

console.log("memory saved")

}
function togglePassword(id, el){

const input = document.getElementById(id);

if(input.type === "password"){
input.type = "text";
el.classList.remove("bi-eye");
el.classList.add("bi-eye-slash");
}else{
input.type = "password";
el.classList.remove("bi-eye-slash");
el.classList.add("bi-eye");
}

}
document.addEventListener("visibilitychange", ()=>{

if(!document.hidden){
scrollToBottom()
}

})
async function runSearch(query, originalText){

    const loading = document.createElement("div")
    loading.className = "msgrow bot"
    loading.innerHTML = `<div class="bubble">🔎 đang tìm kiếm...</div>`
    chatEl.appendChild(loading)

    try{

        const res = await fetch("/ai/api/search.php?q="+encodeURIComponent(query))
        const data = await res.json()

        let text = ""

        data.results.forEach(r=>{
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

    }catch(e){

        loading.remove()
        addBotBubble("❌ lỗi search")

    }
}
async function exportFile(content){

if(!content.trim()){
    addBotBubble("❌ chưa có nội dung")
    return
}

localStorage.setItem("lastExportContent", content)

// 🔥 gọi API upload
const res = await fetch("/ai/api/upload.php",{
    method:"POST",
    headers:{
        "Content-Type":"application/json"
    },
    body: JSON.stringify({
        content: content,
        ext: "txt"
    })
})

const text = await res.text()

let data
try{
  data = JSON.parse(text)
}catch{
  console.log("SERVER ERROR:", text)
  addBotBubble("❌ server lỗi")
  return
}

if(!data.url){
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
async function exportDOCX(content){

const clean = fixLatex(cleanExportContent(content))

const res = await fetch("/ai/api/upload.php",{
    method:"POST",
    headers:{
        "Content-Type":"application/json"
    },
    body: JSON.stringify({
        content: clean,
        ext: "docx"   // 🔥 QUAN TRỌNG
    })
})

const text = await res.text()

let data
try{
  data = JSON.parse(text)
}catch{
  console.log("SERVER ERROR:", text)
  addBotBubble("❌ server lỗi")
  return
}

if(!data.url){
    addBotBubble("❌ upload lỗi")
    return
}

// 🔥 mở + tải file Word thật
window.open(data.url, "_blank")

}
async function searchHistory(q){

const res = await fetch("/ai/api/search_history.php?q="+encodeURIComponent(q)+"&user_id="+localStorage.getItem("user_id"))

const data = await res.json()

const list = document.getElementById("historyList")
list.innerHTML=""

data.forEach(c=>{
    const div=document.createElement("div")
    div.innerText=c.title
    div.onclick=()=>loadConversation(c.id)
    list.appendChild(div)
})
}
let startY = 0

document.addEventListener("touchstart", (e)=>{
    startY = e.touches[0].clientY
})

document.addEventListener("touchmove", (e)=>{
    const y = e.touches[0].clientY

    if(y - startY > 120 && window.scrollY === 0){
        location.reload()
    }
})
function fixLatex(text){

return text
.replace(/\$(.*?)\$/g,"$1") // bỏ dấu $
.replace(/\\times/g,"×")
.replace(/\\cdot/g,"·")
.replace(/\\frac{(.*?)}{(.*?)}/g,"($1/$2)")
.replace(/\\text{(.*?)}/g,"$1")
.replace(/\\sqrt{(.*?)}/g,"√($1)")
.replace(/\\left|\\right/g,"")
.replace(/\\,/g,"")
.replace(/\\\\/g,"\n")

}
function isValidForExport(text){

    if(text.length < 50) return false

    if(/ủa|ok|ừ|ờ|hello|hi/i.test(text)) return false

    if(text.includes("?")) return false

    return true
}
function cleanExportContent(text){

return text
.replace(/chào bạn.*?\n/gi,"")
.replace(/tôi sẽ giúp.*?\n/gi,"")
.replace(/👉|📄|🔎/g,"")
.trim()

}
async function checkProfile(user_id){

const res = await fetch("/ai/api/check_profile.php?user_id=" + user_id)
const data = await res.json()

if(data.has_profile){

    document.getElementById("profileBox").style.display="none"
    document.getElementById("chatApp").style.display="flex"

    document.getElementById("userName").innerText =
        data.full_name || "User"

}else{

    document.getElementById("profileBox").style.display="flex"
    document.getElementById("chatApp").style.display="none"
}
}
async function saveProfile(){

    console.log({full_name, dob})
    console.log("API response:", data)

const full_name = document.getElementById("pf_name").value.trim()
let dob = document.getElementById("pf_dob").value.trim()
const user_id = localStorage.getItem("user_id")

// ===== validate =====
if(!full_name || !dob){
    document.getElementById("profileMsg").innerText = "Vui lòng nhập đầy đủ"
    return
}

// ===== validate format dd/mm/yyyy =====
if(!/^\d{2}\/\d{2}\/\d{4}$/.test(dob)){
    document.getElementById("profileMsg").innerText = "Ngày sinh phải dạng dd/mm/yyyy"
    return
}

// ===== check ngày hợp lệ =====
const d = Number(day)
const m = Number(month)
const y = Number(year)

if(
  d < 1 || d > 31 ||
  m < 1 || m > 12 ||
  y < 1900 || y > 2100
){
  document.getElementById("profileMsg").innerText = "Ngày không hợp lệ"
  return
}
// ===== convert → yyyy-mm-dd =====
dob = `${year}-${month}-${day}`

// ===== gửi API =====
const res = await fetch("/ai/api/update_name.php",{
    method:"POST",
    headers:{
        "Content-Type":"application/json"
    },
    body: JSON.stringify({
        user_id,
        full_name,
        dob
    })
})

let data
try{
    data = await res.json()
}catch{
    document.getElementById("profileMsg").innerText = "Server lỗi (không phải JSON)"
    return
}

// ===== success =====
if(data.success){

    localStorage.setItem("user_id", data.user_id);

    if(data.full_name){
        localStorage.setItem("full_name", data.full_name)
        localStorage.setItem("has_profile","1")
    }

    // ❌ KHÔNG remove nữa
    const loginBox = document.getElementById("loginBox")
    if(loginBox){
        loginBox.style.display = "none"
    }

    checkProfile(data.user_id);
}

}