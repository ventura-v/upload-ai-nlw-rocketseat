import { FFmpeg } from '@ffmpeg/ffmpeg'

// importando os scripts do ffmpeg
// o "?url" no final serve para o vite entender para carregar as importações apenas quando forem chamadas/necessárias
import coreURL from '../ffmpeg/ffmpeg-core.js?url'
import wasmURL from '../ffmpeg/ffmpeg-core.wasm?url'
import workerURL from '../ffmpeg/ffmpeg-worker.js?url'

// a biblioteca só será carregada quando for utilizada
let ffmpeg: FFmpeg | null

// função para verificar se a biblioteca já foi carregada
// reaproveitando a variável criada, evitando a criação de mais de uma instância do FFmpeg
export async function getFFmpeg() {
    // se ffmpeg já existir, será retornado
    if (ffmpeg) {
        return ffmpeg
    }

    // se ffmpeg não existir, será criada uma instância
    ffmpeg = new FFmpeg()

    // verificando se o ffmpeg foi carregado
    // caso não, o carregamento será forçado
    if (!ffmpeg.loaded) {
        await ffmpeg.load({
            coreURL,
            wasmURL,
            workerURL,
        })
    }

    return ffmpeg
    
}
