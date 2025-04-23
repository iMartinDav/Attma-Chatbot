import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import util from 'node:util';

const execPromise = util.promisify(exec);

/**
 * Translation manager utility to help with translation operations
 */
export class TranslationManager {
  private dictPath = path.join(process.cwd(), 'lib/i18n/dictionaries');

  /**
   * Check if all language files exist and create them if they don't
   */
  async ensureLanguageFiles(locales: readonly string[]): Promise<void> {
    for (const locale of locales) {
      const filePath = path.join(this.dictPath, `${locale}.json`);

      try {
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, '{}', 'utf8');
          console.log(`Created empty dictionary file for ${locale}`);
        }
      } catch (error) {
        console.error(`Error ensuring language file for ${locale}:`, error);
      }
    }
  }

  /**
   * Run the translation process using Languine
   */
  async runTranslation(): Promise<void> {
    try {
      console.log('Starting translation process...');
      const { stdout, stderr } = await execPromise('npm run translate');

      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);

      console.log('Translation completed successfully');
    } catch (error) {
      console.error('Translation process failed:', error);
      throw error;
    }
  }

  /**
   * Add a new key to the English source dictionary
   */
  addSourceKey(keyPath: string[], value: string): void {
    type DictionaryData = { [key: string]: string | DictionaryData };
    const filePath = path.join(this.dictPath, 'en.json');
    let data: DictionaryData = {};

    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        data = JSON.parse(content);
      }

      // Navigate to the correct nested property
      let current: DictionaryData = data;
      for (let i = 0; i < keyPath.length - 1; i++) {
        const key = keyPath[i];
        const nextLevel = current[key];

        if (nextLevel === undefined) {
          // If the key doesn't exist, create a new object
          current[key] = {};
          current = current[key] as DictionaryData; // We just created it as an object
        } else if (
          typeof nextLevel === 'object' &&
          nextLevel !== null &&
          !Array.isArray(nextLevel)
        ) {
          // If it exists and is a non-null, non-array object, proceed
          current = nextLevel as DictionaryData;
        } else {
          // If it exists but is not a traversable object (e.g., a string), throw an error
          throw new Error(
            `Invalid key path: "${keyPath.slice(0, i + 1).join('.')}" is not an object.`,
          );
        }
      }

      // Set the value at the final path element
      current[keyPath[keyPath.length - 1]] = value;

      // Write back to the file
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`Added new key "${keyPath.join('.')}" to source dictionary`);
    } catch (error) {
      console.error('Error adding source key:', error);
      throw error;
    }
  }
}

// Singleton instance
export const translationManager = new TranslationManager();
