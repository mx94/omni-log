import { args, publishPkg } from './releaseUtils'
import prompts from 'prompts'
import gitSemverTags from 'git-semver-tags'

function getTags(pkgName: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    gitSemverTags({ lernaTags: true, package: pkgName }, function (err, tags) {
      if (err) {
        reject(err)
      } else {
        resolve(tags)
      }
    })
  })
}

async function main() {
  const pkgName = args._[0]

  if (!pkgName) {
    throw new Error('No pkgName specified')
  }

  const tags = await getTags(pkgName)

  const { tag }: { tag: string } = await prompts({
    type: 'select',
    name: 'tag',
    message: 'Select tags version',
    choices: tags.map((i) => ({ value: i, title: i }))
  })

  await publishPkg(tag)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
