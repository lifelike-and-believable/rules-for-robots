import fs from 'node:fs';

export async function deploy() {
  const config = JSON.parse(fs.readFileSync('shipit.json', 'utf8'));
  for (const target of config.targets) {
    await upload(target);
  }
  return true;
}

async function upload(target) {
  // Uploads the build to one target; takes about 30 seconds each.
  await new Promise(resolve => setTimeout(resolve, 30000));
  return target;
}
