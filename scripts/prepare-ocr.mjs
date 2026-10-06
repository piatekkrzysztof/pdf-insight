import { mkdir, copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const target = resolve('public/ocr')
await mkdir(target, { recursive: true })
await copyFile(
  resolve('node_modules/tesseract.js-core/LICENSE'),
  resolve(target, 'LICENSE-core.txt'),
)
for (const name of [
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js',
]) {
  await copyFile(
    resolve('node_modules/tesseract.js-core', name),
    resolve(target, name),
  )
}
for (const language of ['eng', 'pol']) {
  await copyFile(
    resolve(
      `node_modules/@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`,
    ),
    resolve(target, `${language}.traineddata.gz`),
  )
}
