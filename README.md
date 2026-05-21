# Timi · 私密日记

基于 **Flask + HTML5 + CSS3 + JavaScript** 的本地网页日记工具。仅在 `127.0.0.1` 运行，数据保存在本机 `data/` 目录，**不上传网络**，保护隐私。

## 功能

| 功能 | 说明 |
|------|------|
| 心情表情 | 预设表情 + 自定义，随日记保存 |
| 分类标签 | 标签库管理，给日记归类，支持筛选 |
| 密码加密 | PBKDF2 校验 + Fernet 加密正文 |
| 主题切换 | 浅色 / 深色，即时切换 |
| 导出备份 | 单篇或全部导出为 TXT |
| 历史列表 | 按更新时间排序，分页浏览 |
| 数据统计 | 总字数、篇数、书写天数、本篇实时字数 |

## 快速开始

```bash
# 1. 进入项目目录
cd w:\项目\riji\-timi

# 2. 安装依赖（建议虚拟环境）
pip install -r requirements.txt

# 3. 启动（仅本机访问）
python app.py
```

浏览器打开：**http://127.0.0.1:5000**

首次使用可选择「设置访问密码」或「暂不设置」直接进入；设置后日记正文会加密存入 `data/diaries.json`。

## 项目结构（模块化，便于扩展）

```
timi/
├── app.py              # 入口
├── config.py           # 配置
├── requirements.txt
├── routes/             # 路由层
│   ├── auth.py         # 登录 / 设密
│   ├── diary.py        # 日记 API
│   └── pages.py        # 页面
├── storage/            # 持久化 + 加密
│   ├── diary_store.py
│   └── crypto_util.py
├── templates/
│   └── index.html
├── static/
│   ├── css/main.css
│   └── js/             # api / auth / diary / app
└── data/               # 本地 JSON（自动生成）
    ├── meta.json
    └── diaries.json
```

## 隐私说明

- 服务只监听 `127.0.0.1`，不对外网开放
- 不使用任何第三方云存储或统计
- 启用密码后，日记正文以 Fernet 加密存储；会话中仅保留派生密钥用于加解密

## 二次开发提示

- 新增 API：在 `routes/diary.py` 增加路由，在 `storage/diary_store.py` 实现逻辑
- 新增前端模块：在 `static/js/` 添加文件并在 `index.html` 引入
- 调整分页数量：修改 `config.py` 中的 `DEFAULT_PAGE_SIZE`
