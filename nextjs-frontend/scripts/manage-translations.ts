import { translationManager } from '../lib/internationalization/translationManager';
import { locales } from '../lib/internationalization/config';

async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'ensure-files':
      await translationManager.ensureLanguageFiles(locales);
      console.log('All language files verified');
      break;

    case 'add-key':
      {
        const path = process.argv[3]?.split('.') || [];
        const value = process.argv[4];

        if (!path.length || !value) {
          console.error(
            'Usage: ts-node scripts/manage-translations.ts add-key path.to.key "Value"',
          );
          process.exit(1);
        }

        translationManager.addSourceKey(path, value);
        console.log(
          'Key added. Run npm run translate to update all languages.',
        );
      }
      break;

    case 'run':
      await translationManager.runTranslation();
      break;

    default:
      console.log(`
Translation Management CLI

Available commands:
  ensure-files    - Create empty JSON files for all locales if they don't exist
  add-key         - Add a new key to the English source dictionary
                    Usage: ts-node scripts/manage-translations.ts add-key path.to.key "Value"
  run             - Run the translation process using Languine
      `);
      break;
  }
}

main().catch(console.error);
