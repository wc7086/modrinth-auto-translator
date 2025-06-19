# 🚀 快速设置指南

## 立即开始构建多语言Modrinth App

### 1️⃣ Fork这个仓库

点击GitHub页面右上角的 **Fork** 按钮，将这个仓库Fork到你的账户。

### 2️⃣ 配置API密钥

在你Fork的仓库中设置GitHub Secrets：

1. 进入 `Settings` → `Secrets and variables` → `Actions`
2. 点击 `New repository secret`
3. 添加以下Secrets：

```
名称: TRANSLATION_API_KEY
值: sk-KUg443ee61e0c247cd2530b2b83695c40781b81b8f3stcV1

名称: TRANSLATION_API_URL  
值: https://api.gptsapi.net/v1/chat/completions
```

### 3️⃣ 触发构建

#### 方法A: 手动触发 (推荐)

1. 点击 `Actions` 标签页
2. 选择 `Auto Translate Modrinth App` 工作流
3. 点击 `Run workflow` 按钮
4. 设置参数：
   - **modrinth_tag**: `v0.8.2` (或其他版本)
   - **target_languages**: `zh-CN,ja-JP,ko-KR` (可选)
   - **skip_translation**: `false`
5. 点击绿色的 `Run workflow` 按钮

#### 方法B: 命令行触发

```bash
# 安装GitHub CLI
gh auth login

# 触发工作流
gh workflow run auto-translate-modrinth.yml \\
  -f modrinth_tag=v0.8.2 \\
  -f target_languages="zh-CN,ja-JP,ko-KR,fr-FR,de-DE,es-ES"
```

### 4️⃣ 等待构建完成

构建过程大约需要30-45分钟：

- ⏱️ **拉取源码**: 2-3分钟
- 🔍 **提取文本**: 1-2分钟  
- 🌍 **翻译处理**: 15-25分钟
- 🏗️ **构建应用**: 15-20分钟
- 📦 **创建发布**: 1-2分钟

你可以在 `Actions` 页面查看实时进度。

### 5️⃣ 下载多语言版本

构建完成后：

1. 进入 `Releases` 页面
2. 找到最新的发布版本（如 `Modrinth-Multilang-v0.8.2`）
3. 下载对应平台的文件：
   - **Windows**: `Modrinth-Multilang-*.exe`
   - **macOS**: `Modrinth-Multilang-*.dmg`
   - **Linux**: `Modrinth-Multilang-*.AppImage`

## 🎯 预期结果

你将获得包含以下语言的Modrinth App：

- 🇺🇸 English (原版)
- 🇨🇳 简体中文
- 🇯🇵 日本語  
- 🇰🇷 한국어
- 🇫🇷 Français
- 🇩🇪 Deutsch
- 🇪🇸 Español

## 🛠️ 高级配置

### 自定义目标语言

编辑 `configs/translation-config.json`：

```json
{
  "targetLanguages": ["zh-CN", "ja-JP", "ko-KR"],
  "batchSize": 10,
  "delay": 1200
}
```

### 调整翻译质量

修改API设置：

```json
{
  "model": "gpt-4",  // 使用更强的模型
  "batchSize": 5,    // 减少批量大小
  "delay": 2000      // 增加延迟
}
```

## 🐛 故障排除

### 构建失败？

1. **检查API密钥**: 确保Secrets配置正确
2. **查看日志**: 在Actions页面查看详细错误信息
3. **重试构建**: 点击 "Re-run failed jobs"

### 翻译质量问题？

1. **调整批量大小**: 减少`batchSize`到5-8
2. **增加延迟**: 将`delay`设置为2000ms
3. **使用GPT-4**: 设置`model`为`gpt-4`

### 某些文本没有翻译？

1. **检查过滤规则**: 查看`shouldTranslate`函数
2. **调整提取模式**: 修改正则表达式
3. **手动添加**: 在生成的翻译文件中手动添加

## 📞 获取帮助

- 🐛 **Bug报告**: [提交Issue](https://github.com/your-username/modrinth-auto-translator/issues)
- 💡 **功能建议**: [讨论区](https://github.com/your-username/modrinth-auto-translator/discussions)
- 📖 **文档**: 查看主README.md

---

🎉 **开始构建你的多语言Modrinth App吧！**