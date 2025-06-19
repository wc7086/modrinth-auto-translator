#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * 从Modrinth源码中提取需要翻译的文本
 */
class ModrinthTranslationExtractor {
  constructor(sourcePath) {
    this.sourcePath = sourcePath;
    this.translations = {};
  }

  /**
   * 从Vue文件中提取需要翻译的文本
   * @param {string} filePath - Vue文件路径
   * @returns {Object} 提取的翻译字段
   */
  extractFromVue(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const translations = {};
      const fileName = path.basename(filePath, '.vue');
      
      // 提取模板中的文本内容
      const templateRegex = /<template[^>]*>([\s\S]*?)<\/template>/i;
      const templateMatch = content.match(templateRegex);
      
      if (templateMatch) {
        const templateContent = templateMatch[1];
        
        // 提取各种文本模式
        const patterns = [
          // 双引号字符串中的文本
          /(?<![\w\/])\"([^\"]{2,50})\"/g,
          // 单引号字符串中的文本
          /(?<![\w\/])'([^']{2,50})'/g,
          // 标签之间的文本内容
          />([A-Za-z][^<>{}]{2,50}[A-Za-z])</g,
          // placeholder 属性
          /placeholder=['\"]([^'\"]{2,50})['\"]/g,
          // title 属性
          /title=['\"]([^'\"]{2,50})['\"]/g,
          // alt 属性
          /alt=['\"]([^'\"]{2,50})['\"]/g,
          // v-tooltip 属性
          /v-tooltip=['\"]([^'\"]{2,50})['\"]/g,
          // label 文本
          /<label[^>]*>([^<]{2,50})</g,
          // button 文本
          /<[Bb]utton[^>]*>([^<]{2,50})</g,
        ];
        
        let counter = 1;
        
        patterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(templateContent)) !== null) {
            const text = match[1].trim();
            
            // 过滤掉不需要翻译的内容
            if (this.shouldTranslate(text)) {
              const key = `${fileName}.text${counter}`;
              translations[key] = text;
              counter++;
            }
          }
        });
      }
      
      return translations;
    } catch (error) {
      console.error(`Error processing Vue file ${filePath}:`, error.message);
      return {};
    }
  }

  /**
   * 从JSON文件中提取需要翻译的字段
   * @param {string} filePath - JSON文件路径
   * @returns {Object} 提取的翻译字段
   */
  extractFromJson(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      const translations = {};
      
      function extractMessages(obj, prefix = '') {
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'object' && value !== null) {
            if (value.message) {
              // 这是一个翻译条目
              const fullKey = prefix ? `${prefix}.${key}` : key;
              translations[fullKey] = value.message;
            } else {
              // 递归处理嵌套对象
              const newPrefix = prefix ? `${prefix}.${key}` : key;
              extractMessages(value, newPrefix);
            }
          }
        }
      }
      
      extractMessages(data);
      return translations;
    } catch (error) {
      console.error(`Error processing JSON file ${filePath}:`, error.message);
      return {};
    }
  }

  /**
   * 判断文本是否需要翻译
   * @param {string} text - 文本内容
   * @returns {boolean} 是否需要翻译
   */
  shouldTranslate(text) {
    if (!text || text.length < 2 || text.length > 100) return false;
    
    // 过滤掉的内容
    const skipPatterns = [
      // URL和路径
      /^https?:\/\//,
      /^[\/\.]/,
      /^[a-z-]+$/,  // CSS类名
      /^<[^>]+>$/,  // HTML标签
      /^[a-z][a-zA-Z0-9_]*$/, // 变量名
      /^\d+$/,      // 纯数字
      /^[^a-zA-Z0-9\u4e00-\u9fa5]+$/, // 只包含特殊字符
      /^.$/,        // 单个字符
      
      // 技术术语
      /^(true|false|null|undefined|NaN|JSON|API|URL|ID|UUID|HTML|CSS|JS|npm|pnpm|yarn|vue|ref|computed|reactive|emit|props|slots|router|store|dev|prod|build|test|src|dist|public|assets|components|pages|views|utils|helpers|plugins|middleware|layouts|types|interfaces|enums|constants|config|env|local|session|storage|cache|token|auth|login|logout|admin|user|profile|settings|theme|dark|light|auto|modal|dropdown|tooltip|button|input|textarea|select|checkbox|radio|switch|slider|progress|loading|spinner|icon|image|avatar|badge|chip|card|table|list|grid|row|col|header|footer|sidebar|navbar|menu|tab|accordion|carousel|dialog|alert|snackbar|notification|breadcrumb|pagination|search|filter|sort|create|read|update|delete|crud|get|post|put|patch|delete|fetch|axios|http|ws|socket)$/i,
      
      // 颜色值和版本号
      /^#[0-9a-f]{3,6}$/i,
      /^v?\d+\.\d+/,
      
      // 模板语法
      /^{\s*\w+\s*}$/,
      /^{{\s*.*\s*}}$/,
      /^\s+$/,
      
      // CSS相关
      /^(flex|grid|block|inline|absolute|relative|fixed|sticky|hidden|visible|auto|none|center|left|right|top|bottom|start|end|between|around|evenly|stretch|baseline|nowrap|wrap|column|row|reverse)$/i,
      /^(sm|md|lg|xl|2xl|xs)$/,
      /^(mt|mb|ml|mr|mx|my|pt|pb|pl|pr|px|py|m|p)-\d+$/,
      /^(w|h|min-w|min-h|max-w|max-h)-/,
      /^(bg|text|border|shadow|ring)-.+$/,
      
      // 常见的非UI文本
      /^(px|rem|em|vh|vw|vmin|vmax|deg|rad|turn|s|ms|Hz|kHz)$/,
    ];
    
    // 必须翻译的内容 (包含实际单词)
    const mustTranslatePatterns = [
      // 包含中文
      /[\u4e00-\u9fa5]/,
      // 包含多个英文单词
      /\b[A-Za-z]+\s+[A-Za-z]+\b/,
      // 常见的UI文本模式
      /\b(Add|Create|Delete|Remove|Save|Cancel|OK|Yes|No|Confirm|Submit|Reset|Clear|Close|Open|Edit|Update|Refresh|Reload|Login|Logout|Sign in|Sign up|Register|Search|Filter|Sort|Upload|Download|Import|Export|Settings|Options|Preferences|Help|About|Contact|Home|Back|Next|Previous|Continue|Finish|Done|Complete|Error|Success|Warning|Info|Loading|Please|Select|Choose|Enter|Input|Required|Optional|Invalid|Valid|Failed|Retry|Try again|Welcome|Hello|Goodbye|Thank you|Sorry|Excuse me|Name|Email|Password|Username|Phone|Address|Install|Installed|Update|Available|Version|Latest|New|Old|Recent|Popular|Featured|Recommended|Trending|Hot|Best|Top|All|None|Any|Some|Many|Few|Several|First|Last|More|Less|Show|Hide|View|Preview|Download|Install|Play|Pause|Stop|Start|Run|Launch|Execute|Copy|Paste|Cut|Undo|Redo|Move|Rename|Duplicate|Share|Like|Favorite|Bookmark|Subscribe|Follow|Unfollow|Block|Report|Flag|Pin|Archive|Trash|Delete|Restore)(\s|$)/i,
      
      // 错误和状态消息
      /\b(loading|error|success|warning|info|notice|alert|message|notification|toast|modal|dialog|popup|tooltip|hint|tip|guide|tutorial|wizard|step|progress|status|state|condition|result|outcome|response|feedback|comment|review|rating|score|point|level|rank|grade|category|type|kind|sort|group|class|tag|label|mark|flag|badge|icon|symbol|sign|indicator|marker|pointer|cursor|arrow|direction|position|location|place|area|region|zone|section|part|piece|item|element|component|widget|control|field|input|output|data|info|content|text|message|title|header|footer|sidebar|navbar|menu|tab|page|screen|view|panel|pane|window|frame|border|edge|corner|center|middle|side|top|bottom|left|right|up|down|in|out|over|under|above|below|before|after|front|back|inside|outside|within|without|around|between|among|through|across|along|beside|next|near|far|close|open|wide|narrow|big|small|large|tiny|huge|mini|short|long|tall|high|low|deep|shallow|thick|thin|heavy|light|fast|slow|quick|rapid|instant|immediate|soon|late|early|now|then|today|tomorrow|yesterday|morning|afternoon|evening|night|day|week|month|year|hour|minute|second|time|date|schedule|calendar|timer|clock|watch|alarm|reminder|notification)(\s|$)/i,
    ];
    
    // 检查是否应该跳过
    if (skipPatterns.some(pattern => pattern.test(text))) {
      return false;
    }
    
    // 检查是否必须翻译
    if (mustTranslatePatterns.some(pattern => pattern.test(text))) {
      return true;
    }
    
    // 默认策略：包含字母但不是纯技术术语的文本
    return /[a-zA-Z]/.test(text) && !/^[a-z]+([A-Z][a-z]*)*$/.test(text) && text.split(' ').length <= 10;
  }

  /**
   * 扫描Modrinth源码并提取翻译
   * @returns {Object} 所有翻译数据
   */
  extractAllTranslations() {
    console.log(`🔍 Scanning Modrinth source: ${this.sourcePath}`);
    
    // 检查源码目录是否存在
    if (!fs.existsSync(this.sourcePath)) {
      throw new Error(`Modrinth source path not found: ${this.sourcePath}`);
    }
    
    // 调试：显示源码目录结构
    console.log(`📁 Source directory contents:`);
    try {
      const contents = fs.readdirSync(this.sourcePath);
      contents.forEach(item => {
        const itemPath = path.join(this.sourcePath, item);
        const stats = fs.statSync(itemPath);
        console.log(`  ${stats.isDirectory() ? '📁' : '📄'} ${item}`);
      });
      
      // 检查apps目录
      const appsPath = path.join(this.sourcePath, 'apps');
      if (fs.existsSync(appsPath)) {
        console.log(`📱 Apps directory contents:`);
        const appsContents = fs.readdirSync(appsPath);
        appsContents.forEach(item => {
          console.log(`  📁 apps/${item}`);
        });
        
        // 检查app-frontend
        const appFrontendPath = path.join(appsPath, 'app-frontend');
        if (fs.existsSync(appFrontendPath)) {
          console.log(`🎯 app-frontend exists`);
          const srcPath = path.join(appFrontendPath, 'src');
          if (fs.existsSync(srcPath)) {
            console.log(`📂 src directory exists`);
            const componentsPath = path.join(srcPath, 'components');
            if (fs.existsSync(componentsPath)) {
              console.log(`🧩 components directory exists`);
            } else {
              console.log(`❌ components directory not found at: ${componentsPath}`);
            }
          } else {
            console.log(`❌ src directory not found at: ${srcPath}`);
          }
        } else {
          console.log(`❌ app-frontend not found at: ${appFrontendPath}`);
        }
      } else {
        console.log(`❌ apps directory not found at: ${appsPath}`);
      }
    } catch (error) {
      console.error(`Error reading source directory: ${error.message}`);
    }
    
    const allTranslations = {};
    
    // 扫描现有的JSON翻译文件
    const jsonPattern = path.join(this.sourcePath, '**/locales/en-US/*.json');
    console.log(`🔍 Searching for JSON files with pattern: ${jsonPattern}`);
    const jsonFiles = glob.sync(jsonPattern);
    
    console.log(`📄 Found ${jsonFiles.length} existing translation files:`);
    jsonFiles.forEach(file => {
      const relativePath = path.relative(this.sourcePath, file);
      console.log(`  - ${relativePath}`);
      
      const translations = this.extractFromJson(file);
      if (Object.keys(translations).length > 0) {
        allTranslations[relativePath] = translations;
      }
    });
    
    // 扫描Vue组件文件（重点关注app-frontend）
    const vuePattern = path.join(this.sourcePath, 'apps/app-frontend/src/components/**/*.vue');
    console.log(`🔍 Searching for Vue files with pattern: ${vuePattern}`);
    const vueFiles = glob.sync(vuePattern);
    
    console.log(`\n🎯 Found ${vueFiles.length} Vue component files:`);
    
    const vueTranslations = {};
    let totalVueStrings = 0;
    
    vueFiles.forEach(filePath => {
      const translations = this.extractFromVue(filePath);
      const stringCount = Object.keys(translations).length;
      
      if (stringCount > 0) {
        Object.assign(vueTranslations, translations);
        totalVueStrings += stringCount;
        
        const relativePath = path.relative(this.sourcePath, filePath);
        console.log(`  - ${relativePath}: ${stringCount} strings`);
      }
    });
    
    // 如果有Vue翻译，添加到结果中
    if (Object.keys(vueTranslations).length > 0) {
      const vueTranslationFile = 'apps/app-frontend/src/locales/en-US/components.json';
      allTranslations[vueTranslationFile] = vueTranslations;
    }
    
    console.log(`\n📊 Extraction Summary:`);
    console.log(`  Vue components: ${totalVueStrings} strings`);
    console.log(`  JSON files: ${Object.keys(allTranslations).length - (totalVueStrings > 0 ? 1 : 0)} files`);
    console.log(`  Total keys: ${Object.values(allTranslations).reduce((sum, data) => sum + Object.keys(data).length, 0)}`);
    
    return allTranslations;
  }

  /**
   * 生成翻译报告
   * @param {Object} translations - 翻译数据
   */
  generateReport(translations) {
    let totalKeys = 0;
    const report = {
      timestamp: new Date().toISOString(),
      sourcePath: this.sourcePath,
      summary: {},
      details: translations
    };
    
    for (const [file, data] of Object.entries(translations)) {
      const keyCount = Object.keys(data).length;
      totalKeys += keyCount;
      report.summary[file] = {
        keyCount,
        sampleKeys: Object.keys(data).slice(0, 5)
      };
    }
    
    report.totalKeys = totalKeys;
    report.fileCount = Object.keys(translations).length;
    
    return report;
  }
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  const sourcePath = args[0] || './modrinth-source';
  const outputFile = args[1] || 'modrinth-translations.json';
  
  console.log('🚀 Modrinth Translation Extractor');
  console.log(`📂 Source path: ${sourcePath}`);
  console.log(`📄 Output file: ${outputFile}`);
  
  try {
    const extractor = new ModrinthTranslationExtractor(sourcePath);
    const translations = extractor.extractAllTranslations();
    const report = extractor.generateReport(translations);
    
    // 输出到文件
    fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
    
    console.log(`\n✅ Extraction completed successfully!`);
    console.log(`📊 Total: ${report.totalKeys} keys in ${report.fileCount} files`);
    console.log(`💾 Report saved to: ${outputFile}`);
    
    return report;
  } catch (error) {
    console.error(`❌ Extraction failed:`, error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ModrinthTranslationExtractor, main };