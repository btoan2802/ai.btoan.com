let monacoEditor = null;
let monacoDiffEditor = null;
let activeProjectId = 0;
let activeFilePath = null;
let currentAgentProposal = null;

// Multi-Tab & Multi-Model State Map: key = path, value = { path, name, language, model, isDirty, fileId }
let openTabsMap = new Map();
let workspaceFilesList = []; // Flattened list for Ctrl+P Quick Open

// Context Menu State
let selectedContextNode = null;

document.addEventListener("DOMContentLoaded", () => {
    initMonacoEditors();
    loadUserProjects();

    // Keyboard Shortcuts (Ctrl+S for Save, Ctrl+P for Quick Open, Ctrl+/ for Comment)
    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveCurrentFile();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            openQuickOpenModal();
        }
    });

    // Hide Context Menu on click outside
    document.addEventListener("click", () => {
        hideContextMenu();
    });

    // Enter key in Terminal
    const termInput = document.getElementById("terminalCommandInput");
    if (termInput) {
        termInput.addEventListener("keydown", (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                executeTerminalInput();
            }
        });
    }
});

// ====== 1. MONACO EDITOR & MONACO DIFF EDITOR INITIALIZATION ======
function initMonacoEditors() {
    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
    require(['vs/editor/editor.main'], function () {
        const container = document.getElementById('monacoContainer');
        const diffContainer = document.getElementById('monacoDiffContainer');

        if (container) {
            monacoEditor = monaco.editor.create(container, {
                value: '// Welcome to Visual Studio Code Web - Btoan Cloud IDE!\n// Select a file from Workspace Explorer to start coding.',
                language: 'csharp',
                theme: 'vs-dark',
                automaticLayout: true,
                fontSize: 13,
                fontFamily: "'Fira Code', Consolas, Monaco, monospace",
                minimap: { enabled: true },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                tabSize: 4,
                wordWrap: 'on',
                folding: true,
                matchBrackets: 'always',
                autoIndent: 'advanced',
                renderWhitespace: 'selection'
            });

            // Monaco Cursor Position Event Handler
            monacoEditor.onDidChangeCursorPosition((e) => {
                const lnColEl = document.getElementById("statusLnCol");
                if (lnColEl) {
                    lnColEl.innerText = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
                }
            });

            // Monaco Action Keybinding for Ctrl+/ (Comment Line)
            monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
                monacoEditor.trigger('keyboard', 'editor.action.commentLine', {});
            });
        }

        if (diffContainer) {
            monacoDiffEditor = monaco.editor.createDiffEditor(diffContainer, {
                theme: 'vs-dark',
                automaticLayout: true,
                readOnly: true,
                fontSize: 13,
                fontFamily: "'Fira Code', Consolas, Monaco, monospace"
            });
        }
    });
}

// ====== 2. MULTI-MODEL TAB MANAGER & DIRTY STATE ======
function getOrCreateTabModel(path, name, content, language, fileId) {
    if (openTabsMap.has(path)) {
        return openTabsMap.get(path);
    }

    const lang = language || detectMonacoLang(path);
    const uri = monaco.Uri.parse(`inmemory://workspace/${activeProjectId}/${path}`);

    let model = monaco.editor.getModel(uri);
    if (!model) {
        model = monaco.editor.createModel(content || "", lang, uri);
    } else {
        model.setValue(content || "");
        monaco.editor.setModelLanguage(model, lang);
    }

    const tabObj = {
        path: path,
        name: name || PathFileName(path),
        language: lang,
        model: model,
        isDirty: false,
        fileId: fileId || 0
    };

    // Track Dirty State on Content Change
    model.onDidChangeContent(() => {
        if (!tabObj.isDirty) {
            tabObj.isDirty = true;
            renderTabBar();
        }
    });

    openTabsMap.set(path, tabObj);
    return tabObj;
}

function switchTab(path) {
    if (!openTabsMap.has(path)) return;
    const tabObj = openTabsMap.get(path);
    activeFilePath = path;

    showMonacoNormalEditor();
    if (monacoEditor && tabObj.model) {
        monacoEditor.setModel(tabObj.model);
    }

    const breadcrumbEl = document.getElementById("breadcrumbPath");
    if (breadcrumbEl) breadcrumbEl.innerText = path.replace(/\//g, " > ");

    const pillEl = document.getElementById("activeContextPill");
    if (pillEl) pillEl.innerText = tabObj.name;

    const langEl = document.getElementById("statusLanguage");
    if (langEl) langEl.innerText = tabObj.language.toUpperCase();

    renderTabBar();
    loadVersionHistory();
}

function closeTab(path, e) {
    if (e) e.stopPropagation();

    if (openTabsMap.has(path)) {
        const tabObj = openTabsMap.get(path);
        if (tabObj.isDirty) {
            if (!confirm(`File '${tabObj.name}' has unsaved changes. Are you sure you want to close it?`)) {
                return;
            }
        }

        if (tabObj.model) {
            tabObj.model.dispose();
        }
        openTabsMap.delete(path);
    }

    if (activeFilePath === path) {
        const keys = Array.from(openTabsMap.keys());
        if (keys.length > 0) {
            const lastPath = keys[keys.length - 1];
            switchTab(lastPath);
        } else {
            activeFilePath = null;
            document.getElementById("activeFileName").innerText = "Select a file...";
            document.getElementById("activeFilePath").innerText = "Workspace / Select a file...";
            setMonacoContent("// Select a file from Explorer to start coding.", "");
        }
    }
    renderTabBar();
}

function renderTabBar() {
    const bar = document.getElementById("editorTabBar");
    if (!bar) return;
    bar.innerHTML = "";

    if (openTabsMap.size === 0) {
        bar.innerHTML = `
            <div class="vscode-tab active extra-small d-flex align-items-center gap-2">
                <i class="bi bi-file-earmark-code text-info"></i>
                <span id="activeFileName">Select a file...</span>
            </div>
        `;
        return;
    }

    openTabsMap.forEach((tabObj, path) => {
        const isActive = path === activeFilePath;
        const iconClass = getFileIconClass(tabObj.name);
        const dirtyMarker = tabObj.isDirty ? `<span class="text-warning font-mono fw-bold ms-1">●</span>` : "";

        const tabEl = document.createElement("div");
        tabEl.className = `vscode-tab ${isActive ? "active" : ""} d-flex align-items-center gap-2`;
        tabEl.innerHTML = `
            <i class="${iconClass}"></i>
            <span>${escapeHtml(tabObj.name)}</span>${dirtyMarker}
            <button onclick="closeTab('${escapeHtml(path)}', event)" class="tab-close-btn">&times;</button>
        `;
        tabEl.onclick = () => switchTab(path);
        bar.appendChild(tabEl);
    });
}

function showMonacoNormalEditor() {
    document.getElementById("monacoContainer").style.display = "block";
    document.getElementById("monacoDiffContainer").style.display = "none";
}

function showMonacoDiffEditor() {
    document.getElementById("monacoContainer").style.display = "none";
    document.getElementById("monacoDiffContainer").style.display = "block";
}

function setMonacoContent(content, filePath, lang) {
    if (!monacoEditor) return;
    showMonacoNormalEditor();

    const detectedLang = lang || detectMonacoLang(filePath);
    const tabObj = getOrCreateTabModel(filePath, PathFileName(filePath), content, detectedLang);
    monacoEditor.setModel(tabObj.model);
    activeFilePath = filePath;
    renderTabBar();
}

function setMonacoDiff(originalContent, modifiedContent, filePath) {
    if (!monacoDiffEditor) return;
    showMonacoDiffEditor();
    const lang = detectMonacoLang(filePath);

    const originalModel = monaco.editor.createModel(originalContent || "", lang);
    const modifiedModel = monaco.editor.createModel(modifiedContent || "", lang);
    monacoDiffEditor.setModel({
        original: originalModel,
        modified: modifiedModel
    });
}

function toggleDiffEditorView() {
    const diffContainer = document.getElementById("monacoDiffContainer");
    if (diffContainer.style.display === "none") {
        const curContent = getMonacoContent();
        setMonacoDiff(curContent, curContent + "\n// Proposing changes...", activeFilePath);
    } else {
        showMonacoNormalEditor();
    }
}

function getMonacoContent() {
    return monacoEditor ? monacoEditor.getValue() : "";
}

function detectMonacoLang(filePath) {
    if (!filePath) return "csharp";
    const ext = filePath.split('.').pop().toLowerCase();
    switch (ext) {
        case 'php': return 'php';
        case 'cs': return 'csharp';
        case 'js': case 'jsx': return 'javascript';
        case 'ts': case 'tsx': return 'typescript';
        case 'html': case 'cshtml': return 'html';
        case 'css': return 'css';
        case 'sql': return 'sql';
        case 'py': return 'python';
        case 'json': return 'json';
        case 'md': return 'markdown';
        default: return 'plaintext';
    }
}

function PathFileName(path) {
    if (!path) return "";
    return path.split('/').pop().split('\\').pop();
}

// ====== 3. CTRL + P QUICK OPEN SEARCH MODAL ======
function openQuickOpenModal() {
    const modal = document.getElementById("quickOpenModal");
    if (modal) {
        modal.style.display = "block";
        const input = document.getElementById("quickOpenInput");
        if (input) {
            input.value = "";
            input.focus();
            onQuickOpenSearch();
        }
    }
}

function closeQuickOpenModal() {
    const modal = document.getElementById("quickOpenModal");
    if (modal) modal.style.display = "none";
}

function onQuickOpenSearch() {
    const input = document.getElementById("quickOpenInput");
    const container = document.getElementById("quickOpenResults");
    if (!input || !container) return;

    const q = input.value.toLowerCase().trim();
    container.innerHTML = "";

    const filtered = workspaceFilesList.filter(f => !q || f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-muted extra-small p-2">No matching files found</div>`;
        return;
    }

    filtered.slice(0, 10).forEach(f => {
        const item = document.createElement("div");
        item.className = "quick-open-item d-flex align-items-center justify-content-between font-mono";
        item.innerHTML = `
            <div><i class="${getFileIconClass(f.name)} me-2"></i><b>${escapeHtml(f.name)}</b></div>
            <span class="text-muted extra-small">${escapeHtml(f.path)}</span>
        `;
        item.onclick = () => {
            closeQuickOpenModal();
            openFile(f.path, f.name);
        };
        container.appendChild(item);
    });
}

// ====== 4. WORKSPACE PROJECT MANAGER ======
async function loadUserProjects() {
    const select = document.getElementById("projectSelect");
    if (!select) return;

    try {
        const userId = localStorage.getItem("user_id") || "1";
        const res = await fetch(`/ai/api/agent/projects?user_id=${userId}`);
        const data = await res.json();

        if (data.ok && data.projects && data.projects.length > 0) {
            select.innerHTML = "";
            data.projects.forEach(p => {
                const opt = document.createElement("option");
                opt.value = p.id;
                opt.innerText = `${p.name} (${p.template})`;
                select.appendChild(opt);
            });
            activeProjectId = data.projects[0].id;
            refreshFileTree();
        } else {
            select.innerHTML = `<option value="0">No projects found</option>`;
            activeProjectId = 0;
            renderEmptyProjectsUI();
        }
    } catch (err) {
        select.innerHTML = `<option value="0">Error loading projects</option>`;
        activeProjectId = 0;
        renderEmptyProjectsUI();
    }
}

function renderEmptyProjectsUI() {
    const container = document.getElementById("workspaceTreeContainer");
    if (!container) return;

    container.innerHTML = `
        <div class="p-3 text-center text-muted extra-small">
            <i class="bi bi-folder-x fs-1 text-secondary mb-2 d-block"></i>
            <div class="fw-bold text-light mb-1">No Projects Found</div>
            <div class="mb-3 extra-small">Bạn chưa có dự án nào trong Workspace. Khởi tạo ngay bên dưới:</div>
            <div class="d-flex flex-column gap-2">
                <button onclick="openCreateProjectModal()" class="btn btn-primary btn-sm extra-small fw-semibold text-white"><i class="bi bi-plus-lg me-1"></i> Create New Project</button>
                <button onclick="openUploadZipModal()" class="btn btn-outline-warning btn-sm extra-small text-warning"><i class="bi bi-file-earmark-zip me-1"></i> Import ZIP Archive</button>
                <button onclick="openImportGitModal()" class="btn btn-outline-info btn-sm extra-small text-info"><i class="bi bi-git me-1"></i> Clone Git Repository</button>
            </div>
        </div>
    `;

    openTabsMap.forEach((t) => { if (t.model) t.model.dispose(); });
    openTabsMap.clear();
    renderTabBar();
    setMonacoContent("// No project opened. Please create or open a project.", "");
}

function onProjectChanged() {
    const select = document.getElementById("projectSelect");
    if (!select) return;
    activeProjectId = parseInt(select.value) || 0;
    activeFilePath = null;

    openTabsMap.forEach((t) => { if (t.model) t.model.dispose(); });
    openTabsMap.clear();

    renderTabBar();
    setMonacoContent("// Select a file from Workspace Explorer to start coding.", "");
    refreshFileTree();
}

function openCreateProjectModal() {
    const modalEl = document.getElementById("createProjectModal");
    if (modalEl) new bootstrap.Modal(modalEl).show();
}

function openUploadZipModal() {
    const modalEl = document.getElementById("uploadZipModal");
    if (modalEl) new bootstrap.Modal(modalEl).show();
}

function openImportGitModal() {
    const modalEl = document.getElementById("importGitModal");
    if (modalEl) new bootstrap.Modal(modalEl).show();
}

async function submitCreateProject() {
    const name = document.getElementById("newProjectName").value;
    const template = document.getElementById("newProjectTemplate").value;
    if (!name || !name.trim()) return alert("Vui lòng nhập tên dự án!");

    const userId = parseInt(localStorage.getItem("user_id")) || 1;

    try {
        const res = await fetch("/ai/api/agent/projects/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: userId, name: name.trim(), template: template })
        });
        const data = await res.json();
        if (data.ok && data.project) {
            bootstrap.Modal.getInstance(document.getElementById("createProjectModal"))?.hide();
            await loadUserProjects();
            document.getElementById("projectSelect").value = data.project.id;
            onProjectChanged();
        } else alert("Lỗi tạo dự án: " + data.error);
    } catch (err) { alert("Lỗi kết nối: " + err.message); }
}

async function submitUploadZip() {
    const name = document.getElementById("zipProjectName").value;
    const fileInput = document.getElementById("zipFileInput");
    if (!name || !name.trim() || !fileInput.files.length) return alert("Vui lòng chọn file ZIP!");

    const userId = parseInt(localStorage.getItem("user_id")) || 1;
    const formData = new FormData();
    formData.append("userId", userId);
    formData.append("name", name.trim());
    formData.append("file", fileInput.files[0]);

    try {
        const res = await fetch("/ai/api/agent/projects/upload-zip", { method: "POST", body: formData });
        const data = await res.json();
        if (data.ok && data.project) {
            bootstrap.Modal.getInstance(document.getElementById("uploadZipModal"))?.hide();
            await loadUserProjects();
            document.getElementById("projectSelect").value = data.project.id;
            onProjectChanged();
        } else alert("Lỗi upload: " + data.error);
    } catch (err) { alert("Lỗi kết nối: " + err.message); }
}

async function submitImportGit() {
    const name = document.getElementById("gitProjectName").value;
    const gitUrl = document.getElementById("gitRepoUrl").value;
    if (!name || !gitUrl) return alert("Vui lòng nhập Git Repository URL!");

    const userId = parseInt(localStorage.getItem("user_id")) || 1;

    try {
        const res = await fetch("/ai/api/agent/projects/import-git", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: userId, name: name.trim(), gitUrl: gitUrl.trim() })
        });
        const data = await res.json();
        if (data.ok && data.project) {
            bootstrap.Modal.getInstance(document.getElementById("importGitModal"))?.hide();
            await loadUserProjects();
            document.getElementById("projectSelect").value = data.project.id;
            onProjectChanged();
        } else alert("Lỗi import: " + data.error);
    } catch (err) { alert("Lỗi kết nối: " + err.message); }
}

// ====== 5. RECURSIVE EXPLORER & REST API ======
async function refreshFileTree() {
    const container = document.getElementById("workspaceTreeContainer");
    if (!container) return;
    if (activeProjectId <= 0) {
        renderEmptyProjectsUI();
        return;
    }

    container.innerHTML = `<div class="text-center text-muted p-3 extra-small"><div class="spinner-border spinner-border-sm me-1"></div> Loading tree...</div>`;
    workspaceFilesList = [];

    const userId = localStorage.getItem("user_id") || "1";

    try {
        const res = await fetch(`/api/workspace/${activeProjectId}/tree?userId=${userId}`);
        const data = await res.json();

        if (data.ok && data.tree) {
            container.innerHTML = "";
            flattenWorkspaceFiles(data.tree);
            container.appendChild(renderTreeNode(data.tree));
        } else {
            container.innerHTML = `<div class="text-danger extra-small p-2">Lỗi: ${data.error}</div>`;
        }
    } catch (err) { container.innerHTML = `<div class="text-danger extra-small p-2">Lỗi: ${err.message}</div>`; }
}

function flattenWorkspaceFiles(node) {
    if (!node.isDirectory && node.path !== "") {
        workspaceFilesList.push({ name: node.name, path: node.path });
    }
    if (node.children) {
        node.children.forEach(flattenWorkspaceFiles);
    }
}

function renderTreeNode(node) {
    const wrapper = document.createElement("div");

    if (node.path === "") {
        if (node.children) node.children.forEach(child => wrapper.appendChild(renderTreeNode(child)));
        return wrapper;
    }

    const itemNode = document.createElement("div");
    const isSelected = activeFilePath === node.path;
    itemNode.className = `tree-node ${isSelected ? "selected" : ""}`;

    const iconClass = node.isDirectory ? "bi bi-folder-fill text-warning" : getFileIconClass(node.name);

    itemNode.innerHTML = `
        <div class="d-flex align-items-center gap-1.5 overflow-hidden">
            <i class="${iconClass} extra-small"></i>
            <span class="text-truncate">${escapeHtml(node.name)}</span>
        </div>
        <div class="tree-node-actions">
            <button onclick="event.stopPropagation(); promptRenameItem('${node.path}')" class="btn-icon" title="Rename"><i class="bi bi-pencil"></i></button>
            <button onclick="event.stopPropagation(); promptDeleteItem('${node.path}')" class="btn-icon text-danger" title="Delete"><i class="bi bi-trash"></i></button>
        </div>
    `;

    itemNode.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectedContextNode = node;
        showContextMenu(e.clientX, e.clientY, node.isDirectory);
    };

    if (node.isDirectory) {
        const childrenContainer = document.createElement("div");
        childrenContainer.className = "tree-node-children";
        childrenContainer.style.display = "block";

        itemNode.onclick = (e) => {
            e.stopPropagation();
            const isHidden = childrenContainer.style.display === "none";
            childrenContainer.style.display = isHidden ? "block" : "none";
        };

        wrapper.appendChild(itemNode);
        if (node.children) node.children.forEach(child => childrenContainer.appendChild(renderTreeNode(child)));
        wrapper.appendChild(childrenContainer);
    } else {
        itemNode.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll(".tree-node").forEach(n => n.classList.remove("selected"));
            itemNode.classList.add("selected");
            openFile(node.path, node.name);
        };
        wrapper.appendChild(itemNode);
    }

    return wrapper;
}

function getFileIconClass(filename) {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".php")) return "bi bi-filetype-php text-primary";
    if (lower.endsWith(".cs")) return "bi bi-file-earmark-code text-info";
    if (lower.endsWith(".jsx") || lower.endsWith(".js")) return "bi bi-file-earmark-play text-warning";
    if (lower.endsWith(".tsx") || lower.endsWith(".ts")) return "bi bi-file-earmark-code text-primary";
    if (lower.endsWith(".cshtml") || lower.endsWith(".html")) return "bi bi-file-earmark-richtext text-danger";
    if (lower.endsWith(".css")) return "bi bi-file-earmark-spreadsheet text-primary";
    if (lower.endsWith(".py")) return "bi bi-file-type-py text-success";
    if (lower.endsWith(".sql")) return "bi bi-database text-warning";
    if (lower.endsWith(".json")) return "bi bi-file-earmark-json text-warning";
    return "bi bi-file-earmark text-muted";
}

// ====== 6. RIGHT-CLICK CONTEXT MENU ======
function showContextMenu(x, y, isDirectory) {
    const menu = document.getElementById("explorerContextMenu");
    const fileItems = document.getElementById("contextMenuFileItems");
    const folderItems = document.getElementById("contextMenuFolderItems");

    if (!menu || !fileItems || !folderItems) return;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = "block";

    if (isDirectory) {
        fileItems.style.display = "none";
        folderItems.style.display = "block";
    } else {
        fileItems.style.display = "block";
        folderItems.style.display = "none";
    }
}

function hideContextMenu() {
    const menu = document.getElementById("explorerContextMenu");
    if (menu) menu.style.display = "none";
}

function onContextOpen() {
    hideContextMenu();
    if (selectedContextNode && !selectedContextNode.isDirectory) {
        openFile(selectedContextNode.path, selectedContextNode.name);
    }
}

let deleteCandidatePath = null;

function openCreateFileModal(defaultPrefix = "") {
    const input = document.getElementById("createFileInput");
    if (input) {
        input.value = defaultPrefix ? `${defaultPrefix}/` : "";
    }
    const modalEl = document.getElementById("createFileModal");
    if (modalEl) new bootstrap.Modal(modalEl).show();
}

async function submitCreateFileModal() {
    const input = document.getElementById("createFileInput");
    if (!input || !input.value.trim()) return;
    const modalEl = document.getElementById("createFileModal");
    bootstrap.Modal.getInstance(modalEl)?.hide();
    await apiCreateFile(input.value.trim());
}

function openCreateFolderModal(defaultPrefix = "") {
    const input = document.getElementById("createFolderInput");
    if (input) {
        input.value = defaultPrefix ? `${defaultPrefix}/` : "";
    }
    const modalEl = document.getElementById("createFolderModal");
    if (modalEl) new bootstrap.Modal(modalEl).show();
}

async function submitCreateFolderModal() {
    const input = document.getElementById("createFolderInput");
    if (!input || !input.value.trim()) return;
    const modalEl = document.getElementById("createFolderModal");
    bootstrap.Modal.getInstance(modalEl)?.hide();
    await apiCreateFolder(input.value.trim());
}

function openRenameModal(oldPath) {
    document.getElementById("renameOldPath").value = oldPath;
    document.getElementById("renameNewPath").value = oldPath;
    const modalEl = document.getElementById("renameItemModal");
    if (modalEl) new bootstrap.Modal(modalEl).show();
}

async function submitRenameModal() {
    const oldPath = document.getElementById("renameOldPath").value;
    const newPath = document.getElementById("renameNewPath").value;
    if (!newPath || !newPath.trim() || newPath === oldPath) return;

    const modalEl = document.getElementById("renameItemModal");
    bootstrap.Modal.getInstance(modalEl)?.hide();

    const userId = localStorage.getItem("user_id") || "1";
    try {
        const res = await fetch(`/api/workspace/file/rename?userId=${userId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId: activeProjectId, oldPath: oldPath, newPath: newPath.trim() })
        });
        const data = await res.json();
        if (data.ok) refreshFileTree();
        else alert("Lỗi đổi tên: " + data.error);
    } catch (err) { alert("Lỗi: " + err.message); }
}

function openDeleteModal(targetPath) {
    deleteCandidatePath = targetPath;
    const targetEl = document.getElementById("deleteTargetPath");
    if (targetEl) targetEl.innerText = targetPath;
    const modalEl = document.getElementById("deleteItemModal");
    if (modalEl) new bootstrap.Modal(modalEl).show();
}

async function submitDeleteModal() {
    if (!deleteCandidatePath) return;
    const modalEl = document.getElementById("deleteItemModal");
    bootstrap.Modal.getInstance(modalEl)?.hide();

    const userId = localStorage.getItem("user_id") || "1";
    try {
        const res = await fetch(`/api/workspace/file/delete?userId=${userId}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId: activeProjectId, path: deleteCandidatePath })
        });
        const data = await res.json();
        if (data.ok) refreshFileTree();
        else alert("Lỗi xóa: " + data.error);
    } catch (err) { alert("Lỗi: " + err.message); }
}

function onContextNewFile() {
    hideContextMenu();
    const parentPath = selectedContextNode ? selectedContextNode.path : "";
    openCreateFileModal(parentPath);
}

function onContextNewFolder() {
    hideContextMenu();
    const parentPath = selectedContextNode ? selectedContextNode.path : "";
    openCreateFolderModal(parentPath);
}

function onContextRename() {
    hideContextMenu();
    if (selectedContextNode) openRenameModal(selectedContextNode.path);
}

function onContextDelete() {
    hideContextMenu();
    if (selectedContextNode) openDeleteModal(selectedContextNode.path);
}

async function promptCreateFile() { openCreateFileModal(); }
async function promptCreateFolder() { openCreateFolderModal(); }
async function promptRenameItem(oldPath) { openRenameModal(oldPath); }
async function promptDeleteItem(path) { openDeleteModal(path); }

async function apiCreateFile(path) {
    if (!activeProjectId) return;
    const userId = localStorage.getItem("user_id") || "1";

    try {
        const res = await fetch(`/api/workspace/file/create?userId=${userId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId: activeProjectId, path: path })
        });
        const data = await res.json();
        if (data.ok) refreshFileTree();
        else alert("Lỗi tạo file: " + data.error);
    } catch (err) { alert("Lỗi: " + err.message); }
}

async function apiCreateFolder(path) {
    if (!activeProjectId) return;
    const userId = localStorage.getItem("user_id") || "1";

    try {
        const res = await fetch(`/api/workspace/folder/create?userId=${userId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId: activeProjectId, path: path })
        });
        const data = await res.json();
        if (data.ok) refreshFileTree();
        else alert("Lỗi tạo folder: " + data.error);
    } catch (err) { alert("Lỗi: " + err.message); }
}

// ====== 7. ACTIVITY BAR & BOTTOM PANEL SWITCHERS ======
function switchActivityTab(tab) {
    const leftPanel = document.getElementById("leftExplorerPanel");
    const rightPanel = document.getElementById("rightAgentPanel");

    document.getElementById("actBtnExplorer").classList.remove("active");
    document.getElementById("actBtnAgent").classList.remove("active");

    if (tab === 'agent') {
        document.getElementById("actBtnAgent").classList.add("active");
        rightPanel.style.display = "flex";
    } else {
        document.getElementById("actBtnExplorer").classList.add("active");
        leftPanel.style.display = "flex";
    }
}

function switchBottomTab(tab) {
    const tabs = ['Terminal', 'Problems', 'Output'];
    tabs.forEach(t => {
        const body = document.getElementById(`bottomTab${t}Body`);
        const btn = document.getElementById(`bottomTabBtn${t}`);
        if (body) body.style.display = t.toLowerCase() === tab ? "block" : "none";
        if (btn) btn.className = t.toLowerCase() === tab ? "panel-tab-btn active" : "panel-tab-btn";
    });
}

function toggleBottomPanel() {
    const panel = document.getElementById("bottomPanel");
    if (panel) panel.style.display = panel.style.display === "none" ? "flex" : "none";
}

// ====== 8. TERMINAL EXECUTION (RUNTIME SERVICE) ======
async function executeTerminalInput() {
    const input = document.getElementById("terminalCommandInput");
    const cmd = input.value;
    if (!cmd || !cmd.trim()) return;

    input.value = "";
    await sendTerminalCommand(cmd.trim());
}

async function sendTerminalCommand(cmd) {
    if (!activeProjectId) return alert("Vui lòng chọn một dự án trước!");

    appendTerminalLog(`> ${cmd}\nExecuting command in runtime workspace...\n`);
    switchBottomTab('terminal');

    const userId = localStorage.getItem("user_id") || "1";

    try {
        const res = await fetch(`/api/runtime/run?userId=${userId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId: activeProjectId, command: cmd })
        });
        const data = await res.json();

        if (!data.ok) {
            appendTerminalLog(`❌ ${data.error || "Runtime execution failed"}\n`);
            return;
        }

        const sessionId = data.sessionId;
        pollTerminalOutput(sessionId);
    } catch (err) {
        appendTerminalLog(`Runtime Error: ${err.message}\n`);
    }
}

async function pollTerminalOutput(sessionId) {
    const userId = localStorage.getItem("user_id") || "1";
    let lastStdoutLen = 0;
    let lastStderrLen = 0;

    const interval = setInterval(async () => {
        try {
            const res = await fetch(`/api/runtime/output/${sessionId}?userId=${userId}`);
            const data = await res.json();

            if (data.ok) {
                const stdout = data.stdout || "";
                const stderr = data.stderr || "";

                if (stdout.length > lastStdoutLen) {
                    const newOut = stdout.substring(lastStdoutLen);
                    appendTerminalLog(newOut);
                    lastStdoutLen = stdout.length;
                }

                if (stderr.length > lastStderrLen) {
                    const newErr = stderr.substring(lastStderrLen);
                    appendTerminalLog(newErr);
                    lastStderrLen = stderr.length;
                }

                if (data.status !== "Running") {
                    clearInterval(interval);
                    appendTerminalLog(`\nProcess exited with status '${data.status}' (Exit Code: ${data.exitCode ?? 0})\n`);
                    
                    const fullLog = (stdout + "\n" + stderr);
                    if (data.exitCode !== 0 || fullLog.includes("error CS") || fullLog.includes("Build FAILED") || fullLog.includes("Error:")) {
                        appendTerminalLogHTML(`
                            <div class="my-2 p-2 bg-dark-subtle border border-warning rounded-2">
                                <div class="text-warning extra-small fw-bold mb-1"><i class="bi bi-exclamation-triangle-fill me-1"></i> Build or Runtime Error Detected!</div>
                                <button onclick="triggerAgentAutoFixBuildError()" class="btn btn-warning btn-sm extra-small fw-semibold text-dark">
                                    <i class="bi bi-robot me-1"></i> Auto-Fix Error with AI Agent
                                </button>
                            </div>
                        `);
                    }
                }
            } else {
                clearInterval(interval);
            }
        } catch {
            clearInterval(interval);
        }
    }, 400);
}

function appendTerminalLogHTML(html) {
    const log = document.getElementById("terminalOutputLog");
    if (log) {
        const div = document.createElement("div");
        div.innerHTML = html;
        log.appendChild(div);
        log.scrollTop = log.scrollHeight;
    }
}

function triggerAgentAutoFixBuildError() {
    const log = document.getElementById("terminalOutputLog");
    const errorText = log ? log.innerText : "Build error detected";
    switchActivityTab('agent');
    const inputEl = document.getElementById("agentTaskInput");
    if (inputEl) {
        inputEl.value = `Fix compiler and runtime build error: ${errorText.substring(0, 300)}`;
    }
    sendAgentTask();
}

function appendTerminalLog(text) {
    const log = document.getElementById("terminalOutputLog");
    const hist = document.getElementById("agentTerminalLogHistory");
    if (log) { log.innerText += text; log.scrollTop = log.scrollHeight; }
    if (hist) { hist.innerText += text; hist.scrollTop = hist.scrollHeight; }
}

function clearTerminalOutput() {
    const log = document.getElementById("terminalOutputLog");
    if (log) log.innerText = "";
}

// ====== 9. FILE READING & SAVING WITH REST API & DIRTY STATE ======
async function openFile(relativePath, fileName) {
    const userId = localStorage.getItem("user_id") || "1";

    try {
        const res = await fetch(`/api/workspace/file?projectId=${activeProjectId}&path=${encodeURIComponent(relativePath)}&userId=${userId}`);
        const data = await res.json();

        if (data.ok) {
            const tabObj = getOrCreateTabModel(relativePath, fileName || PathFileName(relativePath), data.content, data.language);
            switchTab(relativePath);
        } else {
            alert("Lỗi đọc file: " + data.error);
        }
    } catch (err) { alert("Lỗi kết nối: " + err.message); }
}

async function saveCurrentFile() {
    if (!activeFilePath || !activeProjectId) return alert("Vui lòng mở một file để lưu!");

    const tabObj = openTabsMap.get(activeFilePath);
    if (!tabObj) return;

    const content = monacoEditor ? tabObj.model.getValue() : "";
    const btn = document.getElementById("btnSaveFile");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Saving...`;

    const userId = localStorage.getItem("user_id") || "1";

    try {
        const res = await fetch(`/api/editor/file/save?userId=${userId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fileId: tabObj.fileId || 0,
                projectId: activeProjectId,
                path: activeFilePath,
                content: content
            })
        });
        const data = await res.json();

        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-floppy me-1"></i> Save File (Ctrl+S)`;

        if (data.ok) {
            tabObj.isDirty = false;
            if (data.fileId) tabObj.fileId = data.fileId;
            renderTabBar();
            document.getElementById("activeFileName").innerText = tabObj.name;
            appendTerminalLog(`[Saved]: File '${activeFilePath}' saved successfully at ${data.updatedAt}.\n`);
            loadVersionHistory();
        } else {
            alert("❌ Cannot save file: " + data.error);
        }
    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-floppy me-1"></i> Save File (Ctrl+S)`;
        alert("❌ Cannot save file: " + err.message);
    }
}

// ====== 10. CURSOR AGENT WORKFLOW WITH ACCEPT & REJECT ======
function switchRightTab(tab) {
    const bodies = ['Chat', 'Plan', 'Diff', 'Terminal', 'History'];
    bodies.forEach(b => {
        const el = document.getElementById(`tab${b}Body`);
        const btn = document.getElementById(`tabBtn${b}`);
        if (el) el.style.display = b.toLowerCase() === tab ? "flex" : "none";
        if (btn) btn.className = b.toLowerCase() === tab ? "nav-link active py-0 px-2 extra-small" : "nav-link py-0 px-2 extra-small";
    });
}

async function loadVersionHistory() {
    const container = document.getElementById("versionHistoryList");
    if (!container || !activeProjectId || !activeFilePath) return;

    container.innerHTML = `<div class="text-center text-muted extra-small"><div class="spinner-border spinner-border-sm me-1"></div> Loading history...</div>`;

    try {
        const res = await fetch(`/ai/api/agent/file/versions?projectId=${activeProjectId}&path=${encodeURIComponent(activeFilePath)}`);
        const data = await res.json();

        if (data.ok && data.versions && data.versions.length > 0) {
            container.innerHTML = "";
            data.versions.forEach(v => {
                const card = document.createElement("div");
                card.className = "diff-card-vscode p-2 rounded-2 bg-dark-subtle";
                card.innerHTML = `
                    <div class="d-flex align-items-center justify-content-between mb-1">
                        <span class="fw-bold extra-small text-light">V${v.versionNumber} (${v.createdBy})</span>
                        <span class="text-muted extra-small">${v.createdAt}</span>
                    </div>
                    <div class="text-secondary extra-small mb-2">${escapeHtml(v.changeSummary || "")}</div>
                    <button onclick="rollbackToVersion(${v.id})" class="btn btn-outline-warning btn-sm extra-small py-0 px-2 rounded-1">
                        <i class="bi bi-arrow-counterclockwise me-1"></i> Rollback
                    </button>
                `;
                container.appendChild(card);
            });
        } else container.innerHTML = `<div class="text-muted extra-small">Chưa có lịch sử phiên bản.</div>`;
    } catch (err) { container.innerHTML = `<div class="text-danger extra-small">Lỗi: ${err.message}</div>`; }
}

async function rollbackToVersion(versionId) {
    if (!confirm("Rollback file về phiên bản này?")) return;

    try {
        const res = await fetch("/ai/api/agent/file/rollback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ versionId: versionId })
        });
        const data = await res.json();
        if (data.ok) {
            alert("🎉 Rollback thành công!");
            if (activeFilePath) openFile(activeFilePath, document.getElementById("activeFileName").innerText);
        } else alert("❌ Lỗi: " + data.error);
    } catch (err) { alert("Lỗi: " + err.message); }
}

async function sendAgentTask() {
    const inputEl = document.getElementById("agentTaskInput");
    const prompt = inputEl.value;
    if (!prompt || !prompt.trim() || !activeProjectId) return alert("Vui lòng nhập prompt và chọn dự án!");

    inputEl.value = "";
    appendAgentUserMsg(prompt);

    const btn = document.getElementById("btnSendAgentTask");
    btn.disabled = true;

    const bubbleId = "agent-bubble-" + Date.now();
    appendAgentProgressBubble(bubbleId);

    try {
        const res = await fetch("/ai/api/agent/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId: activeProjectId, prompt: prompt.trim() })
        });
        const data = await res.json();
        btn.disabled = false;

        if (!data.ok) {
            updateAgentProgressError(bubbleId, data.error || "Phân tích thất bại");
            return;
        }

        currentAgentProposal = data;
        renderAgentProposalResult(bubbleId, data);
    } catch (err) {
        btn.disabled = false;
        updateAgentProgressError(bubbleId, err.message);
    }
}

function appendAgentUserMsg(text) {
    const container = document.getElementById("agentMessagesContainer");
    const msg = document.createElement("div");
    msg.className = "agent-msg-bubble agent-msg-user font-sans";
    msg.innerHTML = `<div class="fw-semibold small text-light"><i class="bi bi-person me-1"></i> Task Prompt:</div><div>${escapeHtml(text)}</div>`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

function appendAgentProgressBubble(id) {
    const container = document.getElementById("agentMessagesContainer");
    const msg = document.createElement("div");
    msg.id = id;
    msg.className = "agent-msg-bubble agent-msg-ai font-sans d-flex flex-column gap-2";
    msg.innerHTML = `
        <div class="fw-semibold text-info small"><i class="bi bi-robot me-1"></i> Cursor Agent Workflow:</div>
        <div class="stepper-list d-flex flex-column gap-1 extra-small text-muted">
            <div><i class="bi bi-spinner spinner-border spinner-border-sm me-1"></i> Step 1: Analyzing workspace index...</div>
            <div class="text-secondary">Step 2: Creating execution plan...</div>
            <div class="text-secondary">Step 3: Calculating Monaco Diff...</div>
        </div>
    `;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

function renderAgentProposalResult(bubbleId, data) {
    const bubble = document.getElementById(bubbleId);
    if (!bubble) return;

    const planContainer = document.getElementById("planStepsContainer");
    if (planContainer) {
        planContainer.innerHTML = `<div class="alert alert-info p-2 extra-small mb-2">${escapeHtml(data.summary || "Kế hoạch thực thi")}</div>`;
    }

    const diffContainer = document.getElementById("diffProposalsContainer");
    if (diffContainer) {
        diffContainer.innerHTML = "";
        if (data.proposals) {
            data.proposals.forEach(p => {
                const card = document.createElement("div");
                card.className = "diff-card-vscode p-2 rounded-2";
                card.innerHTML = `
                    <div class="d-flex align-items-center justify-content-between mb-1">
                        <span class="fw-bold extra-small text-light font-mono">${escapeHtml(p.relativePath)}</span>
                        <button onclick="previewProposalDiff('${escapeHtml(p.relativePath)}')" class="btn btn-outline-info btn-sm extra-small py-0 px-2">Monaco Diff</button>
                    </div>
                `;
                diffContainer.appendChild(card);
            });
        }
    }

    let html = `
        <div class="fw-semibold text-info small"><i class="bi bi-robot me-1"></i> Cursor Agent Workspace Plan:</div>
        <div class="alert alert-info p-2 extra-small mb-2 rounded-2">${escapeHtml(data.summary || "Đề xuất thay đổi mã nguồn")}</div>
        <div class="fw-bold extra-small text-light mb-1">FILE CHANGES (${data.proposals ? data.proposals.length : 0}):</div>
    `;

    if (data.proposals && data.proposals.length > 0) {
        data.proposals.forEach(p => {
            const badgeColor = p.actionType === "CREATE" ? "bg-success" : "bg-primary";
            html += `
                <div class="diff-card-vscode p-2 mb-2">
                    <div class="d-flex align-items-center justify-content-between mb-1">
                        <span class="fw-semibold extra-small text-light font-mono">${escapeHtml(p.relativePath)}</span>
                        <span class="badge ${badgeColor} extra-small">${p.actionType}</span>
                    </div>
                    <pre class="bg-black text-light p-2 rounded-1 extra-small m-0 font-mono" style="max-height: 140px; overflow-y: auto;"><code>${escapeHtml(p.diff || p.proposedContent)}</code></pre>
                </div>
            `;
        });
    }

    html += `
        <div class="d-flex align-items-center justify-content-end gap-2 mt-2 pt-2 border-top border-secondary">
            <button onclick="rejectAgentChanges('${bubbleId}')" class="btn btn-outline-secondary btn-sm extra-small px-3">
                <i class="bi bi-x-lg me-1"></i> Reject
            </button>
            <button onclick="approveAndApplyAgentChanges('${bubbleId}')" class="btn btn-vscode btn-sm extra-small fw-semibold px-3">
                <i class="bi bi-check-lg me-1"></i> Accept & Modify Files
            </button>
        </div>
    `;

    bubble.innerHTML = html;
}

function previewProposalDiff(relPath) {
    if (!currentAgentProposal || !currentAgentProposal.proposals) return;
    const match = currentAgentProposal.proposals.find(p => p.relativePath === relPath);
    if (match) {
        setMonacoDiff(match.originalContent, match.proposedContent, relPath);
    }
}

function rejectAgentChanges(bubbleId) {
    const bubble = document.getElementById(bubbleId);
    if (bubble) {
        bubble.innerHTML = `<div class="text-muted extra-small"><i class="bi bi-x-circle me-1"></i> Proposal rejected by user. Code changes canceled.</div>`;
    }
    currentAgentProposal = null;
    showMonacoNormalEditor();
}

async function approveAndApplyAgentChanges(bubbleId) {
    if (!currentAgentProposal || !currentAgentProposal.proposals) return;

    appendTerminalLog("> Agent Execution: Applying file modifications and creating Version History...\n");
    switchBottomTab('terminal');

    try {
        const res = await fetch("/ai/api/agent/apply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId: activeProjectId, approvedProposals: currentAgentProposal.proposals })
        });
        const data = await res.json();

        appendTerminalLog(data.buildOutput || "Build completed.\n");

        if (!data.ok) return alert("❌ Lỗi thực thi: " + data.error);

        alert(`🎉 Accept thành công! Đã sửa ${data.appliedFiles ? data.appliedFiles.length : 0} file và lưu Version History!`);
        refreshFileTree();
        if (activeFilePath) openFile(activeFilePath, document.getElementById("activeFileName").innerText);
    } catch (err) { alert("Lỗi: " + err.message); }
}

async function runBuildOnly() {
    await sendTerminalCommand("dotnet build");
}

function updateAgentProgressError(bubbleId, errorMsg) {
    const bubble = document.getElementById(bubbleId);
    if (bubble) bubble.innerHTML = `<div class="text-danger small"><i class="bi bi-exclamation-triangle me-1"></i> Agent Error: ${escapeHtml(errorMsg)}</div>`;
}

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
