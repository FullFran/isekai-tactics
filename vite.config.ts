import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * The dev server serves `assets-local/` from the project root. Builds leave it
 * out unless INCLUDE_LOCAL_SPRITES=1 (private builds only: never publish them).
 */
function localSpritePack(): Plugin {
  let root = process.cwd();
  let outDir = 'dist';
  return {
    name: 'local-sprite-pack',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const source = resolve(root, 'assets-local');
      if (process.env.INCLUDE_LOCAL_SPRITES === '1' && existsSync(source)) cpSync(source, resolve(outDir, 'assets-local'), { recursive: true });
    },
  };
}

export default defineConfig({
  // Relative base so the build can be served from any sub-path.
  base: './',
  plugins: [localSpritePack()],
});
