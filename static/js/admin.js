(function () {
    const AUTH_KEY = 'admin_auth_token';
    const AUTH_VALUE = 'granted';
    if (localStorage.getItem(AUTH_KEY) !== AUTH_VALUE) {
        window.location.href = 'login.html';
        return;
    }
    const STORAGE_KEY = 'pet_game_multiclass_data_v2';
    const GROWTH_KEY = 'pet_growth_settings';
    const TITLE_KEY = 'pet_game_title_v2';
    const PET_TYPES = ['cat_orange', 'cat_black', 'dog_corgi', 'dog_border'];
    const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`);

    const refs = {
        toast: document.getElementById('admin-toast'),
        classSelect: document.getElementById('admin-class-select'),
        newClassInput: document.getElementById('admin-new-class-name'),
        addClassBtn: document.getElementById('admin-add-class'),
        deleteClassBtn: document.getElementById('admin-delete-class'),
        classNameLabel: document.getElementById('admin-current-class-name'),
        studentInput: document.getElementById('admin-student-input'),
        saveStudentsBtn: document.getElementById('admin-save-students'),
        enterGardenBtn: document.getElementById('admin-enter-garden'),
        studentTags: document.getElementById('admin-student-tags'),
        groupInput: document.getElementById('admin-group-input'),
        createGroupBtn: document.getElementById('admin-create-group'),
        groupsDisplay: document.getElementById('admin-groups-display'),
        prizeName: document.getElementById('admin-prize-name'),
        prizeCost: document.getElementById('admin-prize-cost'),
        prizeStock: document.getElementById('admin-prize-stock'),
        addPrizeBtn: document.getElementById('admin-add-prize'),
        prizesDisplay: document.getElementById('admin-prizes-display'),
        level2Input: document.getElementById('admin-level2'),
        level3Input: document.getElementById('admin-level3'),
                saveGrowthBtn: document.getElementById('admin-save-growth'),
        importBtn: document.getElementById('admin-import-data'),
        importInput: document.getElementById('admin-import-input'),
        exportBtn: document.getElementById('admin-export-data'),
        groupModal: document.getElementById('admin-group-modal'),
        groupModalTitle: document.getElementById('admin-group-modal-title'),
        groupModalList: document.getElementById('admin-group-member-list'),
        groupModalSave: document.getElementById('admin-group-modal-save'),
        groupModalCancel: document.getElementById('admin-group-modal-cancel'),
        groupModalClose: document.getElementById('admin-group-modal-close')
    };

    const state = {
        classes: loadClasses(),
        selectedClassId: null,
        thresholds: loadGrowthSettings()
    };
    let editingGroupId = null;

    init();

    function init() {
        const ids = Object.keys(state.classes);
        state.selectedClassId = ids[0] || createClass('默认班级');
        renderClassOptions();
        selectClass(state.selectedClassId);
        renderGrowthSettings();
        bindEvents();
    }

    function bindEvents() {
        refs.classSelect.addEventListener('change', (e) => selectClass(e.target.value));
        refs.addClassBtn.addEventListener('click', handleCreateClass);
        refs.deleteClassBtn.addEventListener('click', handleDeleteClass);
        refs.saveStudentsBtn.addEventListener('click', addStudentsFromInput);
        refs.enterGardenBtn.addEventListener('click', () => window.location.href = 'index.html');
        refs.createGroupBtn.addEventListener('click', handleCreateGroup);
        refs.addPrizeBtn.addEventListener('click', addPrizeFromForm);
        refs.saveGrowthBtn.addEventListener('click', saveGrowthSettings);
        refs.importBtn.addEventListener('click', () => refs.importInput.click());
        refs.importInput.addEventListener('change', handleImportFile);
        refs.exportBtn.addEventListener('click', exportAllData);
        refs.groupModalSave.addEventListener('click', saveGroupMemberSelection);
        refs.groupModalCancel.addEventListener('click', closeGroupModal);
        refs.groupModalClose.addEventListener('click', closeGroupModal);
        refs.groupModal.addEventListener('click', (e) => {
            if (e.target === refs.groupModal) closeGroupModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeGroupModal();
        });
    }

    function loadClasses() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            Object.values(parsed).forEach(ensureClassStructure);
            return parsed;
        } catch (err) {
            console.warn('加载班级数据失败，使用空结构。', err);
            return {};
        }
    }

    function saveClasses() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.classes));
    }

    function ensureClassStructure(cls) {
        if (!cls) return;
        cls.name = cls.name || '未命名班级';
        cls.students = Array.isArray(cls.students) ? cls.students : [];
        cls.groups = Array.isArray(cls.groups) ? cls.groups : [];
        cls.prizes = Array.isArray(cls.prizes) ? cls.prizes : [];
        cls.dailyGoal = typeof cls.dailyGoal === 'string' ? cls.dailyGoal : '';
        cls.students.forEach(ensureStudentStructure);
        return cls;
    }

    function ensureStudentStructure(student) {
        if (!student) return;
        if (!student.id) student.id = uuid();
        student.name = student.name || '未命名';
        if (!PET_TYPES.includes(student.currentPet)) {
            student.currentPet = PET_TYPES[Math.floor(Math.random() * PET_TYPES.length)];
        }
        student.petLevel = ['lv1', 'lv2', 'lv3'].includes(student.petLevel) ? student.petLevel : 'lv1';
        student.groupId = student.groupId || null;
        student.recitationCount = Number.isFinite(student.recitationCount) ? student.recitationCount : 0;
        student.totalRecitations = Number.isFinite(student.totalRecitations) ? student.totalRecitations : 0;
        if (!Array.isArray(student.collectedPlants)) student.collectedPlants = [];
        if (!Array.isArray(student.collectedPets)) student.collectedPets = [];
        if (!Array.isArray(student.animatedBadges)) student.animatedBadges = [];
        if (!Array.isArray(student.redeemedHistory)) student.redeemedHistory = [];
    }

    function loadGrowthSettings() {
        const defaults = { lv2: 4, lv3: 8 };
        try {
            const raw = localStorage.getItem(GROWTH_KEY);
            if (!raw) return defaults;
            const parsed = JSON.parse(raw);
            return {
                lv2: Number(parsed.level2Threshold) || defaults.lv2,
                lv3: Number(parsed.level3Threshold) || defaults.lv3
            };
        } catch (err) {
            console.warn('加载成长配置失败，使用默认值。', err);
            return defaults;
        }
    }

    function persistGrowthSettings() {
        localStorage.setItem(GROWTH_KEY, JSON.stringify({
            level2Threshold: state.thresholds.lv2,
            level3Threshold: state.thresholds.lv3
        }));
    }

    function renderClassOptions() {
        const ids = Object.keys(state.classes);
        refs.classSelect.innerHTML = '';
        ids.forEach((id) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = state.classes[id].name;
            refs.classSelect.appendChild(option);
        });
        if (!state.selectedClassId && ids.length > 0) {
            state.selectedClassId = ids[0];
        }
        if (state.selectedClassId) refs.classSelect.value = state.selectedClassId;
        refs.deleteClassBtn.disabled = ids.length <= 1;
    }

    function createClass(name) {
        const id = `class_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        state.classes[id] = ensureClassStructure({
            id,
            name,
            students: [],
            groups: [],
            prizes: [],
            dailyGoal: ''
        });
        saveClasses();
        return id;
    }

    function handleCreateClass() {
        const name = refs.newClassInput.value.trim();
        if (!name) {
            showToast('请输入班级名称。', 'error');
            return;
        }
        const id = createClass(name);
        refs.newClassInput.value = '';
        renderClassOptions();
        selectClass(id);
        showToast(`班级“${state.classes[id].name}”已创建。`);
    }

    function handleDeleteClass() {
        if (!state.selectedClassId) return;
        if (Object.keys(state.classes).length <= 1) {
            showToast('至少需要保留一个班级。', 'error');
            return;
        }
        const className = state.classes[state.selectedClassId].name;
        if (!confirm(`确定删除班级“${className}”吗？该操作不可恢复。`)) return;
        delete state.classes[state.selectedClassId];
        saveClasses();
        const ids = Object.keys(state.classes);
        state.selectedClassId = ids[0] || null;
        renderClassOptions();
        selectClass(state.selectedClassId);
        showToast(`班级“${className}”已删除。`);
    }

    function selectClass(classId) {
        if (!classId || !state.classes[classId]) return;
        state.selectedClassId = classId;
        ensureClassStructure(state.classes[classId]);
        refs.classSelect.value = classId;
        refs.classNameLabel.textContent = state.classes[classId].name;
        renderStudents();
        renderGroups();
        renderPrizes();
        updateActionStates();
    }

    function parseStudentInput(value) {
        return value
            .split(/[\s,，、；;]+/)
            .map((name) => name.trim())
            .filter(Boolean);
    }

    function addStudentsFromInput() {
        const currentClass = getCurrentClass();
        if (!currentClass) return;
        const names = parseStudentInput(refs.studentInput.value);
        if (names.length === 0) {
            showToast('请输入至少一个学生姓名。', 'error');
            return;
        }
        let added = 0;
        names.forEach((name) => {
            if (!currentClass.students.some((s) => s.name === name)) {
                currentClass.students.push(createStudent(name));
                added += 1;
            }
        });
        if (added === 0) {
            showToast('这些学生已经存在。', 'error');
            return;
        }
        refs.studentInput.value = '';
        saveClasses();
        renderStudents();
        renderGroups();
        showToast(`已新增 ${added} 名学生。`);
    }

    function createStudent(name) {
        return {
            id: uuid(),
            name,
            groupId: null,
            currentPet: PET_TYPES[Math.floor(Math.random() * PET_TYPES.length)],
            petLevel: 'lv1',
            recitationCount: 0,
            totalRecitations: 0,
            collectedPlants: [],
            collectedPets: [],
            animatedBadges: [],
            redeemedHistory: []
        };
    }

    function renderStudents() {
        const currentClass = getCurrentClass();
        const container = refs.studentTags;
        container.innerHTML = '';
        if (!currentClass || currentClass.students.length === 0) {
            container.innerHTML = '<p class="prize-empty">暂无学生，请先添加。</p>';
            updateActionStates();
            return;
        }
        currentClass.students.forEach((student) => {
            const tag = document.createElement('div');
            tag.className = 'student-tag';
            tag.innerHTML = `<span>${student.name}</span>`;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = '删除';
            btn.addEventListener('click', () => deleteStudent(student.id));
            tag.appendChild(btn);
            container.appendChild(tag);
        });
        updateActionStates();
    }

    function deleteStudent(studentId) {
        const currentClass = getCurrentClass();
        if (!currentClass) return;
        currentClass.students = currentClass.students.filter((s) => s.id !== studentId);
        saveClasses();
        renderStudents();
        renderGroups();
        showToast('学生已删除。');
    }

    function handleCreateGroup() {
        const currentClass = getCurrentClass();
        if (!currentClass) return;
        const name = refs.groupInput.value.trim();
        if (!name) {
            showToast('请输入小组名称。', 'error');
            return;
        }
        if (currentClass.groups.some((g) => g.name === name)) {
            showToast('小组名称已存在。', 'error');
            return;
        }
        currentClass.groups.push({ id: uuid(), name });
        refs.groupInput.value = '';
        saveClasses();
        renderGroups();
        showToast(`小组“${name}”已创建。`);
    }

    function renderGroups() {
        const currentClass = getCurrentClass();
        const container = refs.groupsDisplay;
        container.innerHTML = '';
        if (!currentClass || currentClass.groups.length === 0) {
            container.innerHTML = '<p class="prize-empty">暂无小组，快来创建吧。</p>';
            return;
        }
        currentClass.groups.forEach((group) => {
            const memberCount = currentClass.students.filter((s) => s.groupId === group.id).length;
            const item = document.createElement('div');
            item.className = 'admin-collection-item';
            item.innerHTML = `
                <div class="admin-group-info">
                    <strong>${group.name}</strong>
                    <span class="badge-pill">${memberCount} 人</span>
                </div>
            `;
            const actions = document.createElement('div');
            actions.className = 'admin-group-actions';
            const editBtn = document.createElement('button');
            editBtn.textContent = '编辑成员';
            editBtn.style.backgroundColor = '#ff9800';
            editBtn.addEventListener('click', () => openGroupMemberModal(group.id));
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '删除';
            deleteBtn.style.backgroundColor = '#f44336';
            deleteBtn.addEventListener('click', () => deleteGroup(group.id, group.name));
            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);
            item.appendChild(actions);
            container.appendChild(item);
        });
    }

    function deleteGroup(groupId, name) {
        const currentClass = getCurrentClass();
        if (!currentClass) return;
        if (!confirm(`确定删除小组“${name}”吗？成员会回到未分组状态。`)) return;
        currentClass.groups = currentClass.groups.filter((g) => g.id !== groupId);
        currentClass.students.forEach((student) => {
            if (student.groupId === groupId) student.groupId = null;
        });
        saveClasses();
        renderGroups();
        renderStudents();
        if (editingGroupId === groupId) closeGroupModal();
        showToast(`小组“${name}”已删除。`);
    }

    function openGroupMemberModal(groupId) {
        const currentClass = getCurrentClass();
        if (!currentClass) return;
        const group = currentClass.groups.find((g) => g.id === groupId);
        if (!group) return;
        editingGroupId = groupId;
        refs.groupModalTitle.textContent = `编辑小组“${group.name}”成员`;
        refs.groupModalList.innerHTML = '';
        if (currentClass.students.length === 0) {
            refs.groupModalList.innerHTML = '<p class="prize-empty" style="margin:0;">暂无学生可分配，请先添加学生。</p>';
        } else {
            currentClass.students.forEach((student) => {
                const item = document.createElement('label');
                item.className = 'admin-member-item';
                item.innerHTML = `
                    <span>${student.name}</span>
                    <input type="checkbox" value="${student.id}">
                `;
                const checkbox = item.querySelector('input');
                checkbox.checked = student.groupId === groupId;
                refs.groupModalList.appendChild(item);
            });
        }
        refs.groupModal.classList.add('show');
    }

    function closeGroupModal() {
        refs.groupModal.classList.remove('show');
        editingGroupId = null;
    }

    function saveGroupMemberSelection() {
        if (!editingGroupId) {
            closeGroupModal();
            return;
        }
        const currentClass = getCurrentClass();
        if (!currentClass) return;
        const selectedIds = Array.from(refs.groupModalList.querySelectorAll('input:checked')).map((el) => el.value);
        currentClass.students.forEach((student) => {
            if (selectedIds.includes(student.id)) {
                student.groupId = editingGroupId;
            } else if (student.groupId === editingGroupId) {
                student.groupId = null;
            }
        });
        saveClasses();
        renderGroups();
        renderStudents();
        showToast('小组成员已更新。');
        closeGroupModal();
    }

    function renderPrizes() {
        const currentClass = getCurrentClass();
        const container = refs.prizesDisplay;
        container.innerHTML = '';
        if (!currentClass || currentClass.prizes.length === 0) {
            container.innerHTML = '<p class="prize-empty">暂无奖品，请添加。</p>';
            return;
        }
        currentClass.prizes.forEach((prize) => {
            const item = document.createElement('div');
            item.className = 'admin-collection-item';
            const stockLabel = prize.stock === null || prize.stock === undefined ? '无限' : `${prize.stock} 件`;
            item.innerHTML = `
                <div>
                    <strong>${prize.name}</strong>
                    <div style="font-size:0.85rem;color:#777;">所需爱心：${prize.cost} ｜ 库存：${stockLabel}</div>
                </div>
            `;
            const btn = document.createElement('button');
            btn.textContent = '删除';
            btn.style.backgroundColor = '#f44336';
            btn.addEventListener('click', () => deletePrize(prize.id, prize.name));
            item.appendChild(btn);
            container.appendChild(item);
        });
    }

    function addPrizeFromForm() {
        const currentClass = getCurrentClass();
        if (!currentClass) return;
        const name = refs.prizeName.value.trim();
        const cost = Number(refs.prizeCost.value);
        const stockInput = refs.prizeStock.value.trim();
        const stock = stockInput === '' ? null : Number(stockInput);
        if (!name || !Number.isFinite(cost) || cost <= 0) {
            showToast('请填写有效的奖品名称和所需爱心。', 'error');
            return;
        }
        if (stock !== null && (!Number.isFinite(stock) || stock < 0)) {
            showToast('库存必须为非负数字。', 'error');
            return;
        }
        currentClass.prizes.push({ id: uuid(), name, cost, stock });
        refs.prizeName.value = '';
        refs.prizeCost.value = '';
        refs.prizeStock.value = '';
        saveClasses();
        renderPrizes();
        showToast('奖品已添加。');
    }

    function deletePrize(prizeId, name) {
        const currentClass = getCurrentClass();
        if (!currentClass) return;
        currentClass.prizes = currentClass.prizes.filter((p) => p.id !== prizeId);
        saveClasses();
        renderPrizes();
        showToast(`已删除奖品：${name}`);
    }

    function getCurrentClass() {
        return state.selectedClassId ? state.classes[state.selectedClassId] : null;
    }

    function updateActionStates() {
        const currentClass = getCurrentClass();
        const hasStudents = currentClass && currentClass.students.length > 0;
        refs.enterGardenBtn.disabled = !hasStudents;
    }

    function saveGrowthSettings() {
        const lv2 = Number(refs.level2Input.value);
        const lv3 = Number(refs.level3Input.value);
        if (!Number.isFinite(lv2) || !Number.isFinite(lv3) || lv2 <= 0 || lv3 <= 0 || lv2 >= lv3) {
            showToast('请填写正确的成长阈值（LV2 < LV3）。', 'error');
            return;
        }
        state.thresholds = { lv2, lv3 };
        persistGrowthSettings();
        showToast('成长设置已保存。');
    }

    function renderGrowthSettings() {
        refs.level2Input.value = state.thresholds.lv2;
        refs.level3Input.value = state.thresholds.lv3;
    }

    function handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (!/\.xlsx?$/i.test(file.name)) {
            showToast('仅支持 .xlsx / .xls 文件。', 'error');
            event.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                const { classes, selectedClassId, thresholds } = parseWorkbook(workbook);
                state.classes = classes;
                state.selectedClassId = selectedClassId;
                state.thresholds = thresholds;
                saveClasses();
                persistGrowthSettings();
                renderClassOptions();
                selectClass(state.selectedClassId);
                renderGrowthSettings();
                showToast(`导入成功，共恢复 ${Object.keys(state.classes).length} 个班级。`);
            } catch (err) {
                console.error('导入失败:', err);
                showToast('导入失败，请确保使用系统导出的 Excel 文件。', 'error');
            } finally {
                event.target.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function parseWorkbook(workbook) {
        const classes = {};
        let selectedClassId = null;
        const thresholds = { lv2: 4, lv3: 8 };

        const globalSheet = workbook.Sheets['GlobalSettings_勿动'];
        if (globalSheet) {
            const rows = XLSX.utils.sheet_to_json(globalSheet);
            if (rows.length > 0) {
                selectedClassId = rows[0].selectedClassId || null;
                thresholds.lv2 = rows[0].petLevel2Threshold || 4;
                thresholds.lv3 = rows[0].petLevel3Threshold || 8;
                if (rows[0].mainTitle) {
                    localStorage.setItem(TITLE_KEY, rows[0].mainTitle);
                }
            }
        }

        const classesSheet = workbook.Sheets['Classes_勿动'];
        const classRows = classesSheet ? XLSX.utils.sheet_to_json(classesSheet) : [];
        classRows.forEach((row) => {
            const classId = row.id;
            const sanitized = (classId?.replace(/[^a-zA-Z0-9-]/g, '') || 'CLASS').substring(0, 12);
            classes[classId] = ensureClassStructure({
                id: classId,
                name: row.name || '未命名班级',
                dailyGoal: row.dailyGoal || '',
                students: [],
                groups: [],
                prizes: []
            });

            const studentsSheet = workbook.Sheets[`${sanitized}_Students_勿动`];
            if (studentsSheet) {
                const students = XLSX.utils.sheet_to_json(studentsSheet).map((student) => {
                    ensureStudentStructure(student);
                    if (student.totalRecitations && student.totalRecitations > 0) {
                        student.collectedPlants = Array(student.totalRecitations).fill('❤️');
                    } else if (!Array.isArray(student.collectedPlants)) {
                        student.collectedPlants = [];
                    }
                    return student;
                });
                classes[classId].students = students;
            }

            const groupsSheet = workbook.Sheets[`${sanitized}_Groups_勿动`];
            if (groupsSheet) {
                classes[classId].groups = XLSX.utils.sheet_to_json(groupsSheet);
            }

            const prizesSheet = workbook.Sheets[`${sanitized}_Prizes_勿动`];
            if (prizesSheet) {
                classes[classId].prizes = XLSX.utils.sheet_to_json(prizesSheet);
            }
        });

        if (!selectedClassId) {
            selectedClassId = Object.keys(classes)[0] || null;
        }

        return { classes, selectedClassId, thresholds };
    }

    function exportAllData() {
        if (typeof XLSX === 'undefined') {
            showToast('未找到 XLSX 库，无法导出。', 'error');
            return;
        }
        const entries = Object.entries(state.classes);
        const hasData = entries.some(([, cls]) => cls.students.length || cls.groups.length || cls.prizes.length);
        if (!hasData) {
            showToast('暂无数据可导出。', 'error');
            return;
        }
        try {
            const wb = XLSX.utils.book_new();
            const globalSettings = [{
                selectedClassId: state.selectedClassId,
                mainTitle: localStorage.getItem(TITLE_KEY) || '宠物屋',
                petLevel2Threshold: state.thresholds.lv2,
                petLevel3Threshold: state.thresholds.lv3
            }];
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(globalSettings), 'GlobalSettings_勿动');

            const classesInfo = entries.map(([id, cls]) => ({
                id,
                name: cls.name,
                dailyGoal: cls.dailyGoal || ''
            }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(classesInfo), 'Classes_勿动');

            entries.forEach(([classId, cls]) => {
                const sanitized = (classId.replace(/[^a-zA-Z0-9-]/g, '') || 'CLASS').substring(0, 12);
                if (cls.students.length) {
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cls.students), `${sanitized}_Students_勿动`);
                }
                if (cls.groups.length) {
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cls.groups), `${sanitized}_Groups_勿动`);
                }
                if (cls.prizes.length) {
                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cls.prizes), `${sanitized}_Prizes_勿动`);
                }
            });

            XLSX.writeFile(wb, `宠物屋完整数据_${new Date().toISOString().split('T')[0]}.xlsx`);
            showToast('数据已导出，请查看下载文件。');
        } catch (err) {
            console.error('导出失败:', err);
            showToast('导出失败，请查看控制台。', 'error');
        }
    }

    function showToast(message, variant = 'success') {
        const el = refs.toast;
        el.textContent = message;
        el.className = `admin-toast show ${variant}`;
        clearTimeout(showToast.timer);
        showToast.timer = setTimeout(() => el.classList.remove('show'), 2200);
    }
})();
