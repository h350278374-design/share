# 萌宠分享 - 小猫小狗照片分享网站

一个基于Netlify的静态宠物照片分享平台，支持用户注册、上传照片、积分系统和AI智能审核。

## 功能特性

✅ **用户系统**
- 注册账号（字母+数字组合，6位以上密码）
- 用户登录/登出
- 密码修改功能
- 后台密码重置

✅ **积分系统**
- 上传照片获得1积分
- 下载照片消耗1积分
- 实时积分显示

✅ **AI智能审核**
- 自动识别猫/狗照片
- 置信度检测
- 审核结果提示

✅ **照片管理**
- 照片上传和展示
- 猫/狗分类筛选
- 照片详情查看
- 后台管理审核

✅ **社交功能**
- 显示QQ交流群号：10767900955
- 群二维码展示
- 用户统计信息

## 技术栈

- **前端**: HTML5 + CSS3 + JavaScript (Vanilla JS)
- **后端**: Netlify Serverless Functions
- **数据库**: Netlify KV Storage
- **部署**: Netlify CI/CD
- **AI识别**: 模拟AI API（可替换为真实API）

## 部署步骤

### 1. 准备工作

- 注册 [Netlify](https://www.netlify.com/) 账号
- 安装 [Git](https://git-scm.com/)
- （可选）准备QQ群二维码图片 `public/images/qq-qr.png`

### 2. 部署到Netlify

#### 方法一：通过GitHub部署（推荐）

1. **创建GitHub仓库**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/pet-photo-share.git
   git push -u origin main
   ```

2. **连接Netlify**
   - 登录Netlify
   - 点击 "Add new site" → "Import an existing project"
   - 选择GitHub并授权
   - 选择你的仓库 `pet-photo-share`
   - 配置构建设置：
     - Build command: 留空（这是静态站点）
     - Publish directory: `public`
   - 点击 "Deploy site"

3. **配置环境变量**
   - 进入 "Site settings" → "Build & deploy" → "Environment"
   - 点击 "Edit variables"
   - 添加变量（稍后会创建KV数据库）

#### 方法二：拖拽部署（简单）

1. **打包项目**
   ```bash
   # 确保所有文件都在正确位置
   # 直接拖拽 public 文件夹和 netlify.toml 到Netlify
   ```

2. **拖拽上传**
   - 登录Netlify
   - 拖拽项目文件夹到部署区域
   - 等待部署完成

### 3. 配置KV数据库

1. **创建KV数据库**
   - 进入Netlify后台
   - 点击 "Enable Netlify KV"
   - 创建新的KV数据库
   - 记下数据库URL和Token

2. **配置环境变量**
   在Netlify后台的 "Environment variables" 中添加：
   ```
   KV_REST_API_URL = your_kv_rest_api_url
   KV_REST_API_TOKEN = your_kv_rest_api_token
   ```

3. **重新部署**
   - 配置完环境变量后，触发重新部署
   - 点击 "Deploys" → "Trigger deploy" → "Deploy site"

### 4. 配置AI审核（可选）

项目使用模拟AI审核，如果要使用真实AI服务：

1. **选择AI服务**
   - Google Vision API
   - Azure Computer Vision
   - 或其他图像识别API

2. **修改代码**
   编辑 `netlify/functions/photos.js` 中的 `checkPetImage` 函数：
   ```javascript
   // 替换模拟代码为真实API调用
   const response = await fetch('YOUR_AI_API_ENDPOINT', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${process.env.AI_API_KEY}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({ imageUrl })
   });
   ```

3. **添加环境变量**
   ```
   AI_API_KEY = your_ai_api_key
   ```

### 5. 配置管理员账号

1. **首次注册管理员账号**
   - 访问网站
   - 注册账号 `admin`（或你喜欢的管理员账号）
   - 记下密码

2. **设置管理员权限**
   - 修改 `public/js/app.js` 中的管理员判断逻辑：
   ```javascript
   if (currentUser.username === 'admin') {
     navAdmin.style.display = 'block';
   }
   ```
   - 重新部署

### 6. 自定义配置

#### 修改QQ群信息
编辑 `public/index.html`：
```html
<!-- 找到以下代码并修改 -->
<p><i class="fab fa-qq"></i> 群号：<strong>10767900955</strong></p>
```

#### 替换QQ二维码
1. 准备你的QQ群二维码图片
2. 保存为 `public/images/qq-qr.png`
3. 重新部署

#### 修改品牌信息
编辑 `public/index.html`：
```html
<!-- Logo和标题 -->
<a href="#" class="logo">
  <i class="fas fa-paw"></i>
  <span>萌宠分享</span>  <!-- 修改这里 -->
</a>
```

## 目录结构

```
pet-photo-share/
├── public/                     # 静态文件
│   ├── index.html             # 主页面
│   ├── css/
│   │   └── style.css          # 样式文件
│   ├── js/
│   │   └── app.js             # 前端JavaScript
│   └── images/
│       └── qq-qr.png          # QQ群二维码（可选）
├── netlify/
│   └── functions/             # 云函数
│       ├── auth.js            # 用户认证
│       ├── photos.js          # 照片管理
│       └── stats.js           # 统计信息
├── netlify.toml               # Netlify配置
├── package.json               # 项目配置
└── README.md                  # 说明文档
```

## 环境变量

需要配置的环境变量：

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `KV_REST_API_URL` | Netlify KV数据库URL | ✅ |
| `KV_REST_API_TOKEN` | Netlify KV数据库Token | ✅ |
| `AI_API_KEY` | AI图像识别API密钥（可选） | ❌ |

## 使用说明

### 用户注册
1. 点击右上角"登录"按钮
2. 切换到"注册"标签
3. 输入账号（字母+数字）和密码（6位以上）
4. 点击注册

### 上传照片
1. 登录账号
2. 点击"上传照片"菜单
3. 选择照片文件（JPG/PNG，最大10MB）
4. 填写标题和介绍
5. 选择宠物类型（猫/狗）
6. 点击上传
7. 等待AI审核（约2-3秒）
8. 审核通过后获得1积分

### 下载照片
1. 登录账号
2. 浏览萌宠图库
3. 点击照片查看详情
4. 点击"下载"按钮
5. 消耗1积分并下载照片

### 修改密码
1. 登录账号
2. 进入"个人中心"
3. 切换到"账号设置"标签
4. 输入原密码和新密码
5. 点击"修改密码"

### 管理员功能
1. 使用管理员账号登录
2. 点击"后台管理"菜单
3. 可以管理用户和审核照片

## 积分规则

- **上传照片**: +1积分（AI审核通过后）
- **下载照片**: -1积分
- **初始积分**: 0积分

## AI审核说明

当前使用模拟AI审核系统，实际项目中可以替换为：

1. **Google Vision API**
   - 检测标签："cat", "dog", "pet"
   - 置信度阈值：>0.7

2. **Azure Computer Vision**
   - 使用物体检测功能
   - 识别猫狗类别

3. **自训练模型**
   - 使用TensorFlow.js
   - 训练专门的猫狗识别模型

## 常见问题

### 1. 部署后无法注册/登录？
检查环境变量 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN` 是否配置正确。

### 2. AI审核总是失败？
这是模拟系统，实际项目中需要配置真实AI API。

### 3. 如何重置用户密码？
在后台管理中，点击用户旁边的"重置密码"按钮，密码将重置为账号名。

### 4. 如何添加更多管理员？
修改 `public/js/app.js` 中的管理员判断逻辑，添加更多管理员账号名。

### 5. 图片上传大小限制？
当前限制为10MB，可以在 `public/js/app.js` 中修改：
```javascript
if (file.size > 10 * 1024 * 1024) { // 修改这里的数值 }
```

## 技术支持

如有问题，请加入QQ交流群：**10767900955**

## 许可证

MIT License - 可自由使用和修改
