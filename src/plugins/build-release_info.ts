import fs from 'fs'
import path from 'path'
import { PluginOption } from 'vite'

export default function buildReleaseInfo(): PluginOption {
  return {
    name: 'build-release_info',
    writeBundle: () => {
      setImmediate(async () => {
        const versionIdentifier =
          process.env.VITE_APP_VERSION ??
          process.env.npm_package_version ??
          '0.0.0-dev'
        const releaseInfoFile = await fs.promises.open(
          path.resolve(__dirname, '../../dist/release_info.json'),
          'w',
        )
        await releaseInfoFile.writeFile(
          JSON.stringify({
            project_name: 'mainsail',
            project_owner: 'mainsail-crew',
            version: `v${versionIdentifier}`,
          }),
        )
        await releaseInfoFile.close()
      })
    },
  }
}
