#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Modrinth翻译处理器
 */
class ModrinthTranslator {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.TRANSLATION_API_KEY;
    
    // 处理API URL配置
    let apiUrl = config.apiUrl || process.env.TRANSLATION_API_URL || 'https://api.openai.com/v1/chat/completions';
    
    // 如果只提供了基础URL，自动添加端点路径
    if (apiUrl && !apiUrl.includes('/chat/completions') && !apiUrl.includes('/v1/')) {
      apiUrl = apiUrl.replace(/\/$/, '') + '/v1/chat/completions';
    }
    
    this.apiUrl = apiUrl;
    this.model = config.model || process.env.TRANSLATION_MODEL || 'gpt-3.5-turbo';
    this.targetLanguages = this.parseLanguages(config.targetLanguages || process.env.TARGET_LANGUAGES || 'zh-CN,ja-JP,ko-KR,fr-FR,de-DE,es-ES');
    this.batchSize = config.batchSize || 10;
    this.delay = config.delay || 1200;
  }

  /**
   * 解析目标语言列表
   */
  parseLanguages(languagesStr) {
    return languagesStr.split(',').map(lang => lang.trim()).filter(lang => lang.length > 0);
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 调用翻译API
   * @param {string} text - 待翻译文本
   * @param {string} targetLang - 目标语言
   * @returns {Promise<string>} 翻译结果
   */
  async translateText(text, targetLang) {
    if (!this.apiKey) {
      throw new Error('Translation API key is required');
    }
    
    // 调试信息（仅在第一次调用时显示）
    if (!this.debugShown) {
      console.log(`🔧 API Config: ${this.apiUrl.replace(/\/[^\/]*$/, '/***')}`);
      console.log(`🤖 Model: ${this.model}`);
      this.debugShown = true;
    }

    // 语言名称映射
    const languageNames = {
      'zh-CN': 'Simplified Chinese',
      'ja-JP': 'Japanese',
      'ko-KR': 'Korean',
      'fr-FR': 'French',
      'de-DE': 'German',
      'es-ES': 'Spanish'
    };

    const langName = languageNames[targetLang] || targetLang;
    const prompt = `Please translate the following UI text to ${langName}. This is from the Modrinth application interface. Keep the original formatting, any HTML tags, and any placeholders like {variables}. Only return the translated text without quotes or explanations:

${text}`;

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error ${response.status} for "${text.substring(0, 30)}..."`);
        console.error(`🔗 URL: ${this.apiUrl}`);
        console.error(`📝 Response: ${errorText.substring(0, 500)}...`);
        throw new Error(`API Error ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`❌ JSON Parse Error for "${text.substring(0, 30)}..."`);
        console.error(`📝 Raw response: ${responseText.substring(0, 500)}...`);
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
      }
      let translatedText = data.choices[0]?.message?.content?.trim() || text;
      
      // 清理翻译结果
      translatedText = translatedText.replace(/^["']|["']$/g, '');
      
      return translatedText;
    } catch (error) {
      console.error(`Translation error for "${text.substring(0, 50)}..." to ${targetLang}:`, error.message);
      return text; // 返回原文作为备用
    }
  }

  /**
   * 批量翻译
   * @param {Array<string>} texts - 待翻译文本数组
   * @param {string} targetLang - 目标语言
   * @returns {Promise<Array<string>>} 翻译结果数组
   */
  async translateBatch(texts, targetLang) {
    const results = [];
    
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const batchNum = Math.floor(i / this.batchSize) + 1;
      const totalBatches = Math.ceil(texts.length / this.batchSize);
      
      console.log(`    🔄 Batch ${batchNum}/${totalBatches} (${batch.length} items)`);
      
      const batchResults = await Promise.all(
        batch.map(async (text, index) => {
          try {
            const result = await this.translateText(text, targetLang);
            console.log(`      ✓ ${i + index + 1}/${texts.length}: "${text.substring(0, 30)}..." → "${result.substring(0, 30)}..."`);
            return result;
          } catch (error) {
            console.error(`      ✗ ${i + index + 1}/${texts.length}: Failed to translate "${text.substring(0, 30)}..."`);
            return text;
          }
        })
      );
      
      results.push(...batchResults);
      
      // 添加延迟以避免API限制
      if (i + this.batchSize < texts.length) {
        console.log(`    ⏳ Waiting ${this.delay}ms...`);
        await this.sleep(this.delay);
      }
    }
    
    return results;
  }

  /**
   * 翻译整个数据集
   * @param {Object} translations - 翻译数据
   * @returns {Promise<Object>} 多语言翻译结果
   */
  async translateAll(translations) {
    const results = {};
    
    console.log(`🌍 Starting translation to ${this.targetLanguages.length} languages...`);
    
    for (const targetLang of this.targetLanguages) {
      console.log(`\n🎯 Translating to ${targetLang}...`);
      results[targetLang] = {};
      
      for (const [file, data] of Object.entries(translations)) {
        console.log(`  📄 Processing ${file}...`);
        const keys = Object.keys(data);
        const texts = Object.values(data);
        
        if (texts.length === 0) {
          console.log(`    ⚠️  No texts to translate in ${file}`);
          continue;
        }
        
        console.log(`    📝 Translating ${texts.length} strings...`);
        const translatedTexts = await this.translateBatch(texts, targetLang);
        
        // 重新组合键值对
        const translatedData = {};
        keys.forEach((key, index) => {
          translatedData[key] = translatedTexts[index];
        });
        
        results[targetLang][file] = translatedData;
        console.log(`    ✅ Completed ${file}: ${Object.keys(translatedData).length} translations`);
      }
    }
    
    return results;
  }

  /**
   * 应用翻译到Modrinth源码结构
   * @param {Object} translatedData - 翻译后的数据
   * @param {string} modrinthPath - Modrinth源码路径
   */
  async applyTranslations(translatedData, modrinthPath) {
    console.log('\n📁 Applying translations to Modrinth structure...');
    
    for (const [lang, langData] of Object.entries(translatedData)) {
      console.log(`\n🌍 Processing ${lang}...`);
      
      for (const [originalFile, data] of Object.entries(langData)) {
        // 确定目标文件路径
        const originalPath = path.join(modrinthPath, originalFile);
        const originalDir = path.dirname(originalPath);
        const fileName = path.basename(originalPath);
        
        // 创建目标语言目录
        const targetDir = originalDir.replace('/en-US/', `/${lang}/`);
        const targetFile = path.join(targetDir, fileName);
        
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
          console.log(`  📁 Created directory: ${path.relative(modrinthPath, targetDir)}`);
        }
        
        // 生成标准格式的翻译文件
        const formattedData = this.generateTranslationFile(data);
        
        try {
          fs.writeFileSync(targetFile, JSON.stringify(formattedData, null, 2), 'utf8');
          console.log(`  📄 Created: ${path.relative(modrinthPath, targetFile)} (${Object.keys(data).length} keys)`);
        } catch (error) {
          console.error(`  ❌ Error writing ${targetFile}:`, error.message);
        }
      }
    }
    
    console.log('\n🎉 Translation application completed!');
  }

  /**
   * 生成翻译后的文件结构
   * @param {Object} translatedData - 翻译后的数据
   * @returns {Object} 标准格式的翻译文件
   */
  generateTranslationFile(translatedData) {
    const result = {};
    
    Object.entries(translatedData).forEach(([key, value]) => {
      result[key] = {
        message: value
      };
    });
    
    return result;
  }

  /**
   * 生成翻译统计报告
   * @param {Object} results - 翻译结果
   * @param {Object} originalData - 原始数据
   */
  generateReport(results, originalData) {
    const report = {
      timestamp: new Date().toISOString(),
      languages: Object.keys(results),
      totalKeys: 0,
      filesProcessed: 0,
      languageStats: {}
    };
    
    // 计算总键数
    for (const [file, data] of Object.entries(originalData)) {
      report.totalKeys += Object.keys(data).length;
      report.filesProcessed++;
    }
    
    // 计算每种语言的统计
    for (const [lang, langData] of Object.entries(results)) {
      report.languageStats[lang] = {
        filesTranslated: Object.keys(langData).length,
        totalTranslations: 0
      };
      
      for (const [file, data] of Object.entries(langData)) {
        report.languageStats[lang].totalTranslations += Object.keys(data).length;
      }
    }
    
    return report;
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const inputFile = args[0] || 'modrinth-translations.json';
  const modrinthPath = args[1] || './modrinth-source';
  
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Input file not found: ${inputFile}`);
    console.error('Please run extract-modrinth-translations.js first');
    process.exit(1);
  }

  if (!fs.existsSync(modrinthPath)) {
    console.error(`❌ Modrinth source path not found: ${modrinthPath}`);
    process.exit(1);
  }
  
  console.log('🚀 Modrinth Translation Processor');
  console.log(`📥 Input file: ${inputFile}`);
  console.log(`📂 Modrinth path: ${modrinthPath}`);
  
  const extractedData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const translations = extractedData.details || extractedData;
  
  console.log(`📊 Found ${Object.keys(translations).length} files with translations`);
  
  const translator = new ModrinthTranslator();
  
  try {
    const results = await translator.translateAll(translations);
    await translator.applyTranslations(results, modrinthPath);
    
    // 生成报告
    const report = translator.generateReport(results, translations);
    const reportFile = path.join(path.dirname(inputFile), 'translation-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log('\n✅ Modrinth translation completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`  Languages: ${report.languages.join(', ')}`);
    console.log(`  Files: ${report.filesProcessed}`);
    console.log(`  Total keys: ${report.totalKeys}`);
    console.log(`  Report: ${reportFile}`);
    
    // 显示语言统计
    console.log('\n📈 Language Statistics:');
    for (const [lang, stats] of Object.entries(report.languageStats)) {
      console.log(`  ${lang}: ${stats.totalTranslations} translations in ${stats.filesTranslated} files`);
    }
    
  } catch (error) {
    console.error('❌ Translation failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ModrinthTranslator, main };