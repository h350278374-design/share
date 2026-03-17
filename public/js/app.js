// 全局变量
let currentUser = null;
let currentPage = 'home';
let isUploading = false; // 防止重复上传标志
let isLoadingGallery = false; // 防止重复加载图库标志
let lastGalleryLoadTime = 0; // 上次加载图库的时间
let galleryCache = {}; // 图库数据缓存
const GALLERY_CACHE_TIME = 30000; // 缓存30秒

// 初始化
document.addEventListener('DOMContentLoaded', function() {
  checkAuth();
  initEventListeners();
  syncAndLoadStats();
  // 注意：不要在初始化时加载图库，等用户切换到图库页面时再加载
});

// 同步并加载统计数据
async function syncAndLoadStats() {
  try {
    // 先同步统计
    await apiCall('/api/photos?action=sync-stats', 'POST', {});
  } catch (error) {
    console.error('同步统计失败:', error);
  }
  // 然后加载显示
  loadHomeStats();
}

// 检查登录状态
function checkAuth() {
  const userData = localStorage.getItem('currentUser');
  if (userData) {
    currentUser = JSON.parse(userData);
    updateUI();
  }
}

// 更新UI状态
function updateUI() {
  const navNotLogged = document.getElementById('nav-not-logged');
  const navLogged = document.getElementById('nav-logged');
  const navAdminLink = document.getElementById('nav-admin-link');
  const userPoints = document.getElementById('user-points');
  const usernameDisplay = document.getElementById('username-display');
  const uploadLoginRequired = document.getElementById('upload-login-required');
  
  if (currentUser) {
    // 已登录状态
    if (navNotLogged) navNotLogged.style.display = 'none';
    if (navLogged) navLogged.style.display = 'flex';
    if (userPoints) userPoints.textContent = currentUser.points || 0;
    if (usernameDisplay) usernameDisplay.textContent = currentUser.username;
    
    if (uploadLoginRequired) {
      uploadLoginRequired.style.display = 'none';
    }
    
    // 显示管理员菜单
    if (navAdminLink && currentUser.username === 'admin') {
      navAdminLink.style.display = 'block';
    }
  } else {
    // 未登录状态
    if (navNotLogged) navNotLogged.style.display = 'block';
    if (navLogged) navLogged.style.display = 'none';
    
    if (uploadLoginRequired) {
      uploadLoginRequired.style.display = 'block';
    }
  }
}

// 切换用户下拉菜单
function toggleUserMenu() {
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown) {
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  }
}

// 点击页面其他地方关闭下拉菜单
document.addEventListener('click', function(e) {
  const userMenu = document.querySelector('.user-menu');
  const dropdown = document.getElementById('user-dropdown');
  if (userMenu && dropdown && !userMenu.contains(e.target)) {
    dropdown.style.display = 'none';
  }
});

// 初始化事件监听器
function initEventListeners() {
  console.log('初始化事件监听器...');
  
  // 导航链接
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const href = this.getAttribute('href').substring(1);
      showPage(href);
    });
  });
  
  // 登录/注册按钮 - 使用事件委托，确保动态显示的元素也能绑定事件
  document.addEventListener('click', function(e) {
    const loginBtn = e.target.closest('#login-btn');
    if (loginBtn) {
      e.preventDefault();
      e.stopPropagation();
      showLoginModal();
    }
  });
  
  // 认证弹窗
  initAuthModal();
  
  // 上传表单
  initUploadForm();
  
  // 图库过滤
  initGalleryFilters();
  
  // 个人中心标签
  initProfileTabs();
  
  // 后台管理标签
  initAdminTabs();
  
  // 密码修改表单
  initPasswordForm();
  
  // 拖拽上传
  initDragAndDrop();
  
  // 修改密码弹窗表单
  initChangePasswordModalForm();
}

// 显示页面
function showPage(pageName) {
  console.log('切换到页面:', pageName, '当前页面:', currentPage);
  
  // 隐藏所有页面
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  
  // 移除导航激活状态
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.classList.remove('active');
  });
  
  // 显示目标页面
  const targetPage = document.getElementById(pageName);
  if (targetPage) {
    targetPage.classList.add('active');
    currentPage = pageName;
    
    // 更新导航激活状态
    const navLink = document.querySelector(`a[href="#${pageName}"]`);
    if (navLink) {
      navLink.classList.add('active');
    }
    
    // 加载页面数据
    if (pageName === 'gallery') {
      loadGallery();
    } else if (pageName === 'profile') {
      loadProfile();
    } else if (pageName === 'admin') {
      loadAdminData();
    } else if (pageName === 'home') {
      loadHomeStats();
    }
  }
}

// 显示登录弹窗
function showLoginModal() {
  const modal = document.getElementById('auth-modal');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginTab = document.querySelector('.auth-tab[data-auth="login"]');
  const registerTab = document.querySelector('.auth-tab[data-auth="register"]');
  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');
  
  // 重置表单和错误信息
  if (loginForm) loginForm.reset();
  if (registerForm) registerForm.reset();
  if (loginError) loginError.textContent = '';
  if (registerError) registerError.textContent = '';
  
  // 显示登录界面
  modal.classList.add('active');
  loginForm.style.display = 'block';
  registerForm.style.display = 'none';
  loginTab.classList.add('active');
  registerTab.classList.remove('active');
}

// 初始化认证弹窗
function initAuthModal() {
  const modal = document.getElementById('auth-modal');
  
  // 关闭弹窗
  modal.querySelector('.modal-close').addEventListener('click', function() {
    modal.classList.remove('active');
  });
  
  // 点击背景关闭
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
  
  // 切换登录/注册
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      const authType = this.getAttribute('data-auth');
      
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      if (authType === 'login') {
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('register-form').style.display = 'none';
      } else {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
      }
    });
  });
  
  // 登录表单
  document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    const submitBtn = this.querySelector('button[type="submit"]');
    
    if (!username || !password) {
      errorDiv.textContent = '请输入账号和密码';
      return;
    }
    
    errorDiv.textContent = '';
    
    // 调试信息
    console.log('登录请求:', { username, passwordLength: password.length });
    
    // 禁用按钮防止重复提交
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '登录中...';
    }
    
    try {
      const response = await apiCall('/api/auth?action=login', 'POST', { username, password });
      
      console.log('登录响应:', response);
      
      if (response.error) {
        errorDiv.textContent = response.error;
        return;
      }
      
      currentUser = response.user;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      
      modal.classList.remove('active');
      showToast('登录成功！');
      updateUI();
      
      // 清空表单
      this.reset();
      
    } catch (error) {
      errorDiv.textContent = '登录失败，请稍后重试';
      console.error('登录错误:', error);
    } finally {
      // 恢复按钮状态
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '登录';
      }
    }
  });
  
  // 注册表单
  document.getElementById('register-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;
    const errorDiv = document.getElementById('register-error');
    const submitBtn = this.querySelector('button[type="submit"]');
    
    errorDiv.textContent = '';
    
    // 验证账号格式（admin账号除外）
    if (username.toLowerCase() !== 'admin') {
      const usernameRegex = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]+$/;
      if (!usernameRegex.test(username)) {
        errorDiv.textContent = '账号必须为字母加数字组合（如：user123）';
        return;
      }
    }
    
    if (password !== confirmPassword) {
      errorDiv.textContent = '两次输入的密码不一致';
      return;
    }
    
    if (password.length < 6) {
      errorDiv.textContent = '密码不少于6位';
      return;
    }
    
    // 调试信息
    console.log('注册请求:', { username, passwordLength: password.length });
    
    // 禁用按钮防止重复提交
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '注册中...';
    }
    
    try {
      const response = await apiCall('/api/auth?action=register', 'POST', { username, password });
      
      console.log('注册响应:', response);
      
      if (response.error) {
        errorDiv.textContent = response.error;
        return;
      }
      
      showToast('注册成功！请登录');
      
      // 切换到登录表单
      document.querySelector('.auth-tab[data-auth="login"]').click();
      document.getElementById('login-username').value = username;
      document.getElementById('login-password').value = '';
      document.getElementById('login-password').focus();
      
      // 清空注册表单
      this.reset();
      
    } catch (error) {
      errorDiv.textContent = '注册失败，请稍后重试';
      console.error('注册错误:', error);
    } finally {
      // 恢复按钮状态
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '注册';
      }
    }
  });
}

// 登出
function logout() {
  currentUser = null;
  localStorage.removeItem('currentUser');
  
  // 清理用户下拉菜单状态
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown) {
    dropdown.style.display = 'none';
  }
  
  updateUI();
  showToast('已退出登录');
  showPage('home');
}

// 显示修改密码弹窗
function showChangePasswordModal() {
  document.getElementById('change-password-modal').classList.add('active');
}

// 初始化修改密码表单
function initChangePasswordModalForm() {
  const form = document.getElementById('change-password-modal-form');
  if (!form) return;
  
  form.onsubmit = async function(e) {
    e.preventDefault();
    
    if (!currentUser) {
      showToast('请先登录', 'error');
      return;
    }
    
    const oldPassword = document.getElementById('modal-old-password').value;
    const newPassword = document.getElementById('modal-new-password').value;
    const confirmPassword = document.getElementById('modal-confirm-password').value;
    const errorDiv = document.getElementById('change-password-error');
    
    errorDiv.textContent = '';
    
    if (newPassword !== confirmPassword) {
      errorDiv.textContent = '两次输入的新密码不一致';
      return;
    }
    
    if (newPassword.length < 6) {
      errorDiv.textContent = '新密码不少于6位';
      return;
    }
    
    try {
      const response = await apiCall('/api/auth?action=change-password', 'POST', {
        username: currentUser.username,
        oldPassword,
        newPassword
      });
      
      if (response.error) {
        errorDiv.textContent = response.error;
      } else {
        showToast('密码修改成功！');
        closeModal('change-password-modal');
        form.reset();
      }
    } catch (error) {
      errorDiv.textContent = '修改密码失败，请稍后重试';
      console.error('修改密码错误:', error);
    }
  };
}

// 初始化上传表单
function initUploadForm() {
  const uploadArea = document.getElementById('upload-area');
  const photoInput = document.getElementById('photo-input');
  const uploadForm = document.getElementById('upload-form');
  
  if (!uploadArea || !photoInput || !uploadForm) {
    console.log('上传表单元素未找到，将在页面显示时初始化');
    return;
  }
  
  const petTypeGroup = document.getElementById('pet-type-group');
  const sectionHint = document.getElementById('section-hint');
  const aiCheckingText = document.getElementById('ai-checking-text');
  
  // 点击上传区域 - 使用更可靠的事件绑定
  uploadArea.onclick = function(e) {
    // 防止事件冒泡导致重复触发
    if (e.target === uploadArea || e.target.closest('.upload-placeholder')) {
      photoInput.click();
    }
  };
  
  // 文件选择
  photoInput.onchange = function(e) {
    const file = e.target.files[0];
    if (file) {
      previewImage(file);
    }
  };
  
  // 上传区域选择
  const uploadSectionRadios = document.querySelectorAll('input[name="upload-section"]');
  uploadSectionRadios.forEach(radio => {
    radio.onchange = function() {
      const section = this.value;
      
      if (section === 'daily') {
        // 日常分享区，隐藏宠物类型选择
        if (petTypeGroup) petTypeGroup.style.display = 'none';
        if (sectionHint) sectionHint.textContent = '日常分享区可以上传任意类型的照片';
      } else {
        // 萌宠专区，显示宠物类型选择
        if (petTypeGroup) petTypeGroup.style.display = 'block';
        if (sectionHint) sectionHint.textContent = '萌宠专区只能上传包含猫或狗的照片';
      }
    };
  });
  
  // 表单提交
  uploadForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // 防止重复提交
    if (isUploading) {
      console.log('正在上传中，请勿重复提交');
      return;
    }
    
    if (!currentUser) {
      showToast('请先登录后再上传', 'error');
      return;
    }
    
    // 设置上传标志
    isUploading = true;
    
    const title = document.getElementById('photo-title').value;
    const description = document.getElementById('photo-desc').value;
    const uploadSection = document.querySelector('input[name="upload-section"]:checked').value;
    const petType = uploadSection === 'pet' ? document.querySelector('input[name="pet-type"]:checked').value : 'daily';
    const imageUrl = document.getElementById('upload-preview').src;
    
    if (!imageUrl || imageUrl === '') {
      showToast('请先选择照片', 'error');
      return;
    }
    
    const submitBtn = document.getElementById('upload-submit');
    const statusDiv = document.getElementById('upload-status');
    const resultDiv = document.getElementById('upload-result');
    
    submitBtn.disabled = true;
    statusDiv.style.display = 'block';
    
    // 根据上传区域设置AI审核文字
    if (uploadSection === 'daily') {
      aiCheckingText.textContent = '正在处理照片...';
    } else {
      aiCheckingText.textContent = 'AI正在审核照片...';
    }
    
    resultDiv.style.display = 'none';
    
    try {
      const response = await apiCall('/api/photos?action=upload', 'POST', {
        username: currentUser.username,
        title,
        description,
        imageUrl,
        petType,
        uploadSection
      });
      
      statusDiv.style.display = 'none';
      
      if (response.error) {
        resultDiv.className = 'alert alert-error';
        resultDiv.textContent = response.error;
        resultDiv.style.display = 'block';
        
        if (response.aiCheck) {
          resultDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i> ${response.error}
            <br><small>置信度: ${(response.aiCheck.confidence * 100).toFixed(1)}%</small>
          `;
        }
      } else {
        resultDiv.className = 'alert alert-success';
        
        let successMessage = `${response.message}<br>获得1积分，当前积分：${currentUser.points + 1}`;
        
        if (response.photo.petType === 'cat') {
          successMessage += ' (猫咪)';
        } else if (response.photo.petType === 'dog') {
          successMessage += ' (狗狗)';
        } else if (response.photo.petType === 'daily') {
          successMessage += ' (日常分享)';
        }
        
        resultDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${successMessage}`;
        resultDiv.style.display = 'block';
        
        // 更新用户积分
        if (currentUser) {
          currentUser.points = (currentUser.points || 0) + 1;
          currentUser.uploads = (currentUser.uploads || 0) + 1;
          localStorage.setItem('currentUser', JSON.stringify(currentUser));
          updateUI();
        }
        
        // 刷新首页统计数据
        loadHomeStats();
        
        // 清空表单
        setTimeout(() => {
          uploadForm.reset();
          document.getElementById('upload-preview').style.display = 'none';
          document.querySelector('.upload-placeholder').style.display = 'block';
          if (petTypeGroup) petTypeGroup.style.display = 'block';
          if (sectionHint) sectionHint.textContent = '萌宠专区只能上传包含猫或狗的照片';
          resultDiv.style.display = 'none';
        }, 3000);
      }
      
    } catch (error) {
      console.error('上传错误:', error);
      statusDiv.style.display = 'none';
      resultDiv.className = 'alert alert-error';
      resultDiv.textContent = '上传失败，请稍后重试';
      resultDiv.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      // 重置上传标志
      isUploading = false;
    }
  });
}

// 预览图片
function previewImage(file) {
  if (!file.type.startsWith('image/')) {
    showToast('请选择图片文件', 'error');
    return;
  }
  
  if (file.size > 10 * 1024 * 1024) {
    showToast('图片大小不能超过10MB', 'error');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('upload-preview');
    const placeholder = document.querySelector('.upload-placeholder');
    
    preview.src = e.target.result;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// 初始化拖拽上传
function initDragAndDrop() {
  const uploadArea = document.getElementById('upload-area');
  
  if (!uploadArea) {
    console.log('上传区域未找到');
    return;
  }
  
  // 阻止默认拖拽行为
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, function(e) {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });
  
  // 拖拽进入和悬停效果
  ['dragenter', 'dragover'].forEach(eventName => {
    uploadArea.addEventListener(eventName, function() {
      uploadArea.classList.add('dragover');
    }, false);
  });
  
  // 拖拽离开和放置
  ['dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, function() {
      uploadArea.classList.remove('dragover');
    }, false);
  });
  
  // 处理放置的文件
  uploadArea.addEventListener('drop', function(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        previewImage(file);
      } else {
        showToast('请选择图片文件', 'error');
      }
    }
  }, false);
}

// 初始化图库过滤
function initGalleryFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      const filter = this.getAttribute('data-filter');
      loadGallery(filter);
    });
  });
}

// 加载图库
async function loadGallery(filter = 'all', forceRefresh = false) {
  // 防止重复加载
  if (isLoadingGallery) {
    console.log('图库正在加载中，跳过重复请求');
    return;
  }
  
  const now = Date.now();
  
  // 检查缓存
  if (!forceRefresh && galleryCache[filter]) {
    const cacheAge = now - galleryCache[filter].timestamp;
    if (cacheAge < GALLERY_CACHE_TIME) {
      console.log('使用缓存的图库数据');
      renderGallery(galleryCache[filter].data);
      return;
    }
  }
  
  // 限制加载频率（1秒内不重复加载）
  if (now - lastGalleryLoadTime < 1000) {
    console.log('图库加载过于频繁，跳过');
    return;
  }
  
  isLoadingGallery = true;
  lastGalleryLoadTime = now;
  
  const grid = document.getElementById('photo-grid');
  const loading = document.getElementById('gallery-loading');
  
  if (!grid) {
    isLoadingGallery = false;
    return;
  }
  
  // 显示加载状态，但保留旧内容直到新内容加载完成
  if (loading) loading.style.display = 'block';
  
  try {
    const response = await apiCall(`/api/photos?action=list&filter=${filter}`, 'GET');
    
    if (loading) loading.style.display = 'none';
    
    if (response.photos) {
      // 缓存数据
      galleryCache[filter] = {
        data: response.photos,
        timestamp: now
      };
      
      renderGallery(response.photos);
    }
    
  } catch (error) {
    if (loading) loading.style.display = 'none';
    // 如果有缓存数据，显示缓存而不是错误
    if (galleryCache[filter]) {
      renderGallery(galleryCache[filter].data);
    } else {
      grid.innerHTML = '<div class="loading"><i class="fas fa-exclamation-triangle"></i><p>加载失败，请稍后重试</p></div>';
    }
    console.error('加载图库错误:', error);
  } finally {
    isLoadingGallery = false;
  }
}

// 渲染图库
function renderGallery(photos) {
  const grid = document.getElementById('photo-grid');
  
  if (!grid) return;
  
  grid.innerHTML = '';
  
  if (photos.length > 0) {
    // 使用 DocumentFragment 批量添加，减少重绘
    const fragment = document.createDocumentFragment();
    photos.forEach(photo => {
      const photoCard = createPhotoCard(photo);
      fragment.appendChild(photoCard);
    });
    grid.appendChild(fragment);
  } else {
    grid.innerHTML = '<div class="loading"><i class="fas fa-images"></i><p>暂无照片，快来上传第一张吧！</p></div>';
  }
}

// 创建照片卡片
function createPhotoCard(photo) {
  const card = document.createElement('div');
  card.className = 'photo-card';
  card.onclick = () => showPhotoDetail(photo);
  
  let petTypeIcon, petTypeColor, petTypeText;
  
  if (photo.petType === 'cat') {
    petTypeIcon = 'fa-cat';
    petTypeColor = 'cat';
    petTypeText = '猫咪';
  } else if (photo.petType === 'dog') {
    petTypeIcon = 'fa-dog';
    petTypeColor = 'dog';
    petTypeText = '狗狗';
  } else if (photo.petType === 'daily') {
    petTypeIcon = 'fa-images';
    petTypeColor = 'daily';
    petTypeText = '日常';
  } else {
    petTypeIcon = 'fa-image';
    petTypeColor = 'daily';
    petTypeText = '其他';
  }
  
  const likes = photo.likes || 0;
  const comments = photo.comments || 0;
  
  card.innerHTML = `
    <div class="photo-card-image">
      <img data-src="${photo.imageUrl}" alt="${photo.title}" class="lazy-img">
      <div class="photo-card-stats">
        <span class="stat-item"><i class="fas fa-heart"></i> ${likes}</span>
        <span class="stat-item"><i class="fas fa-comment"></i> ${comments}</span>
      </div>
    </div>
    <div class="photo-card-info">
      <div class="photo-card-title">${photo.title}</div>
      <div class="photo-card-meta">
        <span><i class="fas fa-user"></i> ${photo.username}</span>
        <span class="photo-card-type ${petTypeColor}">
          <i class="fas ${petTypeIcon}"></i> ${petTypeText}
        </span>
      </div>
    </div>
  `;
  
  return card;
}

// 当前查看的照片
let currentPhoto = null;

// 显示照片详情
function showPhotoDetail(photo) {
  const modal = document.getElementById('photo-modal');
  currentPhoto = photo;
  
  document.getElementById('detail-image').src = photo.imageUrl;
  document.getElementById('detail-title').textContent = photo.title;
  document.getElementById('detail-desc').textContent = photo.description;
  document.getElementById('detail-uploader').textContent = photo.username;
  document.getElementById('detail-date').textContent = formatDate(photo.createdAt);
  document.getElementById('like-count').textContent = photo.likes || 0;
  
  let petTypeIcon, petTypeColor, petTypeText;
  
  if (photo.petType === 'cat') {
    petTypeIcon = 'fa-cat';
    petTypeColor = '#4ECDC4';
    petTypeText = '猫咪';
  } else if (photo.petType === 'dog') {
    petTypeIcon = 'fa-dog';
    petTypeColor = '#FF6B6B';
    petTypeText = '狗狗';
  } else if (photo.petType === 'daily') {
    petTypeIcon = 'fa-images';
    petTypeColor = '#9B59B6';
    petTypeText = '日常分享';
  } else {
    petTypeIcon = 'fa-image';
    petTypeColor = '#9B59B6';
    petTypeText = '其他';
  }
  
  document.getElementById('detail-type').innerHTML = `
    <span style="color: ${petTypeColor}">
      <i class="fas ${petTypeIcon}"></i> ${petTypeText}
    </span>
  `;
  
  const downloadBtn = document.getElementById('download-btn');
  downloadBtn.onclick = () => downloadPhoto(photo);
  downloadBtn.disabled = !currentUser;
  
  // 设置点赞按钮
  const likeBtn = document.getElementById('like-btn');
  likeBtn.onclick = () => toggleLike(photo);
  updateLikeButton(photo);
  
  // 设置删除按钮
  const deleteBtn = document.getElementById('delete-photo-btn');
  const canDelete = currentUser && (currentUser.username === photo.username || currentUser.username === 'admin');
  deleteBtn.style.display = canDelete ? 'inline-flex' : 'none';
  deleteBtn.onclick = () => deletePhoto(photo);
  
  // 设置评论区
  const commentForm = document.getElementById('comment-form');
  const commentLoginTip = document.getElementById('comment-login-tip');
  const commentToggleBtn = document.getElementById('comment-toggle-btn');
  
  // 默认隐藏评论表单
  if (commentForm) commentForm.style.display = 'none';
  
  if (currentUser) {
    if (commentLoginTip) commentLoginTip.style.display = 'none';
    if (commentToggleBtn) commentToggleBtn.style.display = 'inline-flex';
  } else {
    if (commentLoginTip) commentLoginTip.style.display = 'block';
    if (commentToggleBtn) commentToggleBtn.style.display = 'none';
  }
  
  // 加载评论
  loadComments(photo.id);
  
  if (!currentUser) {
    document.getElementById('download-status').textContent = '请先登录后再下载';
  } else {
    document.getElementById('download-status').textContent = '';
  }
  
  modal.classList.add('active');
  
  // 关闭弹窗
  modal.querySelector('.modal-close').onclick = () => modal.classList.remove('active');
  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.remove('active');
  };
}

// 下载照片
async function downloadPhoto(photo) {
  if (!currentUser) {
    showToast('请先登录后再下载', 'error');
    return;
  }
  
  if (currentUser.points < 1) {
    showToast('积分不足，需要1积分才能下载', 'error');
    return;
  }
  
  try {
    const response = await apiCall('/api/photos?action=download', 'POST', {
      photoId: photo.id,
      username: currentUser.username
    });
    
    if (response.error) {
      showToast(response.error, 'error');
      return;
    }
    
    // 更新用户积分
    currentUser.points = response.pointsRemaining;
    currentUser.downloads = (currentUser.downloads || 0) + 1;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    updateUI();
    
    // 刷新首页统计数据
    loadHomeStats();
    
    // 创建下载链接
    const link = document.createElement('a');
    link.href = response.imageUrl;
    link.download = `${photo.title}_${photo.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`下载成功！消耗1积分，剩余${response.pointsRemaining}积分`);
    
  } catch (error) {
    showToast('下载失败，请稍后重试', 'error');
    console.error('下载错误:', error);
  }
}

// 加载首页统计
async function loadHomeStats() {
  try {
    console.log('正在加载首页统计...');
    const response = await apiCall('/api/stats?action=get', 'GET');
    console.log('统计API响应:', response);
    
    if (response.totalPhotos !== undefined) {
      const totalPhotosEl = document.getElementById('total-photos');
      const totalDownloadsEl = document.getElementById('total-downloads');
      
      if (totalPhotosEl) {
        totalPhotosEl.textContent = response.totalPhotos;
      } else {
        console.warn('未找到 total-photos 元素');
      }
      
      if (totalDownloadsEl) {
        totalDownloadsEl.textContent = response.totalDownloads;
      } else {
        console.warn('未找到 total-downloads 元素');
      }
      
      console.log('统计数据已更新到页面:', {
        totalPhotos: response.totalPhotos,
        totalDownloads: response.totalDownloads
      });
    } else if (response.error) {
      console.error('统计API返回错误:', response.error);
    }
  } catch (error) {
    console.error('加载统计失败:', error);
  }
}

// 加载个人中心
async function loadProfile() {
  if (!currentUser) return;
  
  // 更新侧边栏信息
  document.getElementById('profile-username').textContent = currentUser.username;
  document.getElementById('profile-points').textContent = currentUser.points || 0;
  document.getElementById('profile-uploads').textContent = currentUser.uploads || 0;
  document.getElementById('profile-downloads').textContent = currentUser.downloads || 0;
  
  // 加载我的照片
  await loadMyPhotos();
}

// 加载我的照片
async function loadMyPhotos() {
  const grid = document.getElementById('my-photo-grid');
  grid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';
  
  try {
    const response = await apiCall('/api/photos?action=my-photos', 'POST', {
      username: currentUser.username
    });
    
    if (response.photos && response.photos.length > 0) {
      grid.innerHTML = '';
      response.photos.forEach(photo => {
        const photoCard = createPhotoCard(photo);
        grid.appendChild(photoCard);
      });
    } else {
      grid.innerHTML = '<div class="loading"><i class="fas fa-images"></i><p>你还没有上传照片</p></div>';
    }
    
  } catch (error) {
    grid.innerHTML = '<div class="loading"><i class="fas fa-exclamation-triangle"></i><p>加载失败，请稍后重试</p></div>';
    console.error('加载我的照片错误:', error);
  }
}

// 初始化个人中心标签
function initProfileTabs() {
  document.querySelectorAll('.profile-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      
      document.querySelectorAll('.profile-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      document.querySelectorAll('.profile-content .tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      document.getElementById(tabName).classList.add('active');
    });
  });
}

// 初始化密码修改表单
function initPasswordForm() {
  const form = document.getElementById('change-password-form');
  
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!currentUser) return;
    
    const oldPassword = document.getElementById('old-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (newPassword !== confirmPassword) {
      showToast('两次输入的新密码不一致', 'error');
      return;
    }
    
    if (newPassword.length < 6) {
      showToast('新密码不少于6位', 'error');
      return;
    }
    
    try {
      const response = await apiCall('/api/auth?action=change-password', 'POST', {
        username: currentUser.username,
        oldPassword,
        newPassword
      });
      
      if (response.error) {
        showToast(response.error, 'error');
      } else {
        showToast('密码修改成功！');
        form.reset();
      }
      
    } catch (error) {
      showToast('修改密码失败，请稍后重试', 'error');
      console.error('修改密码错误:', error);
    }
  });
}

// 初始化后台管理标签
function initAdminTabs() {
  document.querySelectorAll('.admin-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      
      document.querySelectorAll('.admin-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      document.querySelectorAll('.admin-container .tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      document.getElementById(tabName).classList.add('active');
      
      // 加载对应数据
      if (tabName === 'user-management') {
        loadUsers();
      } else if (tabName === 'photo-management') {
        loadAdminPhotos();
      }
    });
  });
}

// 加载后台用户数据
async function loadUsers() {
  const tbody = document.getElementById('user-table-body');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center"><i class="fas fa-spinner fa-spin"></i> 加载中...</td></tr>';
  
  try {
    // 这里简化处理，实际应该调用API获取用户列表
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">用户管理功能需要更高级的数据库查询支持</td></tr>';
  } catch (error) {
    console.error('加载用户列表错误:', error);
  }
}

// 加载后台照片数据
async function loadAdminPhotos() {
  const tbody = document.getElementById('photo-table-body');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center"><i class="fas fa-spinner fa-spin"></i> 加载中...</td></tr>';
  
  try {
    const response = await apiCall('/api/photos?action=admin-photos', 'GET');
    
    tbody.innerHTML = '';
    
    if (response.photos && response.photos.length > 0) {
      response.photos.forEach(photo => {
        const row = document.createElement('tr');
        
        const statusClass = photo.status === 'approved' ? 'status-approved' : 
                           photo.status === 'rejected' ? 'status-rejected' : 'status-pending';
        
        let typeText;
        if (photo.petType === 'cat') {
          typeText = '猫咪';
        } else if (photo.petType === 'dog') {
          typeText = '狗狗';
        } else if (photo.petType === 'daily') {
          typeText = '日常分享';
        } else {
          typeText = '其他';
        }
        
        row.innerHTML = `
          <td><img src="${photo.imageUrl}" alt="${photo.title}"></td>
          <td>${photo.title}</td>
          <td>${photo.username}</td>
          <td>${typeText}</td>
          <td><span class="status-badge ${statusClass}">${photo.status}</span></td>
          <td>
            ${photo.status === 'pending' ? `
              <button class="btn btn-primary" onclick="approvePhoto('${photo.id}')">批准</button>
              <button class="btn btn-outline" onclick="rejectPhoto('${photo.id}')">拒绝</button>
            ` : ''}
          </td>
        `;
        
        tbody.appendChild(row);
      });
    } else {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">暂无照片</td></tr>';
    }
    
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">加载失败</td></tr>';
    console.error('加载照片列表错误:', error);
  }
}

// 批准照片
async function approvePhoto(photoId) {
  try {
    const response = await apiCall('/api/photos?action=approve', 'POST', { photoId });
    showToast(response.message || '照片已批准');
    loadAdminPhotos();
  } catch (error) {
    showToast('操作失败，请稍后重试', 'error');
  }
}

// 拒绝照片
async function rejectPhoto(photoId) {
  try {
    const response = await apiCall('/api/photos?action=reject', 'POST', { photoId });
    showToast(response.message || '照片已拒绝');
    loadAdminPhotos();
  } catch (error) {
    showToast('操作失败，请稍后重试', 'error');
  }
}

// 加载后台数据
function loadAdminData() {
  loadAdminPhotos();
}

// API调用
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(endpoint, options);
  return await response.json();
}

// 显示提示消息
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const messageSpan = document.getElementById('toast-message');
  const icon = toast.querySelector('i');
  
  messageSpan.textContent = message;
  
  if (type === 'error') {
    toast.classList.add('error');
    icon.className = 'fas fa-exclamation-circle';
  } else {
    toast.classList.remove('error');
    icon.className = 'fas fa-check-circle';
  }
  
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// 关闭弹窗
function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

// 格式化日期
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// 搜索用户（后台管理）
function searchUsers() {
  const searchTerm = document.getElementById('user-search').value;
  loadUsers(searchTerm);
}

// 确认重置密码
let resetUsername = '';
function confirmResetPassword() {
  // 这里简化处理，实际应该调用API
  showToast(`密码已重置为: ${resetUsername}`);
  closeModal('reset-modal');
}

// 切换密码显示/隐藏
function togglePasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId);
  const icon = button.querySelector('i');
  
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

// 点赞功能
async function toggleLike(photo) {
  if (!currentUser) {
    showToast('请先登录后再点赞', 'error');
    return;
  }
  
  const likeBtn = document.getElementById('like-btn');
  const isLiked = likeBtn.classList.contains('liked');
  
  try {
    const action = isLiked ? 'unlike' : 'like';
    const response = await apiCall(`/api/photos?action=${action}`, 'POST', {
      photoId: photo.id,
      username: currentUser.username
    });
    
    if (response.error) {
      showToast(response.error, 'error');
      return;
    }
    
    // 更新点赞数显示
    document.getElementById('like-count').textContent = response.likes;
    
    // 更新按钮状态
    if (isLiked) {
      likeBtn.classList.remove('liked');
      likeBtn.innerHTML = '<i class="far fa-heart"></i> 点赞';
      showToast('已取消点赞');
    } else {
      likeBtn.classList.add('liked');
      likeBtn.innerHTML = '<i class="fas fa-heart"></i> 已点赞';
      showToast('点赞成功！');
    }
    
    // 更新当前照片的点赞数
    photo.likes = response.likes;
    
  } catch (error) {
    showToast('操作失败，请稍后重试', 'error');
    console.error('点赞错误:', error);
  }
}

// 更新点赞按钮状态
async function updateLikeButton(photo) {
  const likeBtn = document.getElementById('like-btn');
  
  if (!currentUser) {
    likeBtn.classList.remove('liked');
    likeBtn.innerHTML = '<i class="far fa-heart"></i> 点赞';
    return;
  }
  
  try {
    const response = await apiCall(`/api/photos?action=check-like&photoId=${photo.id}&username=${currentUser.username}`, 'GET');
    
    if (response.hasLiked) {
      likeBtn.classList.add('liked');
      likeBtn.innerHTML = '<i class="fas fa-heart"></i> 已点赞';
    } else {
      likeBtn.classList.remove('liked');
      likeBtn.innerHTML = '<i class="far fa-heart"></i> 点赞';
    }
  } catch (error) {
    console.error('检查点赞状态错误:', error);
  }
}

// 删除照片
async function deletePhoto(photo) {
  if (!currentUser) {
    showToast('请先登录', 'error');
    return;
  }
  
  // 检查权限
  if (currentUser.username !== photo.username && currentUser.username !== 'admin') {
    showToast('无权删除此照片', 'error');
    return;
  }
  
  if (!confirm('确定要删除这张照片吗？此操作不可恢复。')) {
    return;
  }
  
  try {
    const response = await apiCall('/api/photos?action=delete', 'POST', {
      photoId: photo.id,
      username: currentUser.username,
      isAdmin: currentUser.username === 'admin'
    });
    
    if (response.error) {
      showToast(response.error, 'error');
      return;
    }
    
    showToast('照片已删除');
    closeModal('photo-modal');
    
    // 刷新图库和首页统计
    loadGallery();
    loadHomeStats();
    
    // 如果在个人中心页面，刷新我的照片
    if (currentPage === 'profile') {
      loadMyPhotos();
    }
    
  } catch (error) {
    showToast('删除失败，请稍后重试', 'error');
    console.error('删除照片错误:', error);
  }
}

// 加载评论
async function loadComments(photoId) {
  const commentsList = document.getElementById('comments-list');
  commentsList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';
  
  try {
    const response = await apiCall(`/api/photos?action=get-comments&photoId=${photoId}`, 'GET');
    
    if (response.comments && response.comments.length > 0) {
      commentsList.innerHTML = '';
      response.comments.forEach(comment => {
        const commentEl = createCommentElement(comment);
        commentsList.appendChild(commentEl);
      });
    } else {
      commentsList.innerHTML = '<div class="loading"><i class="fas fa-comment-slash"></i> 暂无评论，快来抢沙发吧！</div>';
    }
  } catch (error) {
    commentsList.innerHTML = '<div class="loading"><i class="fas fa-exclamation-triangle"></i> 加载评论失败</div>';
    console.error('加载评论错误:', error);
  }
}

// 创建评论元素
function createCommentElement(comment) {
  const div = document.createElement('div');
  div.className = 'comment-item';
  
  const canDelete = currentUser && (currentUser.username === comment.username || currentUser.username === 'admin');
  
  div.innerHTML = `
    <div class="comment-header">
      <span class="comment-author">${comment.username}</span>
      <span class="comment-time">${formatDate(comment.created_at)}</span>
    </div>
    <div class="comment-content">${escapeHtml(comment.content)}</div>
    ${canDelete ? `<div class="comment-actions"><button onclick="deleteComment(${comment.id})"><i class="fas fa-trash"></i> 删除</button></div>` : ''}
  `;
  
  return div;
}

// 切换评论表单显示/隐藏
function toggleCommentForm() {
  const commentForm = document.getElementById('comment-form');
  const toggleBtn = document.getElementById('comment-toggle-btn');
  
  if (commentForm.style.display === 'none') {
    commentForm.style.display = 'flex';
    toggleBtn.innerHTML = '<i class="fas fa-times"></i> 取消';
  } else {
    commentForm.style.display = 'none';
    toggleBtn.innerHTML = '<i class="fas fa-comment"></i> 写评论';
  }
}

// 提交评论
async function submitComment() {
  if (!currentUser || !currentPhoto) {
    showToast('请先登录', 'error');
    return;
  }
  
  const input = document.getElementById('comment-input');
  const content = input.value.trim();
  
  if (!content) {
    showToast('请输入评论内容', 'error');
    return;
  }
  
  if (content.length > 500) {
    showToast('评论内容不能超过500字', 'error');
    return;
  }
  
  try {
    const response = await apiCall('/api/photos?action=add-comment', 'POST', {
      photoId: currentPhoto.id,
      username: currentUser.username,
      content: content
    });
    
    if (response.error) {
      showToast(response.error, 'error');
      return;
    }
    
    showToast('评论成功！');
    input.value = '';
    
    // 刷新评论列表
    loadComments(currentPhoto.id);
    
  } catch (error) {
    showToast('评论失败，请稍后重试', 'error');
    console.error('提交评论错误:', error);
  }
}

// 删除评论
async function deleteComment(commentId) {
  if (!currentUser) {
    showToast('请先登录', 'error');
    return;
  }
  
  if (!confirm('确定要删除这条评论吗？')) {
    return;
  }
  
  try {
    const response = await apiCall('/api/photos?action=delete-comment', 'POST', {
      commentId: commentId,
      username: currentUser.username,
      isAdmin: currentUser.username === 'admin'
    });
    
    if (response.error) {
      showToast(response.error, 'error');
      return;
    }
    
    showToast('评论已删除');
    
    // 刷新评论列表
    if (currentPhoto) {
      loadComments(currentPhoto.id);
    }
    
  } catch (error) {
    showToast('删除失败，请稍后重试', 'error');
    console.error('删除评论错误:', error);
  }
}

// HTML 转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 全局函数（供HTML调用）
window.showLoginModal = showLoginModal;
window.showPage = showPage;
window.closeModal = closeModal;
window.searchUsers = searchUsers;
window.confirmResetPassword = confirmResetPassword;
window.togglePasswordVisibility = togglePasswordVisibility;
window.toggleCommentForm = toggleCommentForm;

// 图片懒加载初始化
function initLazyLoad() {
  const lazyImages = document.querySelectorAll('.lazy-img');
  
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy-img');
          imageObserver.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px 0px'
    });
    
    lazyImages.forEach(img => imageObserver.observe(img));
  } else {
    // 浏览器不支持 IntersectionObserver，直接加载所有图片
    lazyImages.forEach(img => {
      img.src = img.dataset.src;
      img.classList.remove('lazy-img');
    });
  }
}

// 渲染图库后初始化懒加载
const originalRenderGallery = renderGallery;
renderGallery = function(photos) {
  originalRenderGallery(photos);
  initLazyLoad();
};
window.submitComment = submitComment;
window.deleteComment = deleteComment;
