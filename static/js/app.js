const STATIC_BASE_URL = (() => {

    const base = window.STATIC_BASE_URL || '/static/';

    return base.endsWith('/') ? base : `${base}/`;

})();

const getAssetPath = (relativePath) => `${STATIC_BASE_URL}${relativePath}`;

const getPetAsset = (pet, level, state) => getAssetPath(`assets/pets/${pet}_${level}_${state}.png`);

const getStudentHeartCount = (student) => {

    if (!student || student.collectedPlants == null) return 0;

    if (Array.isArray(student.collectedPlants)) return student.collectedPlants.length;

    if (typeof student.collectedPlants === 'string') return student.collectedPlants.length;

    return 0;

};



const APP_CONFIG = window.APP_CONFIG || {};

if (!window.APP_CONFIG) {

    window.APP_CONFIG = APP_CONFIG;

}

const API_ROUTES = APP_CONFIG.routes || {};



const createRandomId = () => {

    if (window.crypto && typeof window.crypto.randomUUID === 'function') {

        return window.crypto.randomUUID();

    }

    return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;

};



const cloneData = (data, fallback = {}) => {

    if (data == null) return fallback;

    try {

        return JSON.parse(JSON.stringify(data));

    } catch (err) {

        console.warn('复制数据失败，使用默认值', err);

        return fallback;

    }

};



const updateInitialDataCache = (data) => {

    const cloned = cloneData(data, {});

    APP_CONFIG.initialData = cloned;

    window.APP_CONFIG.initialData = cloned;

};



const persistDataToServer = (data) => {

    if (!API_ROUTES.saveData) return Promise.resolve();

    return fetch(API_ROUTES.saveData, {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ data })

    }).then(res => {

        if (!res.ok) throw new Error('Failed to save data');

        updateInitialDataCache(data);

    }).catch(err => console.error('同步服务器数据失败:', err));

};



const persistGrowthSettingsToServer = (settings) => {

    if (!API_ROUTES.saveGrowth) return Promise.resolve();

    return fetch(API_ROUTES.saveGrowth, {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(settings)

    }).then(res => {

        if (!res.ok) throw new Error('Failed to save growth settings');

    }).catch(err => console.error('同步成长设置失败:', err));

};



async function refreshDataFromServer() {

    if (!API_ROUTES.getData) return;

    try {

        const response = await fetch(API_ROUTES.getData, { cache: 'no-store' });

        if (!response.ok) throw new Error('Failed to fetch latest data');

        const payload = await response.json();

        if (payload && payload.data) {

            allClassData = cloneData(payload.data, {});

            updateInitialDataCache(allClassData);

        }

    } catch (err) {

        console.error('从服务器同步最新数据失败:', err);

    }

}



// 音效管理器

const soundManager = {

    audioCtx: null, isInitialized: false,

    init() { if (this.isInitialized) return; try { this.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); this.isInitialized = true; } catch (e) { console.error("Web Audio API is not supported in this browser"); } },

    playTone(freq, type = 'sine', duration = 0.1) { if (!this.isInitialized) return; const o = this.audioCtx.createOscillator(), g = this.audioCtx.createGain(); o.connect(g); g.connect(this.audioCtx.destination); o.type = type; o.frequency.setValueAtTime(freq, this.audioCtx.currentTime); g.gain.setValueAtTime(1, this.audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration); o.start(this.audioCtx.currentTime); o.stop(this.audioCtx.currentTime + duration); },

    playClick() { this.playTone(880, 'triangle', 0.1); }, playMagicGrow() { if (!this.isInitialized) return; this.playTone(440, 'sine', 0.1); setTimeout(() => this.playTone(554.37, 'sine', 0.1), 80); setTimeout(() => this.playTone(659.25, 'sine', 0.15), 160); },

    playHarvest() { if (!this.isInitialized) return; this.playTone(523.25, 'triangle', 0.1); setTimeout(() => this.playTone(659.25, 'triangle', 0.1), 100); setTimeout(() => this.playTone(783.99, 'triangle', 0.2), 200); },

    playModalOpen() { this.playTone(600, 'sine', 0.15); }, playDelete() { this.playTone(300, 'square', 0.15); }, playUndo() { this.playTone(400, 'sawtooth', 0.15); }

};



// 宠物库定义

// 宠物类型配置

const PET_TYPES = ["cat_orange", "cat_black", "dog_corgi", "dog_border"];



// 宠物状态配置

const PET_STATES = ["sleep", "awake", "eat", "play"];



// 宠物配置库（替换原plantLibrary）

const petLibrary = {

    "cat_orange": {

        name: "橘猫",

        iconImage: getAssetPath('assets/ui/icon_cat_orange.png')

    },

    "cat_black": {

        name: "黑猫",

        iconImage: getAssetPath('assets/ui/icon_cat_black.png')

    },

    "dog_corgi": {

        name: "柯基",

        iconImage: getAssetPath('assets/ui/icon_dog_corgi.png')

    },

    "dog_border": {

        name: "边境牧羊犬",

        iconImage: getAssetPath('assets/ui/icon_dog_border.png')

    }

};



// 宠物成长门槛设置（从服务器缓存加载，若无则使用默认值）

let PET_LEVEL_2_THRESHOLD = 4;  // LV2：4个爱心

let PET_LEVEL_3_THRESHOLD = 8;  // LV3：8个爱心

let PET_LEVEL_4_THRESHOLD = 12; // LV4（徽章）：12个爱心



// 全局状态管理

let isProcessingClick = false; // 防止重复点击



// DOM元素引用 (合并)

const mainTitle = document.getElementById('main-title'),

      classMode = document.getElementById('class-mode'),

      setupMode = document.getElementById('setup-mode'),

      gameMode = document.getElementById('game-mode'),

      classCardGrid = document.getElementById('class-card-grid'),

      setupTitle = document.getElementById('setup-title'),

      studentInput = document.getElementById('student-input'),

      saveStudentsBtn = document.getElementById('save-students-btn'),

      enterGardenBtn = document.getElementById('enter-garden-btn'),

      existingStudents = document.getElementById('existing-students'),

      dailyGoal = document.getElementById('daily-goal'),

      manageStudentsBtn = document.getElementById('manage-students-btn'),

      undoBtn = document.getElementById('undo-btn'),

      toggleSelectModeBtn = document.getElementById('toggle-select-mode-btn'),

      selectAllBtn = document.getElementById('select-all-btn'),

      waterSelectedBtn = document.getElementById('water-selected-btn'),

      rollbackModal = document.getElementById('rollback-modal'),

      rollbackStudentName = document.getElementById('rollback-student-name'),

      rollbackStepsInput = document.getElementById('rollback-steps-input'),

      confirmRollbackBtn = document.getElementById('confirm-rollback-btn'),

      resetAllBtn = document.getElementById('reset-all-btn'),

      resetConfirmModal = document.getElementById('reset-confirm-modal'),

      resetConfirmText = document.getElementById('reset-confirm-text'),

      confirmResetAllBtn = document.getElementById('confirm-reset-all-btn'),

      addScoreModal = document.getElementById('add-score-modal'),

      addScoreStudentName = document.getElementById('add-score-student-name'),

      addScoreStepsInput = document.getElementById('add-score-steps-input'),

      confirmAddScoreBtn = document.getElementById('confirm-add-score-btn'),

      exportDataBtn = document.getElementById('export-data-btn'),

      importDataBtn = document.getElementById('import-data-btn'),

      dataFileInput = document.getElementById('data-file-input'),

      individualView = document.getElementById('individual-view'),

      groupView = document.getElementById('group-view'),

      shopView = document.getElementById('shop-view'),

      shopViewContainer = document.getElementById('shop-view-container'),

      gardenGridIndividual = document.getElementById('garden-grid-individual'),

      showIndividualViewBtn = document.getElementById('show-individual-view-btn'),

      showGroupViewBtn = document.getElementById('show-group-view-btn'),

      showShopViewBtn = document.getElementById('show-shop-view-btn'),

      groupNameInput = document.getElementById('group-name-input'),

      createGroupBtn = document.getElementById('create-group-btn'),

      individualSortSelect = document.getElementById('individual-sort-select'),

      groupSortSelect = document.getElementById('group-sort-select'),

      groupsDisplayArea = document.getElementById('groups-display-area'),

      groupEditorModal = document.getElementById('group-editor-modal'),

      groupEditorTitle = document.getElementById('group-editor-title'),

      groupEditorStudentList = document.getElementById('group-editor-student-list'),

      saveGroupMembersBtn = document.getElementById('save-group-members-btn'),

      deleteGroupConfirmModal = document.getElementById('delete-group-confirm-modal'),

      deleteGroupConfirmName = document.getElementById('delete-group-confirm-name'),

      confirmDeleteGroupBtn = document.getElementById('confirm-delete-group-btn'),

      penaltyGroupConfirmModal = document.getElementById('penalty-group-confirm-modal'),

      penaltyGroupConfirmName = document.getElementById('penalty-group-confirm-name'),

      confirmPenaltyGroupBtn = document.getElementById('confirm-penalty-group-btn'),

      // CSV相关DOM元素已移除，只支持Excel导入

      // 新增：宠物相关模态框元素

      lv3GraduationModal = document.getElementById('lv3-graduation-modal'),

      lv3GraduationMessage = document.getElementById('lv3-graduation-message'),

      lv3GraduationBadge = document.getElementById('lv3-graduation-badge'),

      continueCurrentPetBtn = document.getElementById('continue-current-pet-btn'),

      changePetBtn = document.getElementById('change-pet-btn'),

      petSelectionModal = document.getElementById('pet-selection-modal'),

      petSelectionMessage = document.getElementById('pet-selection-message'),

      petSelectionList = document.getElementById('pet-selection-list'),

      penaltyConfirmModal = document.getElementById('penalty-confirm-modal'),

      penaltyConfirmBtn = document.getElementById('penalty-confirm-btn'),

      backToClassSelectBtn = document.getElementById('back-to-class-select-btn'),

      // 宠物成长设置相关元素

      level2ThresholdInput = document.getElementById('level2-threshold-input'),

      level3ThresholdInput = document.getElementById('level3-threshold-input'),

      saveGrowthSettingsBtn = document.getElementById('save-growth-settings-btn'),

      switchClassBtn = document.getElementById('switch-class-btn'),

      unifiedModal = document.getElementById('unified-modal'),

      createClassModalContent = document.getElementById('create-class-modal-content'),

      newClassNameInput = document.getElementById('new-class-name-input'),

      createClassConfirmBtn = document.getElementById('create-class-confirm-btn'),

      saveSuccessModalContent = document.getElementById('save-success-modal-content'),

      modalEnterGardenBtn = document.getElementById('modal-enter-garden-btn'),

      confirmModalContent = document.getElementById('confirm-modal-content'),

      confirmModalText = document.getElementById('confirm-modal-text'),

      confirmOkBtn = document.getElementById('confirm-ok-btn'),

      addPrizeBtn = document.getElementById('add-prize-btn'),

      prizeNameInput = document.getElementById('prize-name-input'),

      prizeCostInput = document.getElementById('prize-cost-input'),

      prizeStockInput = document.getElementById('prize-stock-input'),

      prizeListDisplayArea = document.getElementById('prize-list-display-area'),

      redeemModalOverlay = document.getElementById('redeem-modal-overlay'),

      redeemModalTitle = document.getElementById('redeem-modal-title'),

      redeemStudentInfo = document.getElementById('redeem-student-info'),

      redeemPrizeList = document.getElementById('redeem-prize-list'),

      redeemConfirmModal = document.getElementById('redeem-confirm-modal'),

      redeemConfirmText = document.getElementById('redeem-confirm-text'),

      confirmRedeemBtn = document.getElementById('confirm-redeem-btn'),

      cancelRedeemBtn = document.getElementById('cancel-redeem-btn'),

      redeemModalCloseBtn = document.querySelector('#redeem-modal-overlay .close-redeem-modal'),

      classPasswordModal = document.getElementById('class-password-modal'),

      classPasswordTitle = document.getElementById('class-password-title'),

      classPasswordHint = document.getElementById('class-password-hint'),

      classPasswordInput = document.getElementById('class-password-input'),

      classPasswordError = document.getElementById('class-password-error'),

      classPasswordConfirmBtn = document.getElementById('class-password-confirm-btn'),

      classPasswordCancelBtn = document.getElementById('class-password-cancel-btn');



// 应用状态变量

const DEFAULT_TITLE = '🐾 宠物屋 🏠';



let allClassData = {}; // 所有班级数据

let currentClassId = null; // 当前选中的班级ID

let actionHistory = [];

let isSelectMode = false;

let selectedStudentIds = new Set();

let sortableInstanceIndividual = null;

let currentEditingGroupId = null;

let groupIdToDelete = null;

let groupIdToPenalize = null;

let importFileEvent = null;

let studentIdForManualAction = null;

let currentRedeemInfo = { studentId: null, prizeId: null };

let pendingClassAccessId = null;

let wasRedeemModalOpenBeforeConfirm = false;



// 初始化应用

function initApp() {

    console.log('🚀 初始化宠物屋...');



    loadAllClassData();

    loadTitle();

    loadGrowthSettings();

    initGrowthSettingsUI();

    showClassMode(true);

    setupEventListeners();



    console.log('✅ 宠物屋初始化完成');

}





// 数据迁移功能

// ====== 数据管理 (多班级) ======

function loadAllClassData() {

    if (window.APP_CONFIG && Object.prototype.hasOwnProperty.call(window.APP_CONFIG, 'initialData')) {

        allClassData = cloneData(window.APP_CONFIG.initialData, {});

        console.log('从服务器配置加载数据:', Object.keys(allClassData).length, '个班级');

        return;

    }

    allClassData = {};

    console.log('未从服务器获得数据，使用空班级列表');

}





function saveAllClassData() {

    try {

        console.log('saveAllClassData start');

        updateInitialDataCache(allClassData);

        persistDataToServer(allClassData);

    } catch (e) {

        console.error('数据保存失败:', e);

    }

}



function loadTitle() {

    mainTitle.innerHTML = DEFAULT_TITLE;

}





// 数据备份和恢复功能

// 宠物成长门槛设置相关函数

function saveGrowthSettings() {

    const settings = {

        level2Threshold: PET_LEVEL_2_THRESHOLD,

        level3Threshold: PET_LEVEL_3_THRESHOLD

    };

    if (!window.APP_CONFIG) {

        window.APP_CONFIG = {};

    }

    window.APP_CONFIG.growthSettings = { ...settings };

    persistGrowthSettingsToServer(settings);

}





function loadGrowthSettings() {

    const saved = window.APP_CONFIG && window.APP_CONFIG.growthSettings;

    if (saved) {

        PET_LEVEL_2_THRESHOLD = saved.level2Threshold || 4;

        PET_LEVEL_3_THRESHOLD = saved.level3Threshold || 8;

        return;

    }

    PET_LEVEL_2_THRESHOLD = 4;

    PET_LEVEL_3_THRESHOLD = 8;

}





// 初始化成长设置界面

function initGrowthSettingsUI() {

    // 如果服务器缓存中有错误的值（如5），清理并使用正确的默认值

    if (PET_LEVEL_2_THRESHOLD === 5) {

        PET_LEVEL_2_THRESHOLD = 4;

        saveGrowthSettings(); // 保存正确的值

        console.log('🔧 修复了错误的LV2门槛值：5 → 4');

    }

    if (PET_LEVEL_3_THRESHOLD === 5) {

        PET_LEVEL_3_THRESHOLD = 8;

        saveGrowthSettings(); // 保存正确的值

        console.log('🔧 修复了错误的LV3门槛值：5 → 8');

    }



    level2ThresholdInput.value = PET_LEVEL_2_THRESHOLD;

    level3ThresholdInput.value = PET_LEVEL_3_THRESHOLD;

}



// 保存成长设置

function handleSaveGrowthSettings() {

    const newLevel2 = parseInt(level2ThresholdInput.value);

    const newLevel3 = parseInt(level3ThresholdInput.value);



    // 验证输入

    if (isNaN(newLevel2) || isNaN(newLevel3) ||

        newLevel2 < 4 || newLevel3 < 8) {

        alert('请输入有效的数值！\nLV2至少需要4个爱心，LV3至少需要8个爱心。');

        return;

    }



    // 验证是否为4的倍数

    if (newLevel2 % 4 !== 0 || newLevel3 % 4 !== 0) {

        alert('升级门槛必须是4的倍数！\n这样与"每次点击给1颗爱心"的机制保持一致。');

        return;

    }



    if (newLevel2 >= newLevel3) {

        alert('升级门槛必须满足：LV2 < LV3！\n例如：LV2=4个爱心，LV3=8个爱心');

        return;

    }



    // 验证最大值限制

    if (newLevel2 > 20 || newLevel3 > 24) {

        alert('升级门槛设置过高！\nLV2最大20个爱心，LV3最大24个爱心。');

        return;

    }



    // 更新全局变量

    PET_LEVEL_2_THRESHOLD = newLevel2;

    PET_LEVEL_3_THRESHOLD = newLevel3;



    // 保存到服务器缓存

    saveGrowthSettings();



    // 显示保存成功提示

    alert('宠物成长设置已保存！');

}



// ====== 视图切换 (多班级) ======

async function showClassMode(forceRefresh = false) {

    if (forceRefresh) {

        await refreshDataFromServer();

    }

    classMode.style.display = 'block';

    setupMode.style.display = 'none';

    gameMode.style.display = 'none';

    currentClassId = null; // 重置当前班级

    renderClassList();

}



function showSetupMode() {

    console.log('🔧 showSetupMode被调用');

    console.log('🔧 当前currentClassId:', currentClassId);

    console.log('🔧 当前allClassData:', JSON.stringify(allClassData));



    classMode.style.display = 'none';

    setupMode.style.display = 'block';

    gameMode.style.display = 'none';



    // 确保当前班级数据结构完整

    const classData = allClassData[currentClassId];

    console.log('🔧 当前班级数据:', classData);



    if (!classData) {

        console.log('🔧 错误：找不到当前班级数据！');

        return;

    }



    if (!classData.students) classData.students = [];

    if (!classData.groups) classData.groups = [];

    if (!classData.prizes) classData.prizes = [];



    setupTitle.textContent = `为班级 “${classData.name}” 设置名单`;

    console.log('🔧 设置标题:', setupTitle.textContent);



    renderExistingStudents();

    renderGroupManagement();

    renderPrizeManagementList(); // 渲染商城奖品列表



    enterGardenBtn.style.display = classData.students.length > 0 ? 'inline-block' : 'none';

}



function showGameMode() {

    if (!currentClassId || !allClassData[currentClassId]) { showClassMode(); return; }

    const classData = allClassData[currentClassId];

    if (!classData.students || classData.students.length === 0) { showSetupMode(); return; }



    setupMode.style.display = 'none';

    classMode.style.display = 'none';

    gameMode.style.display = 'block';



    document.getElementById("current-class-display").textContent = `当前: ${classData.name}`;

    dailyGoal.value = classData.dailyGoal || "";

    actionHistory = []; 

    undoBtn.disabled = true;

    switchView('individual'); // 默认显示个人视图

}



// ====== 班级管理功能 (新增) ======

function renderClassList() {

    console.log('🔥 renderClassList被调用');

    console.log('🔥 当前allClassData:', JSON.stringify(allClassData));

    classCardGrid.innerHTML = "";

    for (const classId in allClassData) {

        const classData = allClassData[classId];

        const card = document.createElement("div");

        card.className = "class-card";

        card.addEventListener('click', () => handleClassCardClick(classId));

        card.innerHTML = `

            <div class="class-card-content">

                <h3>${classData.name}</h3>

                <p>${(classData.students || []).length} 名学生</p>

            </div>

        `;

        classCardGrid.appendChild(card);



    }

}



function showCreateClassModal() {

    createClassModalContent.style.display = 'block';

    saveSuccessModalContent.style.display = 'none';

    confirmModalContent.style.display = 'none';

    newClassNameInput.value = "";

    unifiedModal.classList.add('show');

    newClassNameInput.focus();



            }



function handleCreateClass() {

    const name = newClassNameInput.value.trim();

    if (!name) { alert("请输入班级名称！"); return; }

    const classId = "class_" + Date.now();



    // 初始化班级数据，包含所有需要的字段

    allClassData[classId] = {

        name: name,

        students: [],

        groups: [],

        prizes: [],

        dailyGoal: "",

        password: ""

    };



    // 强制保存数据（Chrome兼容性修复）

    saveAllClassData();



    // 强制重新加载数据以确保同步（Chrome兼容性修复）

    loadAllClassData();



    // 延迟渲染以确保数据同步（Chrome兼容性修复）

    setTimeout(() => {

        renderClassList();

        unifiedModal.classList.remove('show');



        // 延迟选择新创建的班级以确保DOM更新完成（Chrome兼容性修复）

        setTimeout(() => {

            selectClass(classId);

        }, 50);

    }, 100);

}



async function selectClass(classId) {

    if (!classId) return;

    const classData = allClassData[classId];

    if (!classData) {

        console.warn('找不到班级数据，尝试刷新:', classId);

        await showClassMode(true);

        return;

    }



    currentClassId = classId;

    isSelectMode = false;

    selectedStudentIds.clear();



    if (!classData.students) classData.students = [];

    if (!classData.groups) classData.groups = [];

    if (!classData.prizes) classData.prizes = [];

    if (classData.dailyGoal === undefined) classData.dailyGoal = "";

    if (typeof classData.password !== 'string') classData.password = "";



    (classData.students.length > 0 ? showGameMode : showSetupMode)();

}



function deleteClass(classId) {

    showConfirmModal(`确定要删除班级 “${allClassData[classId].name}” 吗？所有数据将永久丢失！`, () => {

        soundManager.init();

        soundManager.playDelete();

        delete allClassData[classId];



        saveAllClassData();

        renderClassList();

    }, true);

}



function showConfirmModal(text, onConfirm, isDanger = false) {

    confirmModalText.textContent = text;

    confirmOkBtn.style.backgroundColor = isDanger ? '#e53935' : '#4caf50';

    createClassModalContent.style.display = 'none';

    saveSuccessModalContent.style.display = 'none';

    confirmModalContent.style.display = 'block';

    unifiedModal.classList.add("show");

    confirmOkBtn.onclick = () => { unifiedModal.classList.remove("show"); onConfirm(); };

}



// ====== 事件监听 (合并) ======

function setupEventListeners() {

    console.log('setupEventListeners running', { confirmRedeemBtn, cancelRedeemBtn });



    // 多班级按钮

    backToClassSelectBtn.addEventListener('click', () => showClassMode(true));

    switchClassBtn.addEventListener('click', () => showClassMode(true));

    createClassConfirmBtn.addEventListener('click', handleCreateClass);



    saveStudentsBtn.addEventListener('click', () => { soundManager.init(); soundManager.playClick(); handleSaveStudents(); });

    enterGardenBtn.addEventListener('click', () => { soundManager.init(); soundManager.playClick(); showGameMode(); });

    if (manageStudentsBtn) {

        manageStudentsBtn.addEventListener('click', () => { soundManager.init(); soundManager.playClick(); showSetupMode(); });

    }

    undoBtn.addEventListener('click', () => { soundManager.init(); soundManager.playUndo(); handleUndo(); });

    if (classPasswordConfirmBtn) {

        classPasswordConfirmBtn.addEventListener('click', () => {

            soundManager.init();

            soundManager.playClick();

            confirmClassPassword();

        });

    }

    if (classPasswordCancelBtn) {

        classPasswordCancelBtn.addEventListener('click', () => {

            soundManager.init();

            soundManager.playClick();

            closeClassPasswordModal();

        });

    }

    if (classPasswordInput) {

        classPasswordInput.addEventListener('keydown', (e) => {

            if (e.key === 'Enter') {

                confirmClassPassword();

            }

        });

        classPasswordInput.addEventListener('input', () => {

            if (classPasswordError) {

                classPasswordError.style.display = 'none';

            }

        });

    }

    if (classPasswordModal) {

        classPasswordModal.addEventListener('click', (e) => {

            if (e.target === classPasswordModal) {

                closeClassPasswordModal();

            }

        });

    }

    document.addEventListener('keydown', (e) => {

        if (e.key === 'Escape' && classPasswordModal && classPasswordModal.classList.contains('show')) {

            closeClassPasswordModal();

        }

    });



    dailyGoal.addEventListener('input', () => {

        // 保存到当前班级

        if(currentClassId) {

            allClassData[currentClassId].dailyGoal = dailyGoal.value;

            saveAllClassData();

        }

    });



    // 统一弹窗

    document.querySelectorAll('.cancel-btn').forEach(btn => btn.addEventListener('click', (event) => {

        if (btn.classList.contains('close-redeem-modal')) return;

        const overlay = btn.closest('.modal-overlay');

        if (overlay) {

            overlay.classList.remove('show');

        }

        isProcessingClick = false; // ????????

    }));

    document.querySelectorAll('.modal-overlay').forEach(modal => modal.addEventListener('click', e => {

        if (e.target === modal) {

            modal.classList.remove('show');

            if (modal === redeemConfirmModal) {

                currentRedeemInfo.prizeId = null;

                if (wasRedeemModalOpenBeforeConfirm && redeemModalOverlay) {

                    redeemModalOverlay.classList.add('show');

                }

                wasRedeemModalOpenBeforeConfirm = false;

            }

            isProcessingClick = false; // ????????

        }

    }));

    if (redeemModalCloseBtn) {

        redeemModalCloseBtn.addEventListener('click', (event) => {

            event.preventDefault();

            event.stopImmediatePropagation();

            closeRedeemModal();

        });

    }

    if (cancelRedeemBtn && redeemConfirmModal) {

        cancelRedeemBtn.addEventListener('click', (event) => {

            event.preventDefault();

            event.stopImmediatePropagation();

            redeemConfirmModal.classList.remove('show');

            if (wasRedeemModalOpenBeforeConfirm && redeemModalOverlay) {

                redeemModalOverlay.classList.add('show');

            }

            wasRedeemModalOpenBeforeConfirm = false;

            currentRedeemInfo.prizeId = null;

            isProcessingClick = false;

        });

    }

    if (modalEnterGardenBtn) {

        modalEnterGardenBtn.addEventListener('click', () => { soundManager.init(); soundManager.playClick(); unifiedModal.classList.remove('show'); showGameMode(); });

    }



    // 核心功能按钮

    toggleSelectModeBtn.addEventListener('click', toggleSelectMode);

    selectAllBtn.addEventListener('click', handleSelectAll);

    waterSelectedBtn.addEventListener('click', handleBatchRecitation);

    confirmRollbackBtn.addEventListener('click', confirmRollback);

    confirmAddScoreBtn.addEventListener('click', confirmAddScore);

    exportDataBtn.addEventListener('click', handleExportData);

    importDataBtn.addEventListener('click', () => dataFileInput.click());

    dataFileInput.addEventListener('change', handleImportData);

    resetAllBtn.addEventListener('click', () => { 

        soundManager.init(); soundManager.playClick(); 

        resetConfirmText.textContent = `此操作将清空班级 "${allClassData[currentClassId].name}" 的所有学生、小组、商城和互动记录，且无法撤销！`;

        resetConfirmModal.classList.add('show');

    });

    confirmResetAllBtn.addEventListener('click', handleResetAll);



    // 视图切换

    showIndividualViewBtn.addEventListener('click', () => switchView('individual'));

    showGroupViewBtn.addEventListener('click', () => switchView('group'));

    showShopViewBtn.addEventListener('click', () => switchView('shop'));



    // 小组管理

    createGroupBtn.addEventListener('click', handleCreateGroup);

    individualSortSelect.addEventListener('change', () => renderIndividualView());

    groupSortSelect.addEventListener('change', () => renderGroupView());

    saveGroupMembersBtn.addEventListener('click', handleSaveChangesToGroup);

    confirmDeleteGroupBtn.addEventListener('click', confirmDeleteGroup);

    confirmPenaltyGroupBtn.addEventListener('click', confirmGroupPenalty);

    // CSV导入功能已移除，只支持Excel格式导入

    // �������������ģ̬���¼�������



    if (continueCurrentPetBtn) {



        continueCurrentPetBtn.addEventListener('click', () => {



            lv3GraduationModal.classList.remove('show');



        });



    }







    if (changePetBtn) {



        changePetBtn.addEventListener('click', () => {



            // ����¼�����showLv3GraduationAnimation������



        });



    }







    if (penaltyConfirmBtn) {



        penaltyConfirmBtn.addEventListener('click', () => {



            // ����¼�����showPenaltyConfirmModal����������



        });



    }







    // Ϊ�ͷ�ȷ��ģ̬���ȡ����ť�����¼�������



    if (penaltyConfirmModal) {



        penaltyConfirmModal.querySelector('.cancel-btn')?.addEventListener('click', () => {



            penaltyConfirmModal.classList.remove('show');



            isProcessingClick = false; // ���õ��״̬



        });



    }







    // Ϊ����ѡ��ģ̬���ȡ����ť�����¼�������



    if (petSelectionModal) {



        petSelectionModal.querySelector('.cancel-btn')?.addEventListener('click', () => {



            petSelectionModal.classList.remove('show');



            isProcessingClick = false; // ���õ��״̬



        });



    }







    // ����ɳ������¼�������



    if (saveGrowthSettingsBtn) {



        saveGrowthSettingsBtn.addEventListener('click', handleSaveGrowthSettings);



    }





    // 实时验证输入框

    level2ThresholdInput.addEventListener('input', function() {

        const value = parseInt(this.value);

        if (value % 4 !== 0 && value !== '') {

            this.style.borderColor = '#f44336';

        } else {

            this.style.borderColor = '#ddd';

        }

        // 自动调整LV3的最小值

        if (value && value >= parseInt(level3ThresholdInput.value)) {

            level3ThresholdInput.value = value + 4;

        }

    });



    level3ThresholdInput.addEventListener('input', function() {

        const value = parseInt(this.value);

        if (value % 4 !== 0 || value <= parseInt(level2ThresholdInput.value)) {

            this.style.borderColor = '#f44336';

        } else {

            this.style.borderColor = '#ddd';

        }

    });



    // 商城管理

    addPrizeBtn.addEventListener('click', handleAddPrize);

    if (confirmRedeemBtn) {

        confirmRedeemBtn.addEventListener('click', (event) => {

            console.log('confirmRedeemBtn click event', event);

            confirmRedeem();

        });

    } else {

        console.warn('confirmRedeemBtn not found when wiring events');

    }

}



function handleClassCardClick(classId) {

    const classData = allClassData[classId];

    if (!classData) return;



    if (!classData.password || !classData.password.trim()) {

        selectClass(classId);

        return;

    }



    if (!classPasswordModal || !classPasswordInput) {

        selectClass(classId);

        return;

    }



    pendingClassAccessId = classId;

    if (classPasswordTitle) {

        classPasswordTitle.textContent = `进入班级「${classData.name}」`;

    }

    if (classPasswordHint) {

        classPasswordHint.textContent = classData.password.trim()

            ? '请输入该班级的进入密码'

            : '该班级未设置密码（留空即可）';

    }

    classPasswordInput.value = '';

    classPasswordInput.placeholder = classData.password ? '请输入班级密码' : '当前未设置密码';

    setTimeout(() => classPasswordInput.focus(), 50);

    if (classPasswordError) {

        classPasswordError.style.display = 'none';

    }



    classPasswordModal.classList.add('show');

    classPasswordModal.removeAttribute('aria-hidden');

}



function closeClassPasswordModal() {

    pendingClassAccessId = null;

    if (classPasswordModal) {

        classPasswordModal.classList.remove('show');

        classPasswordModal.setAttribute('aria-hidden', 'true');

    }

    if (classPasswordError) {

        classPasswordError.style.display = 'none';

    }

    if (document.activeElement && classPasswordModal && classPasswordModal.contains(document.activeElement)) {

        document.activeElement.blur();

    }

}



async function confirmClassPassword() {

    if (!pendingClassAccessId) return;

    const targetId = pendingClassAccessId;

    const classData = allClassData[targetId];

    if (!classData) {

        closeClassPasswordModal();

        return;

    }

    if (!classPasswordModal || !classPasswordInput) {

        await selectClass(targetId);

        pendingClassAccessId = null;

        return;

    }

    const expected = (typeof classData.password === 'string' ? classData.password : '').trim();

    const entered = classPasswordInput.value.trim();

    if (entered === expected) {

        closeClassPasswordModal();

        await selectClass(targetId);

        pendingClassAccessId = null;

    } else if (classPasswordError) {

        classPasswordError.textContent = '密码错误，请重试';

        classPasswordError.style.display = 'block';

    }

}



// ====== 学生设置 (已适配多班级) ======

function handleSaveStudents() {

    console.log('🔧 开始保存学生...');

    console.log('🔧 当前currentClassId:', currentClassId);

    console.log('🔧 当前allClassData:', JSON.stringify(allClassData));



    const input = studentInput.value.trim();

    if (!input) return;

    const names = input.split(/[\n\s,，]+/).filter(name => name.trim() !== '');

    console.log('🔧 输入的学生名字:', names);



    // 获取当前班级的学生列表

    const currentStudents = allClassData[currentClassId].students;

    console.log('🔧 当前班级学生列表:', currentStudents);



    let newStudentAdded = false;



    names.forEach(name => {

        if (!currentStudents.some(s => s.name === name)) {

            currentStudents.push({

                id: createRandomId(),

                name: name,

                groupId: null,

                // 宠物相关字段

                currentPet: PET_TYPES[Math.floor(Math.random() * PET_TYPES.length)], // 自动随机分配宠物

                petLevel: "lv1", // 宠物初始等级

                recitationCount: 0, // 用作4状态循环：0(睡觉), 1(醒了), 2(吃东西), 3(玩耍)

                totalRecitations: 0, // 保留总活动次数

                collectedPlants: [], // 作为"爱心货币❤️"的钱包，将存储["❤️", "❤️", ...]

                collectedPets: [], // 新增：作为"宠物奖杯🐶"的收集册，存储["icon_dog_corgi", "icon_cat_black", ...]

                animatedBadges: [], // 新增：动画徽章收集册

                redeemedHistory: [] // 保持不变，用于记录商城兑换历史

            });

            newStudentAdded = true;

        }

    });

    if (newStudentAdded) {

        saveAllClassData(); // 保存所有班级数据

        studentInput.value = '';

        renderExistingStudents();

        renderGroupManagement();

        enterGardenBtn.style.display = 'inline-block';

        soundManager.playModalOpen();



        // 显示保存成功弹窗

        createClassModalContent.style.display = 'none';

        confirmModalContent.style.display = 'none';

        saveSuccessModalContent.style.display = 'block';

        unifiedModal.classList.add('show');



        actionHistory = [];

        undoBtn.disabled = true;

    } else {

        alert('您输入的名字均已存在。');

        studentInput.value = '';

    }

}



function renderExistingStudents() {

    console.log('🔧 renderExistingStudents 开始执行');

    existingStudents.innerHTML = '';



    // 使用与handleResetAll相同的数据访问方式

    let currentClass = null;

    if (currentClassId && allClassData[currentClassId]) {

        currentClass = allClassData[currentClassId];

    } else {

        const classIds = Object.keys(allClassData);

        if (classIds.length > 0) {

            currentClassId = classIds[0];

            currentClass = allClassData[currentClassId];

        }

    }



    const students = currentClass ? currentClass.students : [];

    console.log('🔧 找到学生数量:', students.length);





    students.forEach(student => {

        const studentItem = document.createElement('div');

        studentItem.className = 'student-item';

        studentItem.innerHTML = `<span class="student-name-editable" contenteditable="true" data-student-id="${student.id}">${student.name}</span><button class="delete-btn" data-student-id="${student.id}">删除</button>`;



        const nameSpan = studentItem.querySelector('.student-name-editable');

        nameSpan.addEventListener('blur', (e) => updateStudentName(student.id, e.target.textContent.trim()));

        nameSpan.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });



        studentItem.querySelector('.delete-btn').onclick = () => { soundManager.init(); soundManager.playDelete(); deleteStudent(student.id); };

        existingStudents.appendChild(studentItem);

    });

}



function deleteStudent(studentId) {

    const currentClass = allClassData[currentClassId];

    currentClass.students = currentClass.students.filter(s => s.id !== studentId);

    saveAllClassData();

    renderExistingStudents();

    renderGroupManagement();

    if (currentClass.students.length === 0) { enterGardenBtn.style.display = 'none'; }

    actionHistory = [];

    undoBtn.disabled = true;

}



function updateStudentName(studentId, newName) {

    const students = allClassData[currentClassId].students;

    const studentIndex = students.findIndex(s => s.id === studentId);

    if (studentIndex === -1) return;

    if (!newName) { alert("名字不能为空！"); renderExistingStudents(); return; }

    if (students.some(s => s.id !== studentId && s.name === newName)) { alert(`名字 "${newName}" 已存在！`); renderExistingStudents(); return; }



    if (students[studentIndex].name !== newName) {

        students[studentIndex].name = newName;

        saveAllClassData();

        soundManager.init(); soundManager.playClick();

        renderGroupManagement();

    }

}



// ====== 视图渲染 (已适配多班级) ======

function renderIndividualView() {

    const sortBy = individualSortSelect.value;

    const currentStudents = allClassData[currentClassId].students;

    let studentsToRender = [...currentStudents]; // 使用当前班级数据



    console.log('renderIndividualView - 渲染前的数据:');

    studentsToRender.forEach(s => {

        console.log(`  ${s.name}: recitationCount=${s.recitationCount}, petLevel=${s.petLevel}`);

    });



    switch (sortBy) {

        case 'score_desc':

            console.log('按分数降序排序');

            studentsToRender.sort((a, b) => (b.totalRecitations || 0) - (a.totalRecitations || 0));

            break;

        case 'score_asc':

            console.log('按分数升序排序');

            studentsToRender.sort((a, b) => (a.totalRecitations || 0) - (b.totalRecitations || 0));

            break;

        case 'name_asc':

            console.log('按姓名排序');

            studentsToRender.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

            break;

    }



    console.log('renderIndividualView - 排序后的数据:');

    studentsToRender.forEach(s => {

        console.log(`  ${s.name}: recitationCount=${s.recitationCount}, petLevel=${s.petLevel}`);

    });



    gardenGridIndividual.innerHTML = '';

    studentsToRender.forEach(student => {

        gardenGridIndividual.appendChild(createPetUnit(student));

    });

    initOrUpdateSortableIndividual(sortBy !== 'manual');

}



function renderGroupView() {

    const { students, groups } = allClassData[currentClassId]; // 使用当前班级数据

    const sortBy = groupSortSelect.value;

    let groupsToRender = groups.map(group => {

        const members = students.filter(s => s.groupId === group.id);

        const totalScore = members.reduce((sum, s) => sum + (s.totalRecitations || 0), 0);

        const avgScore = members.length > 0 ? totalScore / members.length : 0;

        return { ...group, totalScore, avgScore };

    });



    switch (sortBy) {

        case 'total_score_desc': groupsToRender.sort((a, b) => b.totalScore - a.totalScore); break;

        case 'avg_score_desc': groupsToRender.sort((a, b) => b.avgScore - a.avgScore); break;

        case 'name_asc': groupsToRender.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN')); break;

    }



    groupView.innerHTML = ''; 

    const sortControlsContainer = document.createElement('div');

    sortControlsContainer.className = 'sort-controls';

    sortControlsContainer.innerHTML = `<label for="group-sort-select-clone">小组排序：</label>`;

    const sortSelect = groupSortSelect.cloneNode(true);

    sortSelect.id = 'group-sort-select-clone';

    sortSelect.value = sortBy;

    sortSelect.addEventListener('change', (e) => {

        groupSortSelect.value = e.target.value;

        renderGroupView();

    });

    sortControlsContainer.appendChild(sortSelect);

    groupView.appendChild(sortControlsContainer);



    groupsToRender.forEach(group => {

        const groupContainer = document.createElement('div');

        groupContainer.className = 'group-container';

        const members = students.filter(s => s.groupId === group.id);

        groupContainer.innerHTML = `

            <div class="group-header">

                <div>

                    <h3>${group.name}</h3>

                    <div class="group-stats">总分: <strong>${group.totalScore}</strong> | 成员: ${members.length} | 均分: ${group.avgScore.toFixed(2)}</div>

                </div>

                <div class="group-actions">

                    <button class="group-water-btn" data-group-id="${group.id}">本组互动</button>

                    <button class="group-penalty-btn" data-group-id="${group.id}">本组扣分</button>

                </div>

            </div>

            <div class="group-grid" id="group-grid-${group.id}"></div>`;

        const groupGrid = groupContainer.querySelector('.group-grid');

        members.forEach(member => groupGrid.appendChild(createPetUnit(member)));

        groupContainer.querySelector('.group-water-btn').onclick = (e) => handleGroupBatchWater(e.target.dataset.groupId);

        groupContainer.querySelector('.group-penalty-btn').onclick = (e) => handleGroupPenalty(e.target.dataset.groupId);

        groupView.appendChild(groupContainer);

    });

}



// <-- ********** 修改：createPetUnit 函数已更新 ********** -->

function createPetUnit(student) {

    // 使用规范化函数确保collectedPlants数据正确

    student.collectedPlants = normalizeCollectedPlants(student.collectedPlants, student.totalRecitations || 0);



    const petUnit = document.createElement('div');

    petUnit.className = 'plant-unit';

    petUnit.id = `plant-unit-${student.id}`;

    petUnit.dataset.studentId = student.id;



    if (isSelectMode && selectedStudentIds.has(student.id)) petUnit.classList.add('selected');



    // 宠物主图：根据4状态循环生成图片

    // 如果recitationCount是-1，显示睡觉状态

    let state;

    if (student.recitationCount === -1) {

        state = 'sleep';

        console.log('检测到recitationCount = -1，强制显示sleep状态');

    } else {

        state = PET_STATES[student.recitationCount] || 'sleep';

    }

    const level = student.petLevel || 'lv1';

    const pet = student.currentPet || 'cat_orange';

    const petImageSrc = getPetAsset(pet, level, state);



    const heartsCount = student.collectedPlants ? student.collectedPlants.length : 0;

    console.log('渲染学生:', student.name, '状态计数:', student.recitationCount, '状态:', state, '爱心数:', heartsCount);



    // 创建HTML后立即检查内容

    const tempHtml = `

        <div class="action-buttons">

            <button class="manual-action-btn add-score-btn"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg></button>

            <button class="manual-action-btn rollback-btn"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>

            <button class="manual-action-btn change-pet-btn" title="更换宠物">🔄</button>

        </div>

        <div class="plant-container">

            <img class="pet-image" src="${petImageSrc}">

        </div>



        <!-- NEW NAME & LEVEL BUTTON -->

        <button class="student-button">

            <span class="student-name">${student.name}</span>

            <span class="level-tag">${level.toUpperCase()}</span>

        </button>



        <!-- NEW STATS BAR -->

        <div class="stats-bar">

            <div class="hearts-count">

                <svg class="heart-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#e91e63" viewBox="0 0 16 16">

                    <path fill-rule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z"/>

                </svg>

                <span>${heartsCount}</span>

            </div>

            <div class="animated-badges-container">${renderAnimatedBadges(student)}</div>

        </div>`;



    if (student.name === '林语涵') {

        console.log('林语涵的HTML模板:', tempHtml);

    }



    // REVISED HTML STRUCTURE

    petUnit.innerHTML = `

        <div class="action-buttons">

            <button class="manual-action-btn add-score-btn"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg></button>

            <button class="manual-action-btn rollback-btn"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>

            <button class="manual-action-btn change-pet-btn" title="更换宠物">🔄</button>

        </div>

        <div class="plant-container">

            <img class="pet-image" src="${petImageSrc}">

        </div>



        <!-- NEW NAME & LEVEL BUTTON -->

        <button class="student-button">

            <span class="student-name">${student.name}</span>

            <span class="level-tag">${level.toUpperCase()}</span>

        </button>



        <!-- NEW STATS BAR -->

        <div class="stats-bar">

            <div class="hearts-count">

                <svg class="heart-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#e91e63" viewBox="0 0 16 16">

                    <path fill-rule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z"/>

                </svg>

                <span>${heartsCount}</span>

            </div>

            <div class="animated-badges-container">${renderAnimatedBadges(student)}</div>

        </div>`;



    petUnit.querySelector('.student-button').onclick = (e) => {

        if (isSelectMode) { e.preventDefault(); toggleStudentSelection(student.id, e.currentTarget.closest('.plant-unit')); }

        else { handleRecitation(student.id, e.currentTarget.closest('.plant-unit')); }

    };

    petUnit.querySelector('.add-score-btn').onclick = (e) => { e.stopPropagation(); handleManualAddScore(student.id); };

    petUnit.querySelector('.rollback-btn').onclick = (e) => { e.stopPropagation(); handleManualRollback(student.id); };

    petUnit.querySelector('.change-pet-btn').onclick = (e) => { e.stopPropagation(); handlePenaltyChange(student.id); };

    return petUnit;

}

// <-- ********** createPetUnit 函数修改结束 ********** -->



// 新增：渲染动画徽章函数

function renderAnimatedBadges(student) {

    if (!student.animatedBadges || student.animatedBadges.length === 0) {

        return '';

    }



    return student.animatedBadges.map((badge, index) => {

        const petInfo = petLibrary[badge.petType];

        if (petInfo) {

            return `<div class="animated-badge" title="${petInfo.name} LV3毕业徽章" style="animation-delay: ${index * 0.2}s;">

                <img src="${petInfo.iconImage}" alt="${petInfo.name}" style="width: 30px; height: 30px; object-fit: cover; border-radius: 50%; border: 2px solid #ffc107; box-shadow: 0 2px 6px rgba(255, 193, 7, 0.4);">

                <div class="badge-glow"></div>

            </div>`;

        }

        return '';

    }).join('');

}



// ====== 核心游戏逻辑 (已适配多班级) ======

function handleRecitation(studentId, plantUnit) {

    const students = allClassData[currentClassId].students;

    const studentIndex = students.findIndex(s => s.id === studentId);

    if (studentIndex === -1) return;

    actionHistory.push(JSON.parse(JSON.stringify(allClassData[currentClassId]))); // 保存当前班级状态

    undoBtn.disabled = false;



    const student = students[studentIndex];

    plantUnit.querySelector('.student-button').disabled = true;



    setTimeout(() => {

        soundManager.playMagicGrow();

        showMagicParticles(plantUnit.querySelector('.plant-container'));



        // 新机制：每次点击直接给一颗爱心

        if (!Array.isArray(student.collectedPlants)) student.collectedPlants = [];

        student.collectedPlants.push("❤️");

        console.log('添加爱心，新总数:', student.collectedPlants.length);



        // 更新点击计数（用于宠物状态循环）

        const oldCount = student.recitationCount;

        console.log('点击前状态:', {

            oldCount: oldCount,

            totalRecitations: student.totalRecitations,

            petLevel: student.petLevel

        });



        // 先计算新状态，再更新数据

        let newCount;

        if (student.justContinuedPet) {

            // 如果是刚继续养，从-1开始计算

            newCount = (student.recitationCount + 1) % 4;

            console.log('🎯 检测到刚继续养，从-1开始计算:', student.name, 'recitationCount:', student.recitationCount, '→', newCount);

        } else {

            // 正常情况

            newCount = (student.recitationCount + 1) % 4;

            console.log('🎯 正常点击计算:', student.name, 'recitationCount:', student.recitationCount, '→', newCount);

        }

        const newState = PET_STATES[newCount];



        console.log('🎯 计算结果:', {

            name: student.name,

            justContinuedPet: student.justContinuedPet,

            oldCount: oldCount,

            newCount: newCount,

            newState: newState

        });



        student.recitationCount = newCount;

        student.totalRecitations = (student.totalRecitations || 0) + 1;



        console.log('数据更新后:', {

            recitationCount: student.recitationCount,

            totalRecitations: student.totalRecitations

        });

        console.log('宠物状态循环:', oldCount, '→', student.recitationCount, '=>', newState);



        // 播放爱心喂养动画 - 使用统一的爱心动效函数

        soundManager.playHarvest();



        // 使用与多选相同的爱心动效函数

        createHeartAnimation(plantUnit, studentId);



        // 检查升级和LV3相关逻辑

        handleRewardAndCheck(studentId);



        // LV3状态下，每次状态改变都调用循环函数

        if (student.petLevel === "lv3") {

            // 清除刚进入LV3的标记（第一次点击后）

            student.justEnteredLV3 = false;

            // 如果是刚继续养后的第一次点击，清除继续养标记

            if (student.justContinuedPet) {

                console.log('刚继续养后的第一次点击，清除继续养标记');

                student.justContinuedPet = false;

            }

            handleLv3CycleComplete(studentId);

        }



        // 立即更新当前单元的爱心显示

        const heartsSpan = plantUnit.querySelector('.hearts-count span');

        if (heartsSpan) {

            heartsSpan.textContent = student.collectedPlants.length;

            console.log('直接更新爱心显示为:', student.collectedPlants.length);

        }



        // 立即更新宠物图片 - 修复版

        const petImage = plantUnit.querySelector('.pet-image');

        if (petImage) {

            let actualState;



            // 只有第一次点击（从-1到0）才强制显示sleep

            if (oldCount === -1) {

                actualState = 'sleep';

                console.log('第一次点击（从-1到0）：强制显示sleep');

            } else {

                // 后续点击使用正常计算的状态

                actualState = PET_STATES[student.recitationCount] || 'sleep';

                console.log('后续点击：使用计算的状态', actualState);

            }



            const level = student.petLevel || 'lv1';

            const pet = student.currentPet || 'cat_orange';

            const newPetImageSrc = getPetAsset(pet, level, actualState);



            console.log('修复版更新：', {

                oldCount: oldCount,

                newCount: student.recitationCount,

                actualState: actualState,

                imageSrc: newPetImageSrc

            });



            petImage.src = newPetImageSrc;

        }



        // 立即更新等级标签

        const levelTag = plantUnit.querySelector('.level-tag');

        if (levelTag) {

            levelTag.textContent = (student.petLevel || 'lv1').toUpperCase();

            console.log('更新等级标签为:', (student.petLevel || 'lv1').toUpperCase());

        }



        // 立即重新启用按钮

        const button = plantUnit.querySelector('.student-button');

        if (button) {

            button.disabled = false;

        }



        saveAllClassData(); // 保存

        setTimeout(() => {

            // 刷新当前视图

            const currentView = document.getElementById('individual-view').style.display !== 'none' ? 'individual' : (document.getElementById('group-view').style.display !== 'none' ? 'group' : 'shop');

            if (currentView === 'individual') renderIndividualView();

            else if (currentView === 'group') renderGroupView();

            else if (currentView === 'shop') renderShopView(); // 刷新商城

        }, 4500); // 延长刷新时间，确保爱心动画完成后再刷新

    }, 300); // 缩短动效时间为300毫秒

}



// 新增：奖励和升级检查函数

/**
 * 处理 LV2/LV3 升级逻辑，基于更换后产生的有效爱心数量判断。
 */
function handleRewardAndCheck(studentId) {

    const student = allClassData[currentClassId].students.find(s => s.id === studentId);
    if (!student) return;
    if (!Array.isArray(student.collectedPlants)) student.collectedPlants = [];

    const totalCollected = student.collectedPlants.length;
    const totalSpent = (student.redeemedHistory || []).reduce((sum, item) => sum + item.cost, 0);
    const availableHearts = Math.max(0, totalCollected - totalSpent);

    console.log('当前数量:', totalCollected, '可用爱心:', availableHearts, '当前等级:', student.petLevel, 'LV2门槛:', PET_LEVEL_2_THRESHOLD, 'LV3门槛:', PET_LEVEL_3_THRESHOLD);

    if (availableHearts >= PET_LEVEL_3_THRESHOLD && student.petLevel !== "lv3") {
        console.log('升级到LV3!');
        student.petLevel = "lv3";
        student.recitationCount = 0;
        student.justEnteredLV3 = true;
        handleLv3Graduation(studentId);
        soundManager.playMagicGrow();
        return;
    }

    if (availableHearts >= PET_LEVEL_2_THRESHOLD && student.petLevel === "lv1") {
        console.log('升级到LV2!');
        student.petLevel = "lv2";
        soundManager.playMagicGrow();
    }
}

function handleLv3CycleComplete(studentId) {

    const student = allClassData[currentClassId].students.find(s => s.id === studentId);

    if (!student || student.petLevel !== "lv3") return;



    console.log('LV3状态循环完成:', student.name, '当前状态:', student.recitationCount);



    // 检查这个宠物是否已经获得过徽章

    const alreadyHasBadge = student.animatedBadges &&

        student.animatedBadges.some(badge => badge.petType === student.currentPet);



    // 如果还没有徽章，在第一次从睡觉状态循环到"玩耍"状态时发放徽章

    // 确保是完成了一个完整的LV3循环，而不是刚进入LV3

    if (!alreadyHasBadge && student.recitationCount === 3 && !student.justEnteredLV3) {

        console.log('第一次完成LV3循环到玩耍状态，发放徽章!');

        setTimeout(() => handleLv3Graduation(studentId), 500);

    }

    // 如果已经有徽章，只在"玩耍"状态（recitationCount = 3）时询问是否更换宠物

    else if (alreadyHasBadge && student.recitationCount === 3) {

        console.log('LV3玩耍状态，询问是否更换宠物');

        setTimeout(() => showPetChangeDialog(studentId), 500);

    }

}



// 新增：宠物徽章获得处理函数

function handleLv3Graduation(studentId) {

    const student = allClassData[currentClassId].students.find(s => s.id === studentId);

    if (!student) return;



    // 第一次达到12个爱心，获得徽章

    const animatedBadge = {

        petType: student.currentPet,

        petName: petLibrary[student.currentPet]?.name || '宠物',

        earnedAt: new Date().toISOString(),

        badgeId: createRandomId()

    };



    // 添加到动画徽章收集册

    if (!Array.isArray(student.animatedBadges)) student.animatedBadges = [];

    student.animatedBadges.push(animatedBadge);



    // 显示获得徽章的动画

    showLv3GraduationAnimation(studentId, animatedBadge, true);

}



// 新增：显示LV3毕业动画

function showLv3GraduationAnimation(studentId, badge, isFirstTime = false) {

    const student = allClassData[currentClassId].students.find(s => s.id === studentId);

    if (!student) return;



    const petName = badge.petName;

    const petInfo = petLibrary[badge.petType];



    // 设置毕业模态框内容

    if (isFirstTime) {

        lv3GraduationMessage.innerHTML = `恭喜${student.name}<br>你的${petName}已成功养大！<br>获得宠物徽章一枚`;

        // 显示获得的徽章

        lv3GraduationBadge.innerHTML = `

            <div style="text-align: center;">

                <img src="${petInfo.iconImage}" alt="${petName}"

                     style="width: 100px; height: 100px; object-fit: cover; border-radius: 50%;

                            border: 4px solid #ffc107; box-shadow: 0 6px 20px rgba(255, 193, 7, 0.5);">

                <div style="margin-top: 15px; font-weight: bold; color: #f57c00; font-size: 1.1rem;">${petName}</div>

            </div>

        `;



        // 显示两个按钮

        document.getElementById('continue-current-pet-btn').style.display = 'inline-block';

        document.getElementById('change-pet-btn').style.display = 'inline-block';

    } else {

        lv3GraduationMessage.innerHTML = `${student.name}<br>你的${petName}<br>已经获得过徽章了`;

        // 显示已获得的徽章

        lv3GraduationBadge.innerHTML = `

            <div style="text-align: center;">

                <img src="${petInfo.iconImage}" alt="${petName}"

                     style="width: 80px; height: 80px; object-fit: cover; border-radius: 50%;

                            border: 2px solid #ddd; opacity: 0.8;">

                <div style="margin-top: 10px; font-weight: bold; color: #666; font-size: 1rem;">${petName}</div>

                <div style="color: #999; font-size: 0.9rem;">已获得徽章</div>

            </div>

        `;



        // 只显示换宠物按钮

        document.getElementById('continue-current-pet-btn').style.display = 'none';

        document.getElementById('change-pet-btn').style.display = 'inline-block';

        document.getElementById('change-pet-btn').textContent = '换宠物';

    }



    // 显示毕业模态框

    lv3GraduationModal.classList.add('show');



    // 播放特殊音效

    soundManager.playMagicGrow();



    // 设置按钮事件

    continueCurrentPetBtn.onclick = () => {

        lv3GraduationModal.classList.remove('show');

        // 重新获取学生对象以确保数据是最新的

        const currentStudent = allClassData[currentClassId].students.find(s => s.id === studentId);

        if (currentStudent) {

            // 继续培养当前宠物，确保保持LV3状态并重置状态循环为睡觉状态

            currentStudent.petLevel = "lv3"; // 确保保持在LV3状态

            currentStudent.recitationCount = -1; // 每次继续养都设置为-1，确保从睡觉开始

            currentStudent.justContinuedPet = true; // 标记刚继续养

            console.log('🎯 继续养强制重置:', currentStudent.name, 'recitationCount =', currentStudent.recitationCount);

            console.log('🎯 继续养设置完成:', {

                name: currentStudent.name,

                petLevel: currentStudent.petLevel,

                recitationCount: currentStudent.recitationCount,

                justContinuedPet: currentStudent.justContinuedPet

            });

            saveAllClassData();

            console.log('🎯 数据已保存');



            // 验证保存的数据

            const savedStudent = allClassData[currentClassId].students.find(s => s.id === studentId);

            console.log('🎯 保存后验证数据:', {

                name: savedStudent.name,

                recitationCount: savedStudent.recitationCount,

                petLevel: savedStudent.petLevel,

                justContinuedPet: savedStudent.justContinuedPet

            });



            // 立即更新宠物图片为sleep状态

            setTimeout(() => {

                const plantUnit = document.querySelector(`[data-student-id="${studentId}"]`);

                if (plantUnit) {

                    const petImage = plantUnit.querySelector('.pet-image');

                    if (petImage) {

                        const pet = savedStudent.currentPet || 'cat_orange';

                        const newPetImageSrc = getPetAsset(pet, 'lv3', 'sleep');

                        petImage.src = newPetImageSrc;

                        console.log('🎯 立即更新宠物图片为sleep状态:', newPetImageSrc);

                    }

                }

            }, 100);

        }



        // 直接更新单个宠物单元，避免重新渲染整个视图

        setTimeout(() => {

            console.log('开始更新单个宠物单元');

            const verifyStudent = allClassData[currentClassId].students.find(s => s.id === studentId);

            console.log('更新前验证:', JSON.stringify({

                name: verifyStudent.name,

                recitationCount: verifyStudent.recitationCount,

                petLevel: verifyStudent.petLevel

            }));



            // 找到现有的宠物单元并更新

            const existingUnit = document.getElementById(`plant-unit-${studentId}`);

            if (existingUnit) {

                console.log('找到现有宠物单元，直接更新内容');

                // 创建新的宠物单元替换现有的

                const newUnit = createPetUnit(verifyStudent);

                existingUnit.parentNode.replaceChild(newUnit, existingUnit);

            } else {

                console.log('未找到现有宠物单元，重新渲染视图');

                renderIndividualView();

            }

        }, 100);

    };



    changePetBtn.onclick = () => {
        lv3GraduationModal.classList.remove('show');
        const student = allClassData[currentClassId].students.find(s => s.id === studentId);
        if (student) {
            student.recitationCount = 0;
            student.totalRecitations = 0;
            student.petLevel = 'lv1';
            student.justEnteredLV3 = false;
            student.justContinuedPet = false;
            saveAllClassData();
        }
        // 更换宠物时清空状态
        showPetSelectionModal(studentId, false);
    };

    // 刷新视图显示新徽章

    const currentView = document.getElementById('individual-view').style.display !== 'none' ? 'individual' : 'group';

    if (currentView === 'individual') renderIndividualView();

    else if (currentView === 'group') renderGroupView();

}



// 新增：显示宠物更换询问对话框

function showPetChangeDialog(studentId) {

    const student = allClassData[currentClassId].students.find(s => s.id === studentId);

    if (!student) return;



    const petName = petLibrary[student.currentPet]?.name || '宠物';



    // 创建一个临时的询问对话框

    const dialogDiv = document.createElement('div');

    dialogDiv.style.cssText = `

        position: fixed;

        top: 50%;

        left: 50%;

        transform: translate(-50%, -50%);

        background: white;

        padding: 30px;

        border-radius: 15px;

        box-shadow: 0 10px 30px rgba(0,0,0,0.3);

        z-index: 10000;

        text-align: center;

        font-size: 1.1rem;

        min-width: 300px;

    `;



    dialogDiv.innerHTML = `

        <div style="margin-bottom: 15px; font-weight: bold; color: #333;">

            ${student.name}

        </div>

        <div style="margin-bottom: 10px; color: #666;">

            你的${petName}

        </div>

        <div style="margin-bottom: 20px; color: #666;">

            已经获得了徽章

        </div>

        <div style="margin-bottom: 20px; color: #666;">

            是否要更换宠物？

        </div>

        <div style="margin-top: 20px;">

            <button id="keep-pet-btn" style="background-color: #4caf50; color: white; padding: 10px 20px; margin: 0 10px; border-radius: 8px; border: none; cursor: pointer;">

                继续养

            </button>

            <button id="change-pet-dialog-btn" style="background-color: #ff9800; color: white; padding: 10px 20px; margin: 0 10px; border-radius: 8px; border: none; cursor: pointer;">

                换宠物

            </button>

        </div>

    `;



    document.body.appendChild(dialogDiv);



    // 设置按钮事件

    document.getElementById('keep-pet-btn').onclick = () => {

        document.body.removeChild(dialogDiv);

        // 重新获取学生对象以确保数据是最新的

        const currentStudent = allClassData[currentClassId].students.find(s => s.id === studentId);

        if (currentStudent) {

            // 继续养，确保保持LV3状态并重置为睡觉状态

            currentStudent.petLevel = "lv3"; // 确保保持在LV3状态

            currentStudent.recitationCount = 0;

            saveAllClassData();

        }

        renderIndividualView();

    };



    document.getElementById('change-pet-dialog-btn').onclick = () => {

        document.body.removeChild(dialogDiv);

        // 正常收集徽章后换宠物，不清零爱心

        showPetSelectionModal(studentId, false);

    };



    // 点击背景关闭

    dialogDiv.addEventListener('click', (e) => {

        if (e.target === dialogDiv) {

            document.body.removeChild(dialogDiv);

        }

    });

}



// 新增：显示宠物选择模态框函数

function showPetSelectionModal(studentId, shouldResetHearts = false) {

    const student = allClassData[currentClassId].students.find(s => s.id === studentId);

    if (!student) return;



    petSelectionMessage.textContent = `${student.name}，请选择你的新宠物：`;



    // 生成所有宠物选项

    petSelectionList.innerHTML = '';

    PET_TYPES.forEach(pet => {

        const petInfo = petLibrary[pet];

        if (petInfo) {

            const petOption = document.createElement('div');

            petOption.style.cssText = `

                text-align: center; cursor: pointer; padding: 15px;

                border: 2px solid #ddd; border-radius: 12px; transition: all 0.3s;

                background: white; width: calc(50% - 8px); min-width: 120px; box-sizing: border-box;

            `;



            petOption.innerHTML = `

                <img src="${petInfo.iconImage}" alt="${petInfo.name}"

                     style="width: 60px; height: 60px; object-fit: cover; border-radius: 50%; margin-bottom: 8px;">

                <div style="font-size: 0.9rem; color: #333; font-weight: bold;">${petInfo.name}</div>

            `;



            petOption.onclick = () => {

                // 更换宠物

                student.currentPet = pet;



                // 只有手动更换宠物才清空爱心

                if (shouldResetHearts) {

                    student.collectedPlants = []; // 清空爱心货币

                    console.log('🔄 手动更换宠物，清空爱心');

                } else {

                    console.log('🎓 正常更换宠物，保留爱心数:', student.collectedPlants?.length || 0);

                }



                student.petLevel = "lv1";

                student.recitationCount = 0;

                saveAllClassData();

                petSelectionModal.classList.remove('show');

                renderIndividualView();

            };



            petOption.onmouseover = () => {

                petOption.style.borderColor = '#ff9800';

                petOption.style.boxShadow = '0 4px 12px rgba(255, 152, 0, 0.2)';

                petOption.style.transform = 'translateY(-2px)';

            };



            petOption.onmouseout = () => {

                petOption.style.borderColor = '#ddd';

                petOption.style.boxShadow = 'none';

                petOption.style.transform = 'translateY(0)';

            };



            petSelectionList.appendChild(petOption);

        }

    });



    petSelectionModal.classList.add('show');



    // 设置取消按钮事件

    petSelectionModal.querySelector('.cancel-btn').onclick = () => {

        petSelectionModal.classList.remove('show');

    };

}



// 新增：显示惩罚确认模态框函数

function showPenaltyConfirmModal(studentId) {

    console.log('🔧 显示惩罚确认模态框，studentId:', studentId);

    penaltyConfirmModal.classList.add('show');

    console.log('🔧 模态框已显示，penaltyConfirmModal:', penaltyConfirmModal);

    console.log('🔧 确认按钮:', penaltyConfirmBtn);



    // 设置确认按钮事件

    penaltyConfirmBtn.onclick = () => {

        console.log('🔧 确认按钮被点击了！');

        penaltyConfirmModal.classList.remove('show');

        const student = allClassData[currentClassId].students.find(s => s.id === studentId);

        if (student) {

            console.log('🔧 开始更换宠物，学生:', student.name);

            // 手动更换宠物，清零爱心

            console.log('🔄 手动更换宠物，清空爱心并重置状态');

            student.collectedPlants = []; // 清空爱心货币

            student.petLevel = "lv1";

            student.recitationCount = 0;

            saveAllClassData();

            console.log('🔧 数据已保存，显示宠物选择界面');

            showPetSelectionModal(studentId, false); // 爱心已经清零，不需要再次清零

        } else {

            console.log('🔧 错误：找不到学生，studentId:', studentId);

        }

    };

}



// 新增：宠物更换处理函数（右上角按钮）

function handlePenaltyChange(studentId) {

    console.log('🔧 右上角更换宠物按钮被点击，studentId:', studentId);

    // 右上角按钮总是走惩罚流程，显示确认模态框

    showPenaltyConfirmModal(studentId);

}



function handleManualRollback(studentId) { 

    soundManager.init(); soundManager.playClick(); 

    const student = allClassData[currentClassId].students.find(s => s.id === studentId); 

    if (!student) return; 

    studentIdForManualAction = studentId; 

    rollbackStudentName.textContent = student.name; 

    rollbackStepsInput.value = 1; 

    rollbackModal.classList.add('show'); 

    rollbackStepsInput.focus(); 

}

function handleManualAddScore(studentId) { 

    soundManager.init(); soundManager.playClick(); 

    const student = allClassData[currentClassId].students.find(s => s.id === studentId); 

    if (!student) return; 

    studentIdForManualAction = studentId; 

    addScoreStudentName.textContent = student.name; 

    addScoreStepsInput.value = 1; 

    addScoreModal.classList.add('show'); 

    addScoreStepsInput.focus(); 

}



function confirmRollback() {

    const steps = parseInt(rollbackStepsInput.value);

    if (!studentIdForManualAction || isNaN(steps) || steps <= 0) return;

    const student = allClassData[currentClassId].students.find(s => s.id === studentIdForManualAction);

    if (!student) return;



    // 新机制：检查爱心数量是否足够退回

    const currentHearts = Array.isArray(student.collectedPlants) ? student.collectedPlants.length : 0;

    if (steps > currentHearts) { alert("退回次数无效，爱心数量不足。"); return; }



    actionHistory.push(JSON.parse(JSON.stringify(allClassData[currentClassId])));

    undoBtn.disabled = false;



    // 新机制：直接扣除相应的爱心数量

    const removeCount = Math.min(steps, currentHearts);

    student.collectedPlants.splice(-removeCount, removeCount);



    // 更新点击计数

    student.totalRecitations = Math.max(0, (student.totalRecitations || 0) - steps);

    student.recitationCount = student.totalRecitations % 4;



    // 重新计算宠物等级

    if (student.collectedPlants.length < PET_LEVEL_2_THRESHOLD) {

        student.petLevel = "lv1";

    } else if (student.collectedPlants.length < PET_LEVEL_3_THRESHOLD) {

        student.petLevel = "lv2";

    } else {

        student.petLevel = "lv3";

    }



    saveAllClassData();

    const currentView = document.getElementById('individual-view').style.display !== 'none' ? 'individual' : (document.getElementById('group-view').style.display !== 'none' ? 'group' : 'shop');

    if (currentView === 'individual') renderIndividualView();

    else if (currentView === 'group') renderGroupView();

    else if (currentView === 'shop') renderShopView();



    rollbackModal.classList.remove('show');

    studentIdForManualAction = null;

}



function confirmAddScore() {

    const steps = parseInt(addScoreStepsInput.value);

    if (!studentIdForManualAction || isNaN(steps) || steps <= 0) return;

    const student = allClassData[currentClassId].students.find(s => s.id === studentIdForManualAction);

    if (!student) return;



    actionHistory.push(JSON.parse(JSON.stringify(allClassData[currentClassId])));

    undoBtn.disabled = false;



    // 新机制：每次加分直接给相应的爱心数量

    if (!Array.isArray(student.collectedPlants)) student.collectedPlants = [];

    for (let i = 0; i < steps; i++) {

        student.collectedPlants.push("❤️");

    }



    // 更新点击计数（用于宠物状态循环）

    student.totalRecitations = (student.totalRecitations || 0) + steps;

    // 只有在不是刚继续养的情况下才重新计算recitationCount

    if (!student.justContinuedPet) {

        student.recitationCount = student.totalRecitations % 4;

    } else {

        // 如果是刚继续养，从-1开始计算

        student.recitationCount = (student.recitationCount + 1) % 4;

    }



    // 检查升级和LV3相关逻辑

    handleRewardAndCheck(studentIdForManualAction);



    // LV3状态下，每次状态改变都调用循环函数

    if (student.petLevel === "lv3") {

        // 如果是刚继续养后的第一次点击，清除继续养标记

        if (student.justContinuedPet) {

            console.log('手动加分：刚继续养后的第一次点击，清除继续养标记');

            student.justContinuedPet = false;

        }

        handleLv3CycleComplete(studentIdForManualAction);

    }



    saveAllClassData();



    const currentView = document.getElementById('individual-view').style.display !== 'none' ? 'individual' : (document.getElementById('group-view').style.display !== 'none' ? 'group' : 'shop');

    if (currentView === 'individual') renderIndividualView();

    else if (currentView === 'group') renderGroupView();

    else if (currentView === 'shop') renderShopView();



    addScoreModal.classList.remove('show');

    studentIdForManualAction = null;

}



// 数据规范化函数：确保collectedPlants始终是有效的字符串数组

function normalizeCollectedPlants(collectedPlants, totalRecitations = 0) {

    if (!collectedPlants) {

        // 如果collectedPlants为空，根据totalRecitations计算

        const hearts = [];

        for (let i = 0; i < Math.floor(totalRecitations / 4); i++) {

            hearts.push("❤️");

        }

        return hearts;

    }



    if (Array.isArray(collectedPlants)) {

        // 如果是数组，过滤掉空的和无效的元素

        return collectedPlants.filter(item => item != null && item !== '');

    }



    if (typeof collectedPlants === 'string') {

        // 新增：处理JSON格式的数组字符串（Excel导出的格式）

        const trimmedString = collectedPlants.trim();

        if (trimmedString.startsWith('[') && trimmedString.endsWith(']')) {

            try {

                const parsedArray = JSON.parse(trimmedString);

                if (Array.isArray(parsedArray)) {

                    console.log('🔄 成功解析JSON数组:', trimmedString, '->', parsedArray);

                    return parsedArray.filter(item => item != null && item !== '');

                }

            } catch (e) {

                console.warn('JSON解析失败，尝试其他方法:', e, '原始数据:', trimmedString);

            }

        }



        // 原有的字符串分割逻辑（保持兼容性）

        if (collectedPlants.includes(',')) {

            return collectedPlants.split(',').filter(item => item.trim()).map(item => item.trim());

        } else if (collectedPlants.includes(';')) {

            return collectedPlants.split(';').filter(item => item.trim()).map(item => item.trim());

        } else {

            // 单个字符串

            return collectedPlants.trim() ? [collectedPlants] : [];

        }

    }



    // 其他情况返回空数组

    return [];

}



// 保持原版的计算逻辑

function getPlantStateFromTotal(total) {

    let tempPlants = [];

    const plantTypes = Object.keys(plantLibrary);

    let currentPlant = plantTypes[0]; 

    let recitationCount = 0;



    if (total > 0) {

        let currentSimulatedPlant = plantTypes[0];

        let simulatedRecitationCount = 0;



        for (let i = 1; i <= total; i++) {

            simulatedRecitationCount++;

            if (simulatedRecitationCount === 4) {

                tempPlants.push(currentSimulatedPlant);

            }

            if (simulatedRecitationCount >= 5) {

                simulatedRecitationCount = 0;

                const roundSize = plantTypes.length;

                let numInCurrentRound = tempPlants.length % roundSize;

                if (numInCurrentRound === 0 && tempPlants.length > 0) numInCurrentRound = roundSize;

                const plantsInCurrentRound = tempPlants.slice(-numInCurrentRound);

                let uncollectedInRound = plantTypes.filter(type => !plantsInCurrentRound.includes(type));

                if (uncollectedInRound.length === 0) uncollectedInRound = plantTypes;

                currentSimulatedPlant = uncollectedInRound[Math.floor(Math.random() * uncollectedInRound.length)];

            }

        }

        currentPlant = currentSimulatedPlant;

        recitationCount = simulatedRecitationCount;

         if (total <= 4) {

            recitationCount = total;

            if (total === 4) { 

                 const roundSize = plantTypes.length;

                 let numInCurrentRound = tempPlants.length % roundSize;

                 if (numInCurrentRound === 0 && tempPlants.length > 0) numInCurrentRound = roundSize;

                 const plantsInCurrentRound = tempPlants.slice(-numInCurrentRound);

                 let uncollectedInRound = plantTypes.filter(type => !plantsInCurrentRound.includes(type));

                 if (uncollectedInRound.length === 0) uncollectedInRound = plantTypes;

                 currentPlant = uncollectedInRound[Math.floor(Math.random() * uncollectedInRound.length)];

                 recitationCount = 0; 

            } else if (total === 0) {

                 currentPlant = plantTypes[Math.floor(Math.random() * plantTypes.length)];

                 recitationCount = 0;

            } else {

                 recitationCount = total;

                 if (tempPlants.length > 0) {

                     const lastBadgePlant = tempPlants[tempPlants.length-1];

                     const roundSize = plantTypes.length;

                     let numInCurrentRound = tempPlants.length % roundSize;

                     if (numInCurrentRound === 0) numInCurrentRound = roundSize;

                     const plantsInCurrentRound = tempPlants.slice(-numInCurrentRound);

                     let uncollectedInRound = plantTypes.filter(type => !plantsInCurrentRound.includes(type));

                     if (uncollectedInRound.length === 0) uncollectedInRound = plantTypes;

                     currentPlant = uncollectedInRound[Math.floor(Math.random() * uncollectedInRound.length)];

                 } else {

                     currentPlant = plantTypes[Math.floor(Math.random() * plantTypes.length)];

                 }

            }

         } else { 

             recitationCount = (total - 1) % 5 + 1;

             if (recitationCount === 5) recitationCount = 0; 

             const roundSize = plantTypes.length;

             let numInCurrentRound = tempPlants.length % roundSize;

             if (numInCurrentRound === 0 && tempPlants.length > 0) numInCurrentRound = roundSize;

             const plantsInCurrentRound = tempPlants.slice(-numInCurrentRound);

             let uncollectedInRound = plantTypes.filter(type => !plantsInCurrentRound.includes(type));

             if (uncollectedInRound.length === 0) uncollectedInRound = plantTypes;

             currentPlant = uncollectedInRound[Math.floor(Math.random() * uncollectedInRound.length)];

         }

    } else { 

         currentPlant = plantTypes[Math.floor(Math.random() * plantTypes.length)];

         recitationCount = 0;

         tempPlants = [];

    }

    return { collectedPlants: tempPlants, currentPlant, recitationCount };

}



function handleUndo() {

    if (actionHistory.length === 0) return;

    allClassData[currentClassId] = actionHistory.pop(); // 恢复当前班级的数据

    saveAllClassData();

    const currentView = document.getElementById('individual-view').style.display !== 'none' ? 'individual' : (document.getElementById('group-view').style.display !== 'none' ? 'group' : 'shop');

    if (currentView === 'individual') renderIndividualView();

    else if (currentView === 'group') renderGroupView();

    else if (currentView === 'shop') renderShopView();

    if (actionHistory.length === 0) undoBtn.disabled = true;

}



function toggleSelectMode() {

    isSelectMode = !isSelectMode;

    selectedStudentIds.clear();

    toggleSelectModeBtn.textContent = isSelectMode ? '退出多选' : '多选互动';

    selectAllBtn.style.display = isSelectMode ? 'inline-block' : 'none';

    waterSelectedBtn.style.display = isSelectMode ? 'inline-block' : 'none';

    if (isSelectMode) selectAllBtn.textContent = '全选';

    if (document.getElementById('individual-view').style.display !== 'none') {

        initOrUpdateSortableIndividual(isSelectMode);

        renderIndividualView();

    } else {

        renderGroupView();

    }

}

function handleSelectAll() {

    soundManager.init(); soundManager.playClick();

    const students = allClassData[currentClassId].students;

    if (selectedStudentIds.size === students.length) selectedStudentIds.clear();

    else students.forEach(s => selectedStudentIds.add(s.id));

    selectAllBtn.textContent = (selectedStudentIds.size === students.length) ? '取消全选' : '全选';

    if (document.getElementById('individual-view').style.display !== 'none') renderIndividualView(); else renderGroupView();

}

function toggleStudentSelection(studentId, plantUnit) {

    if (!plantUnit) return;

    if (selectedStudentIds.has(studentId)) { selectedStudentIds.delete(studentId); plantUnit.classList.remove('selected'); }

    else { selectedStudentIds.add(studentId); plantUnit.classList.add('selected'); }

    selectAllBtn.textContent = (selectedStudentIds.size === allClassData[currentClassId].students.length) ? '取消全选' : '全选';

}



// 创建爱心动效的函数

function createHeartAnimation(plantUnit, studentId) {

    try {

        if (!plantUnit) return;



        // 获取学生按钮元素的位置（更可靠的选择器）

        const buttonElement = plantUnit.querySelector('.student-button');

        if (!buttonElement) return;



        const buttonRect = buttonElement.getBoundingClientRect();

        const plantRect = plantUnit.getBoundingClientRect();



        // 计算起点（学生按钮中心位置）

        const startX = buttonRect.left + buttonRect.width / 2 - plantRect.left;

        const startY = buttonRect.top + buttonRect.height / 2 - plantRect.top;



        // 获取宠物图片的位置

        const petImage = plantUnit.querySelector('.pet-image');

        if (!petImage) return;



        const petRect = petImage.getBoundingClientRect();

        const petCenterX = petRect.left + petRect.width / 2 - plantRect.left;

        const petCenterY = petRect.top + petRect.height / 2 - plantRect.top;



        // 计算终点，直接在宠物中心位置

        const deltaX = petCenterX - startX;

        const deltaY = petCenterY - startY;

        const endX = petCenterX;  // 直接飞到宠物中心

        const endY = petCenterY;  // 直接飞到宠物中心



        // 创建移动的爱心

        const flyingHeart = document.createElement('div');

        flyingHeart.innerHTML = '❤️';

        flyingHeart.style.cssText = `

            position: absolute;

            font-size: 35px;

            z-index: 200;

            pointer-events: none;

            left: ${startX}px;

            top: ${startY}px;

            transform: translate(-50%, -50%);

            opacity: 1;

            filter: drop-shadow(0 3px 15px rgba(255, 105, 180, 1));

        `;



        // 添加到卡片中

        plantUnit.appendChild(flyingHeart);



        // 临时移除overflow限制，让爱心可以飞出容器

        const originalOverflow = plantUnit.style.overflow;

        plantUnit.style.overflow = 'visible';



        // 开始动画 - 从名字飞向宠物

        setTimeout(() => {

            flyingHeart.style.transition = 'all 4.0s ease-out';

            flyingHeart.style.left = `${endX}px`;

            flyingHeart.style.top = `${endY}px`;

            flyingHeart.style.opacity = '0';

            flyingHeart.style.transform = 'translate(-50%, -50%) scale(1.3)';

        }, 100);



        // 清理元素

        setTimeout(() => {

            try {

                if (flyingHeart.parentNode) {

                    plantUnit.removeChild(flyingHeart);

                }

                // 恢复原始的overflow设置

                plantUnit.style.overflow = originalOverflow;

            } catch (e) {

                console.log('清理动画元素失败:', e);

            }

        }, 4200);



    } catch (error) {

        console.log('爱心动画创建失败:', error);

    }

}



function handleBatchRecitation() {

    if (selectedStudentIds.size === 0) { alert('请先选择学生！'); return; }

    soundManager.init();

    actionHistory.push(JSON.parse(JSON.stringify(allClassData[currentClassId])));

    undoBtn.disabled = false;

    waterSelectedBtn.disabled = true; selectAllBtn.disabled = true; toggleSelectModeBtn.disabled = true;



    const activeView = individualView.style.display !== 'none' ? individualView : groupView;



    // 为每个选中的学生创建爱心动效

    selectedStudentIds.forEach(studentId => {

        const plantUnit = activeView.querySelector(`#plant-unit-${studentId}`);

        if (plantUnit) {

            createHeartAnimation(plantUnit, studentId);

        }

    });



    setTimeout(() => {

        soundManager.playMagicGrow();

        selectedStudentIds.forEach(studentId => {

            const student = allClassData[currentClassId].students.find(s => s.id === studentId);

            if (!student) return;



            // 新机制：每次点击直接给一颗爱心

            if (!Array.isArray(student.collectedPlants)) student.collectedPlants = [];

            student.collectedPlants.push("❤️");



            // 更新点击计数（用于宠物状态循环）

            if (student.justContinuedPet) {

                // 如果是刚继续养，从-1开始计算

                student.recitationCount = (student.recitationCount + 1) % 4;

            } else {

                // 正常情况

                student.recitationCount = (student.recitationCount + 1) % 4;

            }

            student.totalRecitations = (student.totalRecitations || 0) + 1;



            // 检查升级和LV3相关逻辑

            handleRewardAndCheck(studentId);



            // LV3状态下，每次状态改变都调用循环函数

            if (student.petLevel === "lv3") {

                // 如果是刚继续养后的第一次点击，清除继续养标记

                if (student.justContinuedPet) {

                    console.log('批量选择：刚继续养后的第一次点击，清除继续养标记');

                    student.justContinuedPet = false;

                }

                handleLv3CycleComplete(studentId);

            }

        });

        saveAllClassData();

        setTimeout(() => {

            waterSelectedBtn.disabled = false; selectAllBtn.disabled = false; toggleSelectModeBtn.disabled = false;

            toggleSelectMode();

            const currentView = document.getElementById('individual-view').style.display !== 'none' ? 'individual' : (document.getElementById('group-view').style.display !== 'none' ? 'group' : 'shop');

            if (currentView === 'individual') renderIndividualView();

            else if (currentView === 'group') renderGroupView();

            else if (currentView === 'shop') renderShopView();

        }, 1500);

    }, 1500);

}



function initOrUpdateSortableIndividual(disabled) {

    if (sortableInstanceIndividual) {

        sortableInstanceIndividual.option('disabled', disabled);

    } else {

        sortableInstanceIndividual = new Sortable(gardenGridIndividual, {

            animation: 150, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen',

            disabled: disabled,

            onEnd: function (evt) {

                const students = allClassData[currentClassId].students;

                const [movedItem] = students.splice(evt.oldIndex, 1);

                students.splice(evt.newIndex, 0, movedItem);

                saveAllClassData();

            },

        });

    }

}





// ====== 导入导出 (Excel版本) ======

function handleExportData() {

    try {

        // 首先加载最新数据

        loadAllClassData();



        // 检查是否有任何数据可以导出

        const hasAnyData = Object.values(allClassData).some(classData =>

            classData.students.length > 0 || classData.groups.length > 0 || classData.prizes.length > 0

        );



        if (!hasAnyData) {

            alert("没有数据可以导出。请先添加学生、小组或奖品。");

            return;

        }



        const wb = XLSX.utils.book_new();



        // 1. 导出全局设置

        const globalSettings = [{

            currentClassId: currentClassId,

            mainTitle: mainTitle.innerHTML,

            petLevel2Threshold: PET_LEVEL_2_THRESHOLD,

            petLevel3Threshold: PET_LEVEL_3_THRESHOLD

        }];

        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(globalSettings), "GlobalSettings_勿动");



        // 2. 导出所有班级的基本信息

        const classesInfo = Object.entries(allClassData).map(([classId, classData]) => ({

            id: classId,

            name: classData.name,

            dailyGoal: classData.dailyGoal || "",

            password: classData.password || ""

        }));

        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(classesInfo), "Classes_勿动");



        // 3. 导出每个班级的详细数据

        Object.entries(allClassData).forEach(([classId, classData]) => {

            // 工作表名称限制在31字符内

            const sheetNamePrefix = classId.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 12);



            // 学生数据

            if (classData.students && classData.students.length > 0) {

                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(classData.students),

                    `${sheetNamePrefix}_Students_勿动`);

            }



            // 小组数据

            if (classData.groups && classData.groups.length > 0) {

                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(classData.groups),

                    `${sheetNamePrefix}_Groups_勿动`);

            }



            // 奖品数据

            if (classData.prizes && classData.prizes.length > 0) {

                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(classData.prizes),

                    `${sheetNamePrefix}_Prizes_勿动`);

            }

        });



        // 保存文件

        XLSX.writeFile(wb, `宠物屋完整数据_${new Date().toISOString().split('T')[0]}.xlsx`);



        console.log('✅ Excel数据导出成功，包含:');

        console.log('- 所有班级数据:', Object.keys(allClassData).length, '个班级');

        console.log('- 系统设置: 标题、宠物成长设置、当前班级');

        console.log('- 完整的宠物数据结构');



    } catch (e) {

        alert('导出数据失败！错误详情请查看控制台。');

        console.error("导出失败:", e);

    }

}



function handleImportData(event) {

    const file = event.target.files[0];

    if (!file) return;



    // 只支持Excel文件

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {

        // Excel文件直接导入

        importExcelData(file);

    } else {

        alert('只支持Excel文件格式(.xlsx, .xls)，请导出Excel文件后重新导入！');

        // 重置文件输入

        event.target.value = '';

    }

}



// 新的Excel导入函数

function importExcelData(file) {

    const reader = new FileReader();

    reader.onload = function(e) {

        try {

            const data = new Uint8Array(e.target.result);

            const workbook = XLSX.read(data, { type: 'array' });



            // 初始化新数据结构

            const newAllClassData = {};

            let newCurrentClassId = null;

            let newMainTitle = "宠物屋";



            // 读取全局设置

            const globalSettingsSheet = workbook.Sheets["GlobalSettings_勿动"];

            if (globalSettingsSheet) {

                const globalSettings = XLSX.utils.sheet_to_json(globalSettingsSheet);

                if (globalSettings.length > 0) {

                    newCurrentClassId = globalSettings[0].currentClassId;

                    newMainTitle = globalSettings[0].mainTitle || "宠物屋";

                    PET_LEVEL_2_THRESHOLD = globalSettings[0].petLevel2Threshold || 4;

                    PET_LEVEL_3_THRESHOLD = globalSettings[0].petLevel3Threshold || 8;

                }

            }



            // 读取班级基本信息

            const classesSheet = workbook.Sheets["Classes_勿动"];

            const classesInfo = classesSheet ? XLSX.utils.sheet_to_json(classesSheet) : [];



            // 读取每个班级的详细数据

            classesInfo.forEach(classInfo => {

                const classId = classInfo.id;

                const sheetNamePrefix = classId.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 12);



                // 创建班级数据结构

                newAllClassData[classId] = {

                    id: classId,

                    name: classInfo.name || '未命名班级',

                    dailyGoal: classInfo.dailyGoal || '',

                    password: classInfo.password || '',

                    students: [],

                    groups: [],

                    prizes: []

                };



                // 读取学生数据

                const studentsSheet = workbook.Sheets[`${sheetNamePrefix}_Students_勿动`];

                if (studentsSheet) {

                    let students = XLSX.utils.sheet_to_json(studentsSheet);



                    // 规范化每个学生的collectedPlants数据

                    students = students.map(student => {

                        // 先确保totalRecitations不为空

                        if (!student.totalRecitations) student.totalRecitations = 0;



                        // 修复：确保groupId字段正确设置，如果Excel中没有groupId或为空，设置为null

                        if (student.groupId === undefined || student.groupId === '') {

                            student.groupId = null;

                        }



                        // 调试：输出导入前的原始数据

                        console.log(`🔍 导入学生数据调试 - ${student.name}:`, {

                            原始collectedPlants: student.collectedPlants,

                            数据类型: typeof student.collectedPlants,

                            数组长度: Array.isArray(student.collectedPlants) ? student.collectedPlants.length : 'N/A',

                            字符串长度: typeof student.collectedPlants === 'string' ? student.collectedPlants.length : 'N/A',

                            totalRecitations: student.totalRecitations,

                            groupId: student.groupId

                        });



                        // 修复：主要使用totalRecitations作为数据源，确保与Excel表格一致

                        if (student.totalRecitations && student.totalRecitations > 0) {

                            // 直接使用totalRecitations创建collectedPlants数组

                            student.collectedPlants = Array(student.totalRecitations).fill("❤️");

                            console.log(`📊 基于 totalRecitations=${student.totalRecitations} 创建collectedPlants - ${student.name}:`, student.collectedPlants);

                        } else {

                            // 如果totalRecitations为0，清空数组

                            student.collectedPlants = [];

                            console.log(`📊 totalRecitations为0，清空数组 - ${student.name}:`, student.collectedPlants);

                        }



                        // 确保其他关键字段也是正确的格式

                        if (!student.recitationCount) student.recitationCount = Math.min(student.collectedPlants.length, 3); // 限制在0-3之间



                        console.log(`📋 最终数据 - ${student.name}:`, {

                            最终collectedPlants: student.collectedPlants,

                            最终recitationCount: student.recitationCount,

                            最终totalRecitations: student.totalRecitations,

                            最终groupId: student.groupId

                        });



                        return student;

                    });



                    newAllClassData[classId].students = students;

                }



                // 读取小组数据

                const groupsSheet = workbook.Sheets[`${sheetNamePrefix}_Groups_勿动`];

                if (groupsSheet) {

                    newAllClassData[classId].groups = XLSX.utils.sheet_to_json(groupsSheet);

                }



                // 读取奖品数据

                const prizesSheet = workbook.Sheets[`${sheetNamePrefix}_Prizes_勿动`];

                if (prizesSheet) {

                    newAllClassData[classId].prizes = XLSX.utils.sheet_to_json(prizesSheet);

                }

            });



            // 应用导入的数据

            allClassData = newAllClassData;

            currentClassId = newCurrentClassId || Object.keys(allClassData)[0] || null;

            mainTitle.innerHTML = DEFAULT_TITLE;



            // 保存数据

            saveAllClassData();

            saveGrowthSettings();



            alert(`✅ Excel数据导入成功！\n恢复了 ${Object.keys(allClassData).length} 个班级的所有数据！`);



            // 刷新界面

            renderClassList();

            if (currentClassId && allClassData[currentClassId]) {

                loadTitle();

                renderExistingStudents();

                renderGroupManagement();

                renderPrizeManagementList();

            }



        } catch (error) {

            console.error('导入失败:', error);

            alert("导入失败: " + error.message + "\n请确保使用的是本系统导出的Excel文件。");

        }

    };



    // 读取Excel文件

    reader.readAsArrayBuffer(file);

}





function showMagicParticles(container) { for (let i = 0; i < 15; i++) { const p = document.createElement('div'); p.className = 'magic-particle'; p.style.left = `${Math.random()*80+10}%`; const d = Math.random()*1+0.5, y = Math.random()*0.5; p.style.animationDuration = `${d}s`; p.style.animationDelay = `${y}s`; container.appendChild(p); setTimeout(() => p.remove(), (d + y) * 1000); } }

// ====== 视图切换 (已适配多班级) ======

function switchView(viewName) {

    soundManager.init(); soundManager.playClick();

    individualView.style.display = 'none';

    groupView.style.display = 'none';

    shopView.style.display = 'none';

    showIndividualViewBtn.classList.remove('active');

    showGroupViewBtn.classList.remove('active');

    showShopViewBtn.classList.remove('active');



    if (viewName === 'individual') {

        individualView.style.display = 'block';

        showIndividualViewBtn.classList.add('active');

        renderIndividualView();

    } else if (viewName === 'group') {

        groupView.style.display = 'block';

        showGroupViewBtn.classList.add('active');

        renderGroupView();

    } else if (viewName === 'shop') {

        shopView.style.display = 'block';

        showShopViewBtn.classList.add('active');

        renderShopView(); 

    }

}



// ====== 小组管理 (已适配多班级) ======

function handleCreateGroup() {

    soundManager.init(); soundManager.playClick();

    const name = groupNameInput.value.trim();

    const groups = allClassData[currentClassId].groups; // 使用当前班级数据

    if (!name || groups.some(g => g.name === name)) { alert('小组名不能为空或已存在！'); return; }

    const newGroup = { id: createRandomId(), name: name };

    groups.push(newGroup);

    saveAllClassData();

    groupNameInput.value = '';

    renderGroupManagement();

    openMemberEditor(newGroup.id);

}



function handleDeleteGroup(groupId) {

    const group = allClassData[currentClassId].groups.find(g => g.id === groupId);

    if (!group) return;

    groupIdToDelete = groupId;

    deleteGroupConfirmName.textContent = `“${group.name}”`;

    deleteGroupConfirmModal.classList.add('show');

}



function confirmDeleteGroup() {

    if (!groupIdToDelete) return;

    soundManager.init(); soundManager.playDelete();

    const currentClass = allClassData[currentClassId];

    currentClass.groups = currentClass.groups.filter(g => g.id !== groupIdToDelete);

    currentClass.students.forEach(s => { if (s.groupId === groupIdToDelete) s.groupId = null; });

    saveAllClassData();

    renderGroupManagement();

    deleteGroupConfirmModal.classList.remove('show');

    groupIdToDelete = null;

}



function renderGroupManagement() {

    groupsDisplayArea.innerHTML = '';

    const { students, groups } = allClassData[currentClassId];

    (groups || []).forEach(group => {

        const card = document.createElement('div');

        card.className = 'group-card';

        const members = students.filter(s => s.groupId === group.id);

        card.innerHTML = `

            <div class="group-card-header">

                <h4 contenteditable="true">${group.name}</h4>

                <span class="member-count">${members.length} 人</span>

            </div>

            <div class="group-card-body">${members.map(m=>m.name).join('、') || '暂无成员'}</div>

            <div class="group-card-footer">

                <button class="edit-members-btn">编辑成员</button>

                <button class="delete-group-btn">删除小组</button>

            </div>`;

        card.querySelector('h4').addEventListener('blur', e => updateGroupName(group.id, e.target.textContent.trim()));

        card.querySelector('h4').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });

        card.querySelector('.edit-members-btn').onclick = () => openMemberEditor(group.id);

        card.querySelector('.delete-group-btn').onclick = () => handleDeleteGroup(group.id);

        groupsDisplayArea.appendChild(card);

    });

}



function updateGroupName(groupId, newName) {

    const groups = allClassData[currentClassId].groups;

    const groupIndex = groups.findIndex(g => g.id === groupId);

    if (groupIndex === -1 || !newName) { renderGroupManagement(); return; }

    if (groups.some(g => g.id !== groupId && g.name === newName)) { alert(`小组名 "${newName}" 已存在！`); renderGroupManagement(); return; }

    if (groups[groupIndex].name !== newName) { groups[groupIndex].name = newName; saveAllClassData(); }

}



function openMemberEditor(groupId) {

    currentEditingGroupId = groupId;

    const { students, groups } = allClassData[currentClassId];

    const group = groups.find(g => g.id === groupId);

    if (!group) return;

    groupEditorTitle.textContent = `编辑 "${group.name}" 的成员`;

    groupEditorStudentList.innerHTML = '';

    const availableStudents = students.filter(s => s.groupId === null || s.groupId === groupId);

    if(availableStudents.length === 0) { groupEditorStudentList.innerHTML = '<p>没有可分配的学生了。</p>'; } 

    else {

        availableStudents.forEach(s => {

            groupEditorStudentList.innerHTML += `<div class="editor-student-item"><input type="checkbox" id="edit-check-${s.id}" data-student-id="${s.id}" ${s.groupId === groupId ? 'checked' : ''}><label for="edit-check-${s.id}">${s.name}</label></div>`;

        });

    }

    groupEditorModal.classList.add('show');

}



function handleSaveChangesToGroup() {

    soundManager.init(); soundManager.playClick();

    groupEditorStudentList.querySelectorAll('input[type="checkbox"]').forEach(cb => {

        const student = allClassData[currentClassId].students.find(s => s.id === cb.dataset.studentId);

        if (!student) return;

        if (cb.checked) student.groupId = currentEditingGroupId;

        else if (student.groupId === currentEditingGroupId) student.groupId = null;

    });

    saveAllClassData();

    renderGroupManagement();

    groupEditorModal.classList.remove('show');

    currentEditingGroupId = null;

}



function handleGroupBatchWater(groupId) {

    selectedStudentIds = new Set(allClassData[currentClassId].students.filter(s => s.groupId === groupId).map(s => s.id));

    if (selectedStudentIds.size === 0) { alert('该小组没有成员可互动。'); return; }

    handleBatchRecitation(); 

}



function handleGroupPenalty(groupId) {

    const group = allClassData[currentClassId].groups.find(g => g.id === groupId);

    if (!group) return;

    groupIdToPenalize = groupId;

    penaltyGroupConfirmName.textContent = `为“${group.name}”小组`;

    penaltyGroupConfirmModal.classList.add('show');

}



function confirmGroupPenalty() {

    if (!groupIdToPenalize) return;

    soundManager.init(); soundManager.playDelete();

    actionHistory.push(JSON.parse(JSON.stringify(allClassData[currentClassId])));

    undoBtn.disabled = false;



    allClassData[currentClassId].students.forEach(s => {

        if (s.groupId === groupIdToPenalize && Array.isArray(s.collectedPlants) && s.collectedPlants.length > 0) {

            // 新机制：小组惩罚扣一颗爱心

            s.collectedPlants.pop(); // 移除最后一颗爱心



            // 更新点击计数

            s.totalRecitations = Math.max(0, (s.totalRecitations || 0) - 1);

            s.recitationCount = s.totalRecitations % 4;



            // 重新计算宠物等级

            if (s.collectedPlants.length < PET_LEVEL_2_THRESHOLD) {

                s.petLevel = "lv1";

            } else if (s.collectedPlants.length < PET_LEVEL_3_THRESHOLD) {

                s.petLevel = "lv2";

            } else {

                s.petLevel = "lv3";

            }

        }

    });

    saveAllClassData();

    renderGroupView();

    penaltyGroupConfirmModal.classList.remove('show');

    groupIdToPenalize = null;

}



// ====== 商城管理 (已适配多班级) ======

function handleAddPrize() {

    soundManager.init(); soundManager.playClick();

    const name = prizeNameInput.value.trim();

    const cost = parseInt(prizeCostInput.value);

    const stockInput = prizeStockInput.value.trim();

    if (!name) { alert('请输入奖品名称！'); return; }

    if (isNaN(cost) || cost <= 0) { alert('请输入一个有效的爱心门槛！'); return; }

    const stock = stockInput === '' ? -1 : parseInt(stockInput);

    if (isNaN(stock) || (stock < 0 && stock !== -1)) { alert('库存请输入一个正整数，或不填代表无限。'); return; }



            const newPrize = { id: createRandomId(), name: name, cost: cost, stock: stock };

    allClassData[currentClassId].prizes.push(newPrize); // 添加到当前班级

    saveAllClassData();

    renderPrizeManagementList();

    prizeNameInput.value = ''; prizeCostInput.value = ''; prizeStockInput.value = '';

}



function renderPrizeManagementList() {

    prizeListDisplayArea.innerHTML = '';

    const prizes = allClassData[currentClassId].prizes; // 获取当前班级奖品

    if (prizes.length === 0) {

        prizeListDisplayArea.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #888;">暂无奖品，请添加。</p>';

        return;

    }

    prizes.forEach(prize => {

        const card = document.createElement('div');

        card.className = 'prize-item'; 

        card.innerHTML = `

            <span class="prize-name-editable" contenteditable="true">${prize.name}</span>

            <span class="prize-field">门槛: <input type="number" class="prize-cost" value="${prize.cost}"></span>

            <span class="prize-field">库存: <input type="number" class="prize-stock" value="${prize.stock}"></span>

            <button class="delete-btn prize-delete-btn">删除</button>`;

        card.querySelector('.prize-name-editable').addEventListener('blur', (e) => updatePrize(prize.id, 'name', e.target.textContent.trim()));

        card.querySelector('.prize-cost').addEventListener('change', (e) => updatePrize(prize.id, 'cost', parseInt(e.target.value)));

        card.querySelector('.prize-stock').addEventListener('change', (e) => updatePrize(prize.id, 'stock', parseInt(e.target.value)));

        card.querySelector('.delete-btn').addEventListener('click', () => deletePrize(prize.id));

        prizeListDisplayArea.appendChild(card);

    });

}



function updatePrize(prizeId, field, value) {

    const prize = allClassData[currentClassId].prizes.find(p => p.id === prizeId);

    if (!prize) return;

    if (field === 'name' && !value) { alert('奖品名称不能为空！'); renderPrizeManagementList(); return; }

    if (field === 'cost' && (isNaN(value) || value <= 0)) { alert('爱心门槛必须大于0！'); renderPrizeManagementList(); return; }

     if (field === 'stock' && (isNaN(value) || (value < 0 && value !== -1))) { alert('库存必须是正整数或-1(无限)！'); renderPrizeManagementList(); return; }

    prize[field] = value;

    saveAllClassData();

    soundManager.init(); soundManager.playClick();

}



function deletePrize(prizeId) {

    soundManager.init(); soundManager.playDelete();

    const currentClass = allClassData[currentClassId];

    currentClass.prizes = currentClass.prizes.filter(p => p.id !== prizeId);

    saveAllClassData();

    renderPrizeManagementList();

}



// ====== 商城兑换 (已适配多班级) ======

function getStudentAvailableBadges(student) {

    if (!student) return 0;

    const totalCollected = student.collectedPlants ? student.collectedPlants.length : 0;

    const totalSpent = (student.redeemedHistory || []).reduce((sum, item) => sum + item.cost, 0);

    return totalCollected - totalSpent;

}



function renderShopView() {

    shopViewContainer.innerHTML = '';

    const students = allClassData[currentClassId].students;

    let rankedStudents = students.map(s => ({

        ...s,

        badgeCount: s.collectedPlants ? s.collectedPlants.length : 0

    })).sort((a, b) => b.badgeCount - a.badgeCount);



    if (rankedStudents.length === 0) {

        shopViewContainer.innerHTML = '<p style="text-align: center; color: #888;">暂无学生</p>';

        return;

    }

    const listContainer = document.createElement('div');

    listContainer.className = 'student-rank-list';

    rankedStudents.forEach((student, index) => {

        const item = document.createElement('div');

        item.className = 'student-rank-item';

        let redeemedHTML = '';

        if (student.redeemedHistory && student.redeemedHistory.length > 0) {

            const redeemedNames = student.redeemedHistory.map(item => item.prizeName).join('、');

            redeemedHTML = `<div class="redeemed-prizes-list"><strong>已兑换:</strong> ${redeemedNames}</div>`;

        }

        item.innerHTML = `

            <span class="rank-badge">#${index + 1}</span>

            <div class="rank-info">

                <strong>${student.name}</strong>

                <span class="badge-count">${student.badgeCount} 总爱心</span>

            </div>

            <div class="rank-actions">

                <button class="redeem-btn-for-student" data-student-id="${student.id}">兑换奖励</button>

            </div>

            ${redeemedHTML}`;

        item.querySelector('.redeem-btn-for-student').addEventListener('click', (e) => {

            openRedeemModal(e.currentTarget.dataset.studentId);

        });

        listContainer.appendChild(item);

    });

    shopViewContainer.appendChild(listContainer);

}



function closeRedeemModal() {

    if (redeemModalOverlay) {

        redeemModalOverlay.classList.remove('show');

    }

    if (redeemConfirmModal) {

        redeemConfirmModal.classList.remove('show');

    }

    currentRedeemInfo = { studentId: null, prizeId: null };

    wasRedeemModalOpenBeforeConfirm = false;

    isProcessingClick = false;

}



function openRedeemModal(studentId) {

    currentRedeemInfo.studentId = studentId; // 储存当前学生ID

    const student = allClassData[currentClassId].students.find(s => s.id === studentId);

    if (!student) return;



    soundManager.init(); soundManager.playModalOpen();

    const totalCollectedBadges = student.collectedPlants ? student.collectedPlants.length : 0;

    const availableBadges = getStudentAvailableBadges(student);



    redeemModalTitle.textContent = `为 ${student.name} 兑换`;

    redeemStudentInfo.innerHTML = `总爱心: <span>${totalCollectedBadges}</span> | 可用: <span style="color: #f57c00;">${availableBadges}</span>`;



    redeemPrizeList.innerHTML = '';

    const prizes = allClassData[currentClassId].prizes;

    if (prizes.length === 0) {

        redeemPrizeList.innerHTML = '<p style="text-align: center; color: #888;">商城暂无奖品</p>';

        redeemModalOverlay.classList.add('show');

        return;

    }



    prizes.forEach(prize => {

        const canAfford = availableBadges >= prize.cost;

        const isOutOfStock = prize.stock === 0;

        const canRedeem = canAfford && !isOutOfStock;

        let stockDisplay = prize.stock === -1 ? '不限量' : prize.stock;

        let stockClass = isOutOfStock ? 'stock-zero' : '';



        const prizeItem = document.createElement('div');

        prizeItem.className = 'redeem-prize-item';

        prizeItem.innerHTML = `

            <div class="redeem-prize-info">

                <strong>${prize.name}</strong>

                <div>消耗: <span style="color: #e65100; font-weight: bold;">${prize.cost}</span> | 余量: <span class="${stockClass}">${stockDisplay}</span></div>

            </div>

            <button class="redeem-btn" data-prize-id="${prize.id}" ${canRedeem ? '' : 'disabled'}>

                ${canAfford ? (isOutOfStock ? '已兑完' : '兑换') : '爱心不足'}

            </button>`;

        if (canRedeem) {

            prizeItem.querySelector('.redeem-btn').addEventListener('click', (e) => {

                handleRedeemClick(e.currentTarget.dataset.prizeId);

            });

        }

        redeemPrizeList.appendChild(prizeItem);

    });

    redeemModalOverlay.classList.add('show');

}



function handleRedeemClick(prizeId) {

    const student = allClassData[currentClassId].students.find(s => s.id === currentRedeemInfo.studentId);

    const prize = allClassData[currentClassId].prizes.find(p => p.id === prizeId);

    if (!student || !prize) return;



    currentRedeemInfo.prizeId = prizeId;

    redeemConfirmText.innerHTML = `

        为 <strong>${student.name}</strong> 兑换

        <strong style="color: #2e7d32; display: block; font-size: 1.3rem; margin: 5px 0;">${prize.name}</strong>

        将消耗 <span style="color:#e65100;">${prize.cost}</span> 可用爱心`;

    wasRedeemModalOpenBeforeConfirm = !!(redeemModalOverlay && redeemModalOverlay.classList.contains("show"));

    if (redeemModalOverlay) {

        redeemModalOverlay.classList.remove("show");

    }

    if (redeemConfirmModal) {

        redeemConfirmModal.classList.add("show");

    }

}



function confirmRedeem() {

    console.log('confirmRedeem invoked', currentRedeemInfo);

    const { studentId, prizeId } = currentRedeemInfo;

    console.log('confirmRedeem checking', { studentId, prizeId, currentClassId });

    const student = allClassData[currentClassId].students.find(s => s.id === studentId);

    const prize = allClassData[currentClassId].prizes.find(p => p.id === prizeId);

    console.log('confirmRedeem student/prize lookup', { student, prize });



    if (!student || !prize) {

        alert('未找到学生或奖品');

        if (redeemConfirmModal) redeemConfirmModal.classList.remove("show");

        return;

    }

    const availableBadges = getStudentAvailableBadges(student);

    if (availableBadges < prize.cost) {

        alert('兑换失败，可用爱心不足');

        if (redeemConfirmModal) redeemConfirmModal.classList.remove("show");

        return;

    }

    if (prize.stock === 0) {

        alert('兑换失败，奖品已兑完');

        if (redeemConfirmModal) redeemConfirmModal.classList.remove("show");

        return;

    }



    if (!Array.isArray(student.redeemedHistory)) student.redeemedHistory = [];

    student.redeemedHistory.push({

        prizeId: prize.id,

        prizeName: prize.name,

        cost: prize.cost,

        date: new Date().toISOString()

    });



    if (prize.stock > 0) prize.stock--;



    saveAllClassData();

    soundManager.init();

    soundManager.playHarvest();



    if (redeemConfirmModal) redeemConfirmModal.classList.remove("show");

    redeemModalOverlay.classList.remove("show");

    wasRedeemModalOpenBeforeConfirm = false;

    renderShopView();

}

 function handleResetAll() {

    try {

        // 强制重新加载数据，确保数据最新

        loadAllClassData();



        // 获取当前班级数据

        const currentClass = allClassData[currentClassId];



        if (!currentClass) {

            console.error('清零失败调试信息:');

            console.error('- currentClassId:', currentClassId);

            console.error('- allClassData:', allClassData);

            console.error('- 可用班级ID:', Object.keys(allClassData));

            alert('清零失败：当前班级不存在！');

            return;

        }



        // 清零所有学生数据

        currentClass.students.forEach(student => {

            student.recitationCount = 0;

            student.totalRecitations = 0;

            student.collectedPlants = [];

            student.groupId = null;

            student.redeemedHistory = [];

            student.petLevel = "lv1";

            student.currentPetStateIndex = 0;

            student.justContinuedPet = false;

            student.animatedBadges = []; // 清除动物徽章



            // 随机分配初始宠物

            const plantTypes = Object.keys(petLibrary);

            student.currentPet = plantTypes[Math.floor(Math.random() * plantTypes.length)];

        });



        // 清空小组和奖品

        currentClass.groups = [];

        currentClass.prizes = [];



        // 保存数据到服务器缓存

        saveAllClassData();



        // 关闭确认模态框

        resetConfirmModal.classList.remove('show');



        // 刷新界面

        renderExistingStudents();



        // 如果在花园界面，也刷新

        if (gardenContainer && gardenContainer.style.display !== 'none') {

            const currentView = document.getElementById('individual-view').style.display !== 'none' ? 'individual' :

                              (document.getElementById('group-view').style.display !== 'none' ? 'group' : 'shop');

            if (currentView === 'individual') renderIndividualView();

            else if (currentView === 'group') renderGroupView();

            else if (currentView === 'shop') renderShopView();

                      }

    } catch (error) {

        console.error('清零过程中出现错误:', error);

        // 静默处理错误，不显示用户弹窗避免困惑

    }

}



document.addEventListener('DOMContentLoaded', initApp);
