#!/usr/bin/env node

/**
 * Update Dictionary Files Script
 * 
 * This script updates the internationalization dictionaries to add 
 * typing effect prompts for the Hero component in all supported languages.
 * 
 * Usage: node update-dictionaries.js
 */

const fs = require('node:fs');
const path = require('node:path');

// Constants
const dictDir = path.join(__dirname, '../lib/internationalization/dictionaries');

// Language-specific typing effect prompts
const typingEffectPrompts = {
  en: [
    "Analyze this RNA-seq dataset for differential gene expression...",
    "What patterns can you identify in this protein sequence alignment?",
    "Explain the CRISPR-Cas9 mechanism in simple terms",
    "Help me interpret these single-cell sequencing results",
    "What can you tell me about these genomic variants?",
  ],
  es: [
    "Analiza este conjunto de datos de RNA-seq para expresión génica diferencial...",
    "¿Qué patrones puedes identificar en esta alineación de secuencias de proteínas?",
    "Explica el mecanismo CRISPR-Cas9 en términos simples",
    "Ayúdame a interpretar estos resultados de secuenciación de células individuales",
    "¿Qué puedes decirme sobre estas variantes genómicas?",
  ],
  fr: [
    "Analysez cet ensemble de données RNA-seq pour l'expression génique différentielle...",
    "Quels motifs pouvez-vous identifier dans cet alignement de séquences protéiques ?",
    "Expliquez le mécanisme CRISPR-Cas9 en termes simples",
    "Aidez-moi à interpréter ces résultats de séquençage unicellulaire",
    "Que pouvez-vous me dire sur ces variants génomiques ?",
  ],
  de: [
    "Analysieren Sie diesen RNA-seq-Datensatz auf differentielle Genexpression...",
    "Welche Muster können Sie in diesem Protein-Sequenz-Alignment identifizieren?",
    "Erklären Sie den CRISPR-Cas9-Mechanismus in einfachen Worten",
    "Helfen Sie mir, diese Einzelzellsequenzierungsergebnisse zu interpretieren",
    "Was können Sie mir über diese genomischen Varianten sagen?",
  ],
  pt: [
    "Analisar este conjunto de dados de RNA-seq para expressão gênica diferencial...",
    "Quais padrões você pode identificar neste alinhamento de sequência de proteínas?",
    "Explicar o mecanismo CRISPR-Cas9 em termos simples",
    "Ajude-me a interpretar estes resultados de sequenciamento de células únicas",
    "O que você pode me dizer sobre estas variantes genômicas?",
  ],
  it: [
    "Analizza questo set di dati RNA-seq per l'espressione genica differenziale...",
    "Quali modelli puoi identificare in questo allineamento di sequenze proteiche?",
    "Spiega il meccanismo CRISPR-Cas9 in termini semplici",
    "Aiutami a interpretare questi risultati di sequenziamento a cellula singola",
    "Cosa puoi dirmi su queste varianti genomiche?",
  ],
  zh: [
    "分析这个RNA-seq数据集以查看差异基因表达...",
    "您能在这个蛋白质序列比对中识别出哪些模式？",
    "用简单的术语解释CRISPR-Cas9机制",
    "帮我解读这些单细胞测序结果",
    "您能告诉我关于这些基因组变异的信息吗？",
  ],
};

/**
 * Updates a dictionary file with typing effect prompts
 * @param {string} lang - The language code for the dictionary
 * @returns {boolean} - Whether the update was successful
 */
function updateDictionaryFile(lang) {
  const filePath = path.join(dictDir, `${lang}.json`);
  
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`Dictionary file not found: ${filePath}`);
      return false;
    }
    
    // Read the file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    let dictionary;
    
    try {
      dictionary = JSON.parse(fileContent);
    } catch (parseError) {
      console.error(`Error parsing JSON in ${lang}.json:`, parseError);
      return false;
    }
    
    // Check if we have prompts for this language
    if (!typingEffectPrompts[lang]) {
      console.warn(`No typing effect prompts defined for language: ${lang}`);
      return false;
    }
    
    // Add typing effect prompts if not already present
    if (dictionary.home?.hero) {
      // Backup the file before modifying
      fs.copyFileSync(filePath, `${filePath}.backup`);
      
      dictionary.home.hero.typingEffectPrompts = typingEffectPrompts[lang];
      
      // Write the updated file with proper formatting
      fs.writeFileSync(
        filePath, 
        JSON.stringify(dictionary, null, 2),
        'utf8'
      );
      
      console.log(`✅ Updated ${lang}.json with typing effect prompts`);
      return true;
    }
  } catch (error) {
    console.error(`Error updating ${lang}.json:`, error);
    return false;
  }
}

// Main execution
(async () => {
  console.log('🌐 Updating dictionary files with typing effect prompts...');
  
  // Verify directory exists
  if (!fs.existsSync(dictDir)) {
    console.error(`Dictionary directory not found: ${dictDir}`);
    process.exit(1);
  }
  
  // Track success/failure
  const results = {
    success: 0,
    failure: 0
  };
  
  // Update all dictionary files
  for (const lang of Object.keys(typingEffectPrompts)) {
    const success = updateDictionaryFile(lang);
    success ? results.success++ : results.failure++;
  }
  
  // Summary
  console.log('\n📊 Update Summary:');
  console.log(`✅ Successfully updated: ${results.success} dictionaries`);
  
  if (results.failure > 0) {
    console.log(`❌ Failed to update: ${results.failure} dictionaries`);
    process.exit(1);
  }
  
  console.log('✨ All dictionaries updated successfully!');
})();
